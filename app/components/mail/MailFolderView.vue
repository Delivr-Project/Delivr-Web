<script setup lang="ts">
import type { MailAccountWithMailboxes, MailListItem, Mailbox } from '~/utils/types';
import { Utils } from '~/utils';
import { useMailDrag } from '~/composables/useMailDrag';
import { MailboxDisplayUtils } from '~/utils/mailboxDisplay';
import MailDetailContent from '~/components/mail/MailDetailContent.vue';
import MailToolbar from '~/components/mail/MailToolbar.vue';
import { useEffectiveMailViewMode, type MailViewMode } from '~/composables/useMailViewMode';
import { useMediaQuery } from '@vueuse/core';

const props = defineProps<{
    /** Raw folder route param (possibly slash-joined encoded segments). */
    folderPathParam: string | string[] | undefined;
    /** Explicit UID to display. When null/undefined the detail pane is empty in split view. */
    mailUid: number | null;
    /** When true we render full-screen detail only (used by the child mail route). */
    fullScreen?: boolean;
}>();

const emit = defineEmits<{
    close: [];
}>();

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { isMailSearchOpen } = useDashboard();
const storedViewMode = useMailViewMode();
const viewMode = useEffectiveMailViewMode();

// Below the `lg` breakpoint there's no room for the side-by-side split, so
// mobile always uses a single list that opens mail full-screen — regardless of
// the stored view mode.
const isMobile = useMediaQuery('(max-width: 1023px)');

const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const accountId = mailAccount.data.value.id;
const mailboxes = computed(() => mailAccount.data.value.mailboxes || []);

// ── Resolve which mailbox these URL segments point at ──
const folderSegments = computed(() => MailboxDisplayUtils.parseFolderParam(props.folderPathParam));
const currentMailbox = computed(() => MailboxDisplayUtils.findMailboxByUrlSegments(mailboxes.value, folderSegments.value));
const systemFolderPath = computed(() =>
    currentMailbox.value?.path ?? folderSegments.value.join(mailboxes.value[0]?.delimiter || '/')
);
const folderTitle = computed(() =>
    currentMailbox.value
        ? MailboxDisplayUtils.leafName(currentMailbox.value)
        : (folderSegments.value[folderSegments.value.length - 1] ?? 'Folder')
);

const breadcrumbItems = computed(() =>
    currentMailbox.value
        ? MailboxDisplayUtils.crumbs(currentMailbox.value, mailboxes.value, accountId)
        : [{ label: folderTitle.value }]
);

const folderIcon = computed(() => {
    const special = currentMailbox.value?.specialUse?.replace(/^\\/, '').toLowerCase();
    const lower = (special ?? folderTitle.value).toLowerCase();
    if (lower === 'inbox') return 'i-lucide-inbox';
    if (lower === 'sent' || lower === 'sent mail' || lower === 'sent messages') return 'i-lucide-send';
    if (lower === 'drafts') return 'i-lucide-file-edit';
    if (lower === 'trash' || lower === 'deleted' || lower === 'deleted messages') return 'i-lucide-trash-2';
    if (lower === 'spam' || lower === 'junk') return 'i-lucide-shield-alert';
    if (lower === 'archive') return 'i-lucide-archive';
    return 'i-lucide-folder';
});

// Deleting from the Trash folder is permanent (there's nowhere further to move to);
// deleting from anywhere else soft-deletes by moving to Trash.
const isTrashFolder = computed(() => {
    const special = currentMailbox.value?.specialUse?.replace(/^\\/, '').toLowerCase();
    const lower = (special ?? folderTitle.value).toLowerCase();
    return lower === 'trash' || lower === 'deleted' || lower === 'deleted messages' || lower === 'deleted items';
});

useSeoMeta({
    title: () => `${folderTitle.value} | Delivr`,
    description: () => `Manage your ${folderTitle.value} emails`,
});

// ── Helpers ──

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function getPreview(mail: MailListItem): string {
    if (mail.body?.text) return Utils.truncate(stripHtml(mail.body.text), 120);
    if (mail.body?.html) return Utils.truncate(stripHtml(mail.body.html), 120);
    return 'No preview available';
}

function formatRelativeDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function isUnread(mail: MailListItem): boolean {
    return !mail.flags?.seen;
}

function hasAttachments(mail: MailListItem): boolean {
    return mail.attachments.length > 0;
}

// ── Pagination ──

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const pageSize = ref(PAGE_SIZE_OPTIONS[0]!);
const pageSizeItems = PAGE_SIZE_OPTIONS.map(n => ({ label: String(n), value: n }));
const currentPage = ref(1);

// ── Data fetching ──

const mails = await useAPIAsyncData<MailListItem[]>(
    `mail-folder-${accountId}-${systemFolderPath.value}-${currentPage.value}`,
    async () => {
        const response = await useAPI(api => api.getMailAccountsByMailAccountIdMailboxesByMailboxPathMails({
            path: {
                mailAccountID: accountId,
                mailboxPath: systemFolderPath.value,
            },
            query: {
                order: 'newest',
                limit: pageSize.value,
                offset: (currentPage.value - 1) * pageSize.value,
            }
        }));
        if (!response.success) {
            toast.add({
                title: 'Error loading emails',
                description: response.message || 'An unknown error occurred while fetching emails.',
                color: 'error'
            });
            return [] as MailListItem[];
        }
        return response.data;
    }
);

watch([currentPage, systemFolderPath], () => {
    mails.refresh();
    // UIDs are per-mailbox and per-page, so a stale selection could target the
    // wrong messages after switching folder/page — always start fresh.
    clearSelection();
});

// Changing the page size restarts from page 1. If already on page 1 the watcher
// above won't fire, so refetch here; otherwise resetting the page triggers it.
watch(pageSize, () => {
    if (currentPage.value === 1) {
        mails.refresh();
        clearSelection();
    } else {
        currentPage.value = 1;
    }
});

const mailList = mails.data;

// Detail pane instance (only one is mounted at a time) so refresh can re-sync it.
const detailRef = ref<{
    reload: () => void;
    setSeen: (seen: boolean) => void;
    reply: () => void;
    replyAll: () => void;
    forward: () => void;
    print: () => void;
} | null>(null);

// Refresh the list AND the currently open mail, so the list rows and the detail
// pane's read/unread button reflect the same (server) state after a refresh.
function handleRefresh() {
    mails.refresh();
    detailRef.value?.reload();
}

// Keep the list in sync when the detail pane changes a mail's flags (e.g.
// read/unread toggle) — without a refetch. `mails.data` is a shallowRef (Nuxt 4
// default `deep: false`), so we must reassign the array rather than mutate a nested
// property, otherwise the list rows won't re-render.
function handleFlagsChange(uid: number, flags: NonNullable<MailListItem['flags']>) {
    // Keep the sidebar unread badge live when the detail pane flips a flag
    // (e.g. auto-mark-as-read on open, or its ⋮ read/unread toggle).
    const prev = mailList.value.find(m => m.uid === uid);
    if (prev) {
        const wasUnread = isUnread(prev);
        const nowUnread = !flags.seen;
        if (wasUnread !== nowUnread) adjustMailboxUnseen(currentMailbox.value, nowUnread ? 1 : -1);
    }
    mailList.value = mailList.value.map(m => m.uid === uid ? { ...m, flags } : m);
}

// ── Pagination controls ──

const hasNextPage = computed(() => mailList.value.length === pageSize.value);
const hasPrevPage = computed(() => currentPage.value > 1);

function nextPage() {
    if (hasNextPage.value) currentPage.value++;
}

function prevPage() {
    if (hasPrevPage.value) currentPage.value--;
}

// ── Selection state ──

const selectedUids = ref<Set<number>>(new Set());

function isSelected(uid: number): boolean {
    return selectedUids.value.has(uid);
}

function toggleSelection(uid: number) {
    const newSet = new Set(selectedUids.value);
    if (newSet.has(uid)) newSet.delete(uid);
    else newSet.add(uid);
    selectedUids.value = newSet;
}

function toggleSelectAll() {
    if (selectedUids.value.size === mailList.value.length) {
        selectedUids.value = new Set();
    } else {
        selectedUids.value = new Set(mailList.value.map(m => m.uid));
    }
}

function clearSelection() {
    selectedUids.value = new Set();
}

const hasSelection = computed(() => selectedUids.value.size > 0);
const allSelected = computed(() => mailList.value.length > 0 && selectedUids.value.size === mailList.value.length);
const someSelected = computed(() => selectedUids.value.size > 0 && selectedUids.value.size < mailList.value.length);

// The email(s) the toolbar actions apply to: the checked selection if any,
// otherwise the single email currently open in the reading pane. This lets the
// buttons act on one opened email without having to tick its checkbox.
const effectiveActionUids = computed<number[]>(() => {
    if (selectedUids.value.size > 0) return Array.from(selectedUids.value);
    if (activeMailUid.value !== null) return [activeMailUid.value];
    return [];
});
const hasActionTarget = computed(() => effectiveActionUids.value.length > 0);

const isApplyingBulkFlags = ref(false);

// ── Read / unread ──

// Nudge a mailbox's unread badge on the shared account object so the sidebar
// count stays live (same object the layout renders from). Clamped at zero.
function adjustMailboxUnseen(mb: Mailbox | undefined | null, delta: number) {
    if (!mb || delta === 0) return;
    mb.status.unseen = Math.max(0, (mb.status.unseen ?? 0) + delta);
}

// Are all the current action targets already read? Drives the single toggle's
// direction: all read → offer "Mark as unread", otherwise → "Mark as read".
const targetsAllRead = computed(() => {
    const uids = effectiveActionUids.value;
    if (uids.length === 0) return false;
    const set = new Set(uids);
    return mailList.value.filter(m => set.has(m.uid)).every(m => !isUnread(m));
});
const readToggleLabel = computed(() => targetsAllRead.value ? 'Mark as unread' : 'Mark as read');
const readToggleIcon = computed(() => targetsAllRead.value ? 'i-lucide-mail' : 'i-lucide-mail-open');

// Core: set the seen flag for a set of mails (optimistic list + sidebar badge).
async function applySeen(uids: number[], seen: boolean) {
    if (uids.length === 0 || isApplyingBulkFlags.value) return;

    isApplyingBulkFlags.value = true;
    try {
        const response = await useAPI(api =>
            api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMailBulkActionsFlags({
                path: {
                    mailAccountID: accountId,
                    mailboxPath: systemFolderPath.value,
                },
                body: {
                    uids,
                    flags: { seen },
                },
            })
        );

        if (!response.success) {
            toast.add({
                title: 'Failed to update emails',
                description: response.message || 'An unknown error occurred.',
                color: 'error'
            });
            return;
        }

        // Move the sidebar badge by how many mails actually flipped state.
        const changed = new Set(uids);
        const flipped = mailList.value.filter(m => changed.has(m.uid) && isUnread(m) !== !seen).length;
        adjustMailboxUnseen(currentMailbox.value, seen ? -flipped : flipped);

        // Optimistically update the local list without a full refetch.
        mailList.value = mailList.value.map(m =>
            changed.has(m.uid) ? { ...m, flags: { ...m.flags, seen } } : m
        );
        // Sync the open reading pane's state locally. Must NOT reload() — that
        // would re-run the detail's auto-mark-as-read and undo an "unread" toggle.
        if (activeMailUid.value !== null && changed.has(activeMailUid.value)) {
            detailRef.value?.setSeen(seen);
        }
    } finally {
        isApplyingBulkFlags.value = false;
    }
}

// Toolbar single toggle: flips the whole target set to the opposite of "all read".
async function toggleTargetsSeen() {
    await applySeen(effectiveActionUids.value, !targetsAllRead.value);
    clearSelection();
}

// Per-row hover toggle (dense list): flip just that one row.
function toggleRowSeen(mail: MailListItem) {
    applySeen([mail.uid], isUnread(mail));
}

// ── Bulk delete ──

const isDeleting = ref(false);
const confirmSoftDeleteOpen = ref(false);
const confirmPermanentDeleteOpen = ref(false);

const deleteWarningText = computed(() => {
    const n = effectiveActionUids.value.length;
    return `This will permanently delete ${n} email${n === 1 ? '' : 's'}. This action cannot be undone.`;
});

// Route the delete button to the right confirmation: a heavy "type DELETE" modal
// for permanent deletes (from Trash), a lightweight confirm for soft-deletes.
function requestDelete() {
    if (!hasActionTarget.value) return;
    if (isTrashFolder.value) confirmPermanentDeleteOpen.value = true;
    else confirmSoftDeleteOpen.value = true;
}

async function deleteSelected(permanent: boolean) {
    if (!hasActionTarget.value || isDeleting.value) return;

    isDeleting.value = true;
    try {
        const uids = effectiveActionUids.value;

        const response = await useAPI(api =>
            api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMailBulkActionsDelete({
                path: {
                    mailAccountID: accountId,
                    mailboxPath: systemFolderPath.value,
                },
                body: { uids, permanent },
            })
        );

        if (!response.success) {
            toast.add({
                title: 'Failed to delete emails',
                description: response.message || 'An unknown error occurred.',
                color: 'error'
            });
            return;
        }

        // Optimistically drop the removed rows (mailList is a shallowRef, so reassign).
        const removed = new Set(uids);
        // Removing unread mails lowers this folder's sidebar badge.
        const unreadRemoved = mailList.value.filter(m => removed.has(m.uid) && isUnread(m)).length;
        adjustMailboxUnseen(currentMailbox.value, -unreadRemoved);
        mailList.value = mailList.value.filter(m => !removed.has(m.uid));
        clearSelection();
        confirmSoftDeleteOpen.value = false;
        // Close the reading pane if the email it was showing is now gone.
        if (activeMailUid.value !== null && removed.has(activeMailUid.value)) {
            closeActiveMail();
        }

        toast.add({
            title: permanent ? 'Emails deleted' : 'Moved to Trash',
            description: `${uids.length} email${uids.length === 1 ? '' : 's'} ${permanent ? 'permanently deleted' : 'moved to Trash'}.`,
            color: 'success'
        });

        // If the current page is now empty, step back a page (the watcher refetches);
        // otherwise refetch to pull in items shifted forward from later pages.
        if (mailList.value.length === 0 && currentPage.value > 1) {
            currentPage.value--;
        } else {
            mails.refresh();
        }
    } finally {
        isDeleting.value = false;
    }
}

// ── Drag & drop (move to folder) ──

const { startDrag, endDrag, registerMoveHandler } = useMailDrag();

// The UID being dragged over a folder. Dragging a selected row drags the whole
// selection; dragging an unselected row drags just that one.
function onRowDragStart(uid: number, e: DragEvent) {
    const uids = selectedUids.value.has(uid) && selectedUids.value.size > 0
        ? Array.from(selectedUids.value)
        : [uid];
    startDrag({ accountId, sourceFolderPath: systemFolderPath.value, uids });
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        // A payload is required for a valid drag in some browsers.
        e.dataTransfer.setData('text/plain', uids.join(','));
    }
}

// Perform the move once the sidebar reports which folder was dropped on.
// Mirrors deleteSelected: optimistic row removal, toast, page/refresh fix-up.
async function moveToMailbox(target: Mailbox, uids: number[]) {
    if (uids.length === 0) return;

    const response = await useAPI(api =>
        api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMailBulkActionsMove({
            path: {
                mailAccountID: accountId,
                mailboxPath: systemFolderPath.value,
            },
            body: { uids, targetMailbox: target.path },
        })
    );

    if (!response.success) {
        toast.add({
            title: 'Failed to move emails',
            description: response.message || 'An unknown error occurred.',
            color: 'error'
        });
        return;
    }

    const moved = new Set(uids);
    // Unread mails carry their badge from this folder to the destination.
    const unreadMoved = mailList.value.filter(m => moved.has(m.uid) && isUnread(m)).length;
    adjustMailboxUnseen(currentMailbox.value, -unreadMoved);
    adjustMailboxUnseen(target, unreadMoved);
    mailList.value = mailList.value.filter(m => !moved.has(m.uid));
    // Drop moved mails out of the selection so the action bar reflects reality.
    if (selectedUids.value.size > 0) {
        const next = new Set(selectedUids.value);
        for (const uid of uids) next.delete(uid);
        selectedUids.value = next;
    }
    // Close the reading pane if the email it was showing was moved away.
    if (activeMailUid.value !== null && moved.has(activeMailUid.value)) {
        closeActiveMail();
    }

    const label = MailboxDisplayUtils.leafName(target);
    toast.add({
        title: 'Emails moved',
        description: `${uids.length} email${uids.length === 1 ? '' : 's'} moved to ${label}.`,
        color: 'success'
    });

    if (mailList.value.length === 0 && currentPage.value > 1) {
        currentPage.value--;
    } else {
        mails.refresh();
    }
}

// Register while mounted so drops in the sidebar route to this folder's list.
const unregisterMove = registerMoveHandler(moveToMailbox);
onBeforeUnmount(() => {
    unregisterMove();
    endDrag();
});

// ── Keyboard shortcuts ──

// Delete/Backspace removes the current selection, or the open mail if nothing
// is selected. defineShortcuts already ignores keystrokes while typing in inputs.
defineShortcuts({
    delete: requestDelete,
    backspace: requestDelete,
});

// ── Archive ──

// The account's Archive folder, if it has one (special-use \Archive).
const archiveMailbox = computed(() =>
    mailboxes.value.find(mb => mb.specialUse?.replace(/^\\/, '').toLowerCase() === 'archive')
);
// Can't archive when there's no Archive folder or we're already in it.
const canArchive = computed(() =>
    !!archiveMailbox.value && archiveMailbox.value.path !== systemFolderPath.value
);

async function archiveSelected() {
    if (!hasActionTarget.value || !archiveMailbox.value || !canArchive.value) return;
    await moveToMailbox(archiveMailbox.value, effectiveActionUids.value);
}

// Ctrl/Cmd-click a row to toggle it into the selection instead of opening it.
function onRowClick(uid: number, e: MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        toggleSelection(uid);
    } else {
        openMail(uid);
    }
}

// ── Unread count ──

const unreadCount = computed(() => mailList.value.filter(m => isUnread(m)).length);

// ── Active mail ──
const activeMailUid = computed(() => props.mailUid ?? null);

// The compact 3-line "cards" list is used on mobile and in desktop split view;
// desktop list view keeps its dense single-line rows.
const cardLayout = computed(() => isMobile.value || viewMode.value === 'split');

// On mobile (any mode) and in desktop list view, an opened mail takes over the
// whole panel. Only desktop split view shows it in the side detail column.
const fullScreenMail = computed(() => isMobile.value || viewMode.value === 'list' || props.fullScreen);

// Selecting more than one email hides the reading pane — bulk actions take over.
const multiSelected = computed(() => selectedUids.value.size >= 2);
const showFullDetail = computed(() => activeMailUid.value !== null && fullScreenMail.value && !multiSelected.value);

function setViewMode(mode: MailViewMode) {
    storedViewMode.value = mode;
}

function toggleViewMode() {
    storedViewMode.value = viewMode.value === 'split' ? 'list' : 'split';
}

function encodedFolderPath(): string {
    const mb = currentMailbox.value;
    const delimiter = mb?.delimiter || mailboxes.value[0]?.delimiter || '/';
    return mb
        ? MailboxDisplayUtils.pathToUrlSegment(mb.path, delimiter)
        : MailboxDisplayUtils.pathToUrlSegment(folderSegments.value.join(delimiter), delimiter);
}

function mailRoute(uid: number): string {
    return `/mail/${accountId}/folder/${encodedFolderPath()}/${uid}`;
}

function folderRoute(): string {
    return `/mail/${accountId}/folder/${encodedFolderPath()}`;
}

// ── Navigation ──

function openMail(uid: number) {
    if (fullScreenMail.value) {
        router.push(mailRoute(uid));
    } else {
        router.replace(mailRoute(uid));
    }
}

function closeActiveMail() {
    if (props.fullScreen) {
        emit('close');
    } else {
        router.replace(folderRoute());
    }
}
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <UDashboardNavbar
                :title="folderTitle"
                :icon="folderIcon"
                :ui='{
                    root: "flex items-center gap-2 sm:gap-3",
                    left: "flex items-center gap-1.5 min-w-0",
                    center: "flex flex-1 min-w-0 justify-center",
                    right: "flex items-center shrink-0 gap-1.5",
                }'
            >
                <template #title>
                    <UBreadcrumb
                        :items="breadcrumbItems"
                        :ui="{ root: 'min-w-0', list: 'flex-nowrap', link: 'truncate' }"
                    />
                </template>

                <template #leading>
                    <UButton
                        v-if="showFullDetail"
                        icon="i-lucide-arrow-left"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="closeActiveMail"
                    />
                </template>

                <template #default>
                    <UButton
                        class="bg-transparent ring-default w-full max-w-md justify-start text-muted"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-search"
                        @click="isMailSearchOpen = true;"
                    >
                        <span class="flex-1 text-left truncate">Search emails...</span>
                        <span class="flex items-center gap-1 text-xs shrink-0">
                            <UKbd value="meta" size="sm" />
                            <UKbd value="K" size="sm" />
                        </span>
                    </UButton>
                </template>

                <template #right>
                    <div class="block md:hidden">
                        <UButton
                            icon="i-lucide-pen-square"
                            color="primary"
                            variant="solid"
                            size="md"
                            class="w-full justify-start"
                            :to="`/mail/${accountId}/compose`"
                        />
                    </div>
                    <div class="hidden md:block">
                        <UButton
                            label="Compose"
                            icon="i-lucide-pen-square"
                            color="primary"
                            variant="solid"
                            size="md"
                            class="w-full justify-start"
                            :to="`/mail/${accountId}/compose`"
                        />
                    </div>
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div class="flex flex-col h-full min-h-0">
                <!-- Toolbar (shrink-0) — shown above both the list and the
                     full-screen reading view. -->
                <MailToolbar
                    :count="mailList.length"
                    :unread-count="unreadCount"
                    :show-count="!showFullDetail"
                    :can-archive="canArchive"
                    :has-action-target="hasActionTarget"
                    :read-toggle-label="readToggleLabel"
                    :read-toggle-icon="readToggleIcon"
                    :is-applying-flags="isApplyingBulkFlags"
                    :is-deleting="isDeleting"
                    :is-refreshing="mails.loading.value"
                    :show-mail-actions="activeMailUid !== null && !multiSelected"
                    :is-mobile="isMobile"
                    :view-mode="viewMode"
                    :back-link="props.fullScreen ? folderRoute() : undefined"
                    @archive="archiveSelected"
                    @toggle-read="toggleTargetsSeen"
                    @delete="requestDelete"
                    @reply="detailRef?.reply()"
                    @reply-all="detailRef?.replyAll()"
                    @forward="detailRef?.forward()"
                    @print="detailRef?.print()"
                    @toggle-view="toggleViewMode"
                    @refresh="handleRefresh"
                />

                <!-- ══ LIST MODE with an open mail: full-panel detail (uses the
                     shared toolbar above, so its own header is hidden) ══ -->
                <MailDetailContent
                    v-if="showFullDetail"
                    ref="detailRef"
                    :key="activeMailUid ?? undefined"
                    :account-id="accountId"
                    :folder-path="systemFolderPath"
                    :mail-uid="activeMailUid!"
                    closable
                    hide-actions
                    class="flex-1 min-h-0"
                    @close="closeActiveMail"
                    @not-found="closeActiveMail"
                    @flags-change="handleFlagsChange"
                />

                <!-- ══ Otherwise: the mail list (+ split detail column) ══ -->
                <template v-else>

                    <!-- Main layout: list (+ optional detail in split mode) -->
                    <div
                        class="relative flex flex-1 min-h-0"
                        :class="viewMode === 'split' ? 'flex-col lg:flex-row' : 'flex-col'"
                    >
                        <!-- Mail List Column -->
                        <div
                            class="flex flex-col min-h-0"
                            :class="viewMode === 'split'
                                ? 'w-full lg:w-[38%] lg:min-w-88 lg:max-w-lg lg:border-r lg:border-default'
                                : 'w-full flex-1'"
                        >
                            <!-- Selection / select-all header (padding matches the active row layout so checkboxes line up) -->
                            <div
                                v-if="mailList.length > 0"
                                class="flex items-center border-b border-default shrink-0"
                                :class="cardLayout ? 'gap-2.5 px-4 py-1.5' : 'gap-3 px-4 py-1.5'"
                            >
                                <UCheckbox
                                    :model-value="allSelected"
                                    :indeterminate="someSelected"
                                    @update:model-value="toggleSelectAll"
                                />
                                <span
                                    class="text-xs"
                                    :class="hasSelection ? 'text-default font-medium' : 'text-muted'"
                                >
                                    {{ hasSelection ? `${selectedUids.size} selected` : 'Select all' }}
                                </span>
                                <div class="flex-1" />
                                <span class="text-xs text-muted">Page {{ currentPage }}</span>
                            </div>

                            <!-- Empty state -->
                            <div
                                v-if="mailList.length === 0 && !mails.loading.value"
                                class="flex flex-col items-center justify-center flex-1 py-16 px-4"
                            >
                                <UIcon :name="folderIcon" class="size-12 mb-4 text-dimmed" />
                                <p class="text-muted text-sm mb-2">No emails in {{ folderTitle }}</p>
                            </div>

                            <!-- Loading skeleton -->
                            <div
                                v-else-if="mails.loading.value && mailList.length === 0"
                                class="divide-y divide-default"
                            >
                                <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-4 py-2">
                                    <USkeleton class="size-4 rounded" />
                                    <USkeleton class="h-3.5 w-40" />
                                    <USkeleton class="h-3.5 flex-1" />
                                    <USkeleton class="h-3 w-10" />
                                </div>
                            </div>

                            <!-- Mail rows -->
                            <div v-else class="flex-1 min-h-0 overflow-y-auto">
                                <!-- ══ DENSE LIST (desktop list view only) ══ -->
                                <template v-if="!cardLayout">
                                    <div
                                        v-for="mail in mailList"
                                        :key="mail.uid"
                                        class="group relative flex items-center gap-3 px-4 py-1.5 border-b border-default last:border-b-0 cursor-pointer transition-colors text-sm"
                                        :class="[
                                            isSelected(mail.uid)
                                                ? 'bg-primary/10'
                                                : 'hover:bg-elevated/60'
                                        ]"
                                        draggable="true"
                                        @dragstart="onRowDragStart(mail.uid, $event)"
                                        @dragend="endDrag"
                                        @click="onRowClick(mail.uid, $event)"
                                    >
                                        <!-- Checkbox -->
                                        <div class="shrink-0" @click.stop>
                                            <UCheckbox
                                                :model-value="isSelected(mail.uid)"
                                                @update:model-value="toggleSelection(mail.uid)"
                                            />
                                        </div>

                                        <!-- Sender -->
                                        <div
                                            class="shrink-0 w-40 md:w-48 truncate"
                                            :class="isUnread(mail) ? 'font-semibold text-default' : 'text-muted'"
                                        >
                                            {{ mail.from?.name || mail.from?.address || 'Unknown' }}
                                        </div>

                                        <!-- Subject + preview (single line) -->
                                        <div class="flex-1 min-w-0 truncate">
                                            <span :class="isUnread(mail) ? 'font-semibold text-default' : 'text-muted'">
                                                {{ mail.subject || '(No subject)' }}
                                            </span>
                                            <span class="hidden sm:inline text-dimmed">
                                                &nbsp;— {{ getPreview(mail) }}
                                            </span>
                                        </div>

                                        <!-- Attachment icon -->
                                        <UIcon
                                            v-if="hasAttachments(mail)"
                                            name="i-lucide-paperclip"
                                            class="size-3.5 shrink-0 text-muted"
                                        />

                                        <!-- Date (hides on row hover) -->
                                        <div
                                            class="shrink-0 w-14 text-right text-xs tabular-nums group-hover:invisible"
                                            :class="isUnread(mail) ? 'font-semibold text-default' : 'text-muted'"
                                        >
                                            {{ mail.date ? formatRelativeDate(mail.date) : '' }}
                                        </div>

                                        <!-- Quick actions on hover (overlay on top of date area, stays inside row) -->
                                        <div
                                            class="absolute right-4 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5"
                                            @click.stop
                                        >
                                            <UTooltip text="Archive">
                                                <UButton icon="i-lucide-archive" color="neutral" variant="ghost" size="xs" />
                                            </UTooltip>
                                            <UTooltip text="Delete">
                                                <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" size="xs" />
                                            </UTooltip>
                                            <UTooltip :text="isUnread(mail) ? 'Mark as read' : 'Mark as unread'">
                                                <UButton
                                                    :icon="isUnread(mail) ? 'i-lucide-mail-open' : 'i-lucide-mail'"
                                                    color="neutral"
                                                    variant="ghost"
                                                    size="xs"
                                                    :loading="isApplyingBulkFlags"
                                                    @click="toggleRowSeen(mail)"
                                                />
                                            </UTooltip>
                                        </div>
                                    </div>
                                </template>

                                <!-- ══ SPLIT MODE (compact 3-line) ══ -->
                                <template v-else>
                                    <div
                                        v-for="mail in mailList"
                                        :key="mail.uid"
                                        class="group relative flex items-start gap-2.5 px-4 py-2 border-b border-default last:border-b-0 cursor-pointer transition-colors"
                                        :class="[
                                            activeMailUid === mail.uid
                                                ? 'bg-primary/15 border-l-2 border-l-primary pl-3.5'
                                                : isSelected(mail.uid)
                                                    ? 'bg-primary/10'
                                                    : 'hover:bg-elevated/60'
                                        ]"
                                        draggable="true"
                                        @dragstart="onRowDragStart(mail.uid, $event)"
                                        @dragend="endDrag"
                                        @click="onRowClick(mail.uid, $event)"
                                    >
                                        <!-- Checkbox (primary selection trigger on touch) -->
                                        <div class="shrink-0 pt-0.5" @click.stop>
                                            <UCheckbox
                                                :model-value="isSelected(mail.uid)"
                                                @update:model-value="toggleSelection(mail.uid)"
                                            />
                                        </div>

                                        <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                                            <!-- Row 1: Sender + date -->
                                            <div class="flex items-center justify-between gap-2">
                                                <div class="flex items-center gap-1.5 min-w-0">
                                                    <div
                                                        v-if="isUnread(mail)"
                                                        class="size-2 rounded-full bg-primary shrink-0"
                                                    />
                                                    <span
                                                        class="truncate text-sm"
                                                        :class="isUnread(mail) ? 'font-semibold text-default' : 'text-muted'"
                                                    >
                                                        {{ mail.from?.name || mail.from?.address || 'Unknown' }}
                                                    </span>
                                                </div>
                                                <div class="flex items-center gap-1 shrink-0">
                                                    <UIcon
                                                        v-if="hasAttachments(mail)"
                                                        name="i-lucide-paperclip"
                                                        class="size-3 text-dimmed"
                                                    />
                                                    <span
                                                        class="text-[11px] tabular-nums"
                                                        :class="isUnread(mail) ? 'font-semibold text-default' : 'text-muted'"
                                                    >
                                                        {{ mail.date ? formatRelativeDate(mail.date) : '' }}
                                                    </span>
                                                </div>
                                            </div>

                                            <!-- Row 2: Subject -->
                                            <div
                                                class="text-sm truncate"
                                                :class="isUnread(mail) ? 'font-medium text-default' : 'text-muted'"
                                            >
                                                {{ mail.subject || '(No subject)' }}
                                            </div>

                                            <!-- Row 3: Preview -->
                                            <div class="text-xs text-dimmed truncate">
                                                {{ getPreview(mail) }}
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </div>

                            <!-- Pagination -->
                            <div class="flex items-center justify-between px-3 py-1.5 border-t border-default shrink-0">
                                <div class="flex items-center gap-1.5">
                                    <USelect
                                        v-model="pageSize"
                                        :items="pageSizeItems"
                                        value-key="value"
                                        size="xs"
                                        class="w-16"
                                    />
                                    <span class="text-xs text-muted">per page</span>
                                </div>
                                <div class="flex items-center gap-1">
                                    <UButton
                                        icon="i-lucide-chevron-left"
                                        color="neutral"
                                        variant="ghost"
                                        size="xs"
                                        :disabled="!hasPrevPage"
                                        @click="prevPage"
                                    />
                                    <span class="text-xs text-muted px-1">{{ currentPage }}</span>
                                    <UButton
                                        icon="i-lucide-chevron-right"
                                        color="neutral"
                                        variant="ghost"
                                        size="xs"
                                        :disabled="!hasNextPage"
                                        @click="nextPage"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Detail Column (split view only) -->
                        <div
                            v-if="viewMode === 'split'"
                            class="flex-1 min-h-0 min-w-0 hidden lg:flex lg:flex-col"
                        >
                            <!-- Reading pane hides while multiple emails are selected. -->
                            <MailDetailContent
                                v-if="activeMailUid !== null && !multiSelected"
                                ref="detailRef"
                                :key="activeMailUid"
                                :account-id="accountId"
                                :folder-path="systemFolderPath"
                                :mail-uid="activeMailUid"
                                closable
                                hide-actions
                                @close="closeActiveMail"
                                @not-found="closeActiveMail"
                                @flags-change="handleFlagsChange"
                            />
                            <div v-else class="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                                <div class="relative mb-6">
                                    <div class="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
                                    <div class="relative rounded-2xl border border-default p-6">
                                        <UIcon :name="multiSelected ? 'i-lucide-check-check' : 'i-lucide-mail-open'" class="size-12 text-primary/70" />
                                    </div>
                                </div>
                                <p class="text-base font-semibold text-default mb-1.5">
                                    {{ multiSelected ? `${selectedUids.size} emails selected` : 'Nothing selected' }}
                                </p>
                                <p v-if="multiSelected" class="text-sm text-muted max-w-sm mb-6">
                                    Use the toolbar above to archive, mark, or delete them.
                                </p>
                                <p v-else class="text-sm text-muted max-w-sm mb-6">
                                    Pick an email from the list to read it here, or press
                                    <UKbd value="meta" size="sm" class="mx-0.5" /><UKbd value="K" size="sm" />
                                    to search across all your mail.
                                </p>
                                <div class="flex flex-col items-center gap-2 text-xs text-dimmed">
                                    <div class="flex items-center gap-2">
                                        <UIcon name="i-lucide-inbox" class="size-3.5" />
                                        <span>{{ mailList.length }} emails in this folder</span>
                                    </div>
                                    <div v-if="unreadCount > 0" class="flex items-center gap-2">
                                        <div class="size-1.5 rounded-full bg-primary" />
                                        <span>{{ unreadCount }} unread</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Soft-delete confirmation (move to Trash) -->
                <DashboardModal
                    v-model:open="confirmSoftDeleteOpen"
                    title="Move to Trash"
                    icon="i-lucide-trash-2"
                    icon-color="error"
                >
                    <p class="text-sm text-muted">
                        Move {{ selectedUids.size }} selected email{{ selectedUids.size === 1 ? '' : 's' }} to Trash?
                    </p>

                    <template #footer>
                        <div class="flex justify-end gap-3">
                            <UButton
                                label="Cancel"
                                color="neutral"
                                variant="ghost"
                                @click="confirmSoftDeleteOpen = false;"
                            />
                            <UButton
                                label="Move to Trash"
                                color="error"
                                icon="i-lucide-trash-2"
                                :loading="isDeleting"
                                @click="deleteSelected(false)"
                            />
                        </div>
                    </template>
                </DashboardModal>

                <!-- Permanent-delete confirmation (deleting from Trash) -->
                <DashboardDeleteModal
                    v-model:open="confirmPermanentDeleteOpen"
                    title="Delete permanently"
                    :warning-text="deleteWarningText"
                    :on-delete="() => deleteSelected(true)"
                />
            </div>
        </template>
    </UDashboardPanel>
</template>
