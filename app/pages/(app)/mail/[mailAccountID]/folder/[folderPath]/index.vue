<script setup lang="ts">
import type { MailAccountWithMailboxes, MailListItem } from '~/utils/types';
import { Utils } from '~/utils';
import MailDetailContent from '~/components/mail/MailDetailContent.vue';
import { useMailViewMode } from '~/composables/useMailViewMode';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { isMailSearchOpen } = useDashboard();
const viewMode = useMailViewMode();

const folderPath = decodeURIComponent(route.params.folderPath as string);
const systemFolderPath = folderPath.toLowerCase() === 'inbox' ? 'INBOX' : folderPath;
const uiFolderPath = folderPath.charAt(0).toUpperCase() + folderPath.slice(1).toLowerCase();

const folderIcon = computed(() => {
    const lower = folderPath.toLowerCase();
    if (lower === 'inbox') return 'i-lucide-inbox';
    if (lower === 'sent' || lower === 'sent mail' || lower === 'sent messages') return 'i-lucide-send';
    if (lower === 'drafts') return 'i-lucide-file-edit';
    if (lower === 'trash' || lower === 'deleted' || lower === 'deleted messages') return 'i-lucide-trash-2';
    if (lower === 'spam' || lower === 'junk') return 'i-lucide-shield-alert';
    if (lower === 'archive') return 'i-lucide-archive';
    return 'i-lucide-folder';
});

useSeoMeta({
    title: `${uiFolderPath} | Delivr`,
    description: `Manage your ${uiFolderPath} emails`
});

const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const accountId = mailAccount.data.value.id;

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

const PAGE_SIZE = 25;
const currentPage = ref(1);

// ── Data fetching ──

const mails = await useAPIAsyncData<MailListItem[]>(
    `/mail-accounts/${accountId}/mailboxes/${systemFolderPath}/mails`,
    async () => {
        const response = await useAPI(api => api.getMailAccountsByMailAccountIdMailboxesByMailboxPathMails({
            path: {
                mailAccountID: accountId,
                mailboxPath: systemFolderPath,
            },
            query: {
                order: 'newest',
                limit: PAGE_SIZE,
                offset: (currentPage.value - 1) * PAGE_SIZE,
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

watch(currentPage, () => {
    mails.refresh();
});

const mailList = mails.data;

// ── Pagination controls ──

const hasNextPage = computed(() => mailList.value.length === PAGE_SIZE);
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

// ── Bulk actions ──

function handleBulk(title: string) {
    toast.add({
        title: `${title} not available`,
        description: 'This feature will be available soon.',
        color: 'warning'
    });
}

// ── Unread count ──

const unreadCount = computed(() => mailList.value.filter(m => isUnread(m)).length);

// ── View mode & active mail (split view) ──

const activeMailUid = ref<number | null>(null);

// Initialize active mail from `?selected=` query param.
const initialSelected = route.query.selected;
if (typeof initialSelected === 'string' && /^\d+$/.test(initialSelected)) {
    activeMailUid.value = parseInt(initialSelected, 10);
}

function toggleViewMode() {
    viewMode.value = viewMode.value === 'split' ? 'list' : 'split';
    if (viewMode.value === 'list') {
        activeMailUid.value = null;
    }
}

// ── Navigation ──

function openMail(uid: number) {
    if (viewMode.value === 'split') {
        activeMailUid.value = uid;
        // Update URL (without navigation) so it's shareable/back-safe.
        router.replace({ query: { ...route.query, selected: String(uid) } });
    } else {
        navigateTo(`/mail/${accountId}/folder/${encodeURIComponent(folderPath)}/${uid}`);
    }
}

function closeActiveMail() {
    activeMailUid.value = null;
    const { selected, ...rest } = route.query;
    void selected;
    router.replace({ query: rest });
}

// If view mode switches to list while a mail is active, clear it.
watch(viewMode, (mode) => {
    if (mode === 'list') activeMailUid.value = null;
});
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <UDashboardNavbar
                :title="uiFolderPath"
                :icon="folderIcon"
                :ui='{
                    root: "flex items-center gap-2 sm:gap-3",
                    left: "flex items-center gap-1.5 min-w-0 flex-none",
                    center: "flex flex-1 min-w-0 justify-center",
                    right: "flex items-center shrink-0 gap-1.5",
                }'
            >
                <template #default>
                    <UButton
                        class="bg-transparent ring-default w-full max-w-md justify-start text-muted"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-search"
                        @click="isMailSearchOpen = true"
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
                <!-- Toolbar (shrink-0) -->
                <div class="flex items-center gap-2 px-4 py-2 border-b border-default shrink-0">
                    <div class="text-sm text-muted">
                        <span class="font-medium text-default">{{ mailList.length }}</span>
                        <span class="mx-1">·</span>
                        <span>{{ unreadCount }} unread</span>
                    </div>

                    <div class="flex-1" />

                    <!-- View mode toggle -->
                    <UTooltip :text="viewMode === 'split' ? 'Switch to list view' : 'Switch to split view'">
                        <UButton
                            :icon="viewMode === 'split' ? 'i-lucide-columns-2' : 'i-lucide-rows-3'"
                            color="neutral"
                            variant="ghost"
                            size="md"
                            @click="toggleViewMode"
                        />
                    </UTooltip>

                    <UTooltip text="Refresh">
                        <UButton
                            icon="i-lucide-refresh-cw"
                            color="neutral"
                            variant="ghost"
                            size="md"
                            :loading="mails.loading.value"
                            @click="mails.refresh()"
                        />
                    </UTooltip>
                </div>

                <!-- Bulk Actions Bar -->
                <div
                    v-if="hasSelection"
                    class="flex items-center gap-2 px-4 py-2 border-b border-default bg-primary/5 shrink-0"
                >
                    <UCheckbox
                        :model-value="allSelected"
                        :indeterminate="someSelected"
                        @update:model-value="toggleSelectAll"
                    />
                    <span class="text-sm font-medium text-default">
                        {{ selectedUids.size }} selected
                    </span>
                    <div class="flex-1" />

                    <div class="flex items-center gap-1">
                        <UTooltip text="Archive">
                            <UButton icon="i-lucide-archive" color="neutral" variant="ghost" size="xs" @click="handleBulk('Archive')" />
                        </UTooltip>
                        <UTooltip text="Mark as read">
                            <UButton icon="i-lucide-mail-open" color="neutral" variant="ghost" size="xs" @click="handleBulk('Mark as read')" />
                        </UTooltip>
                        <UTooltip text="Mark as unread">
                            <UButton icon="i-lucide-mail" color="neutral" variant="ghost" size="xs" @click="handleBulk('Mark as unread')" />
                        </UTooltip>
                        <UTooltip text="Report spam">
                            <UButton icon="i-lucide-shield-alert" color="neutral" variant="ghost" size="xs" @click="handleBulk('Mark as spam')" />
                        </UTooltip>
                        <UTooltip text="Delete">
                            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="handleBulk('Delete')" />
                        </UTooltip>
                    </div>

                    <div class="w-px h-5 bg-default mx-1" />

                    <UButton
                        icon="i-lucide-x"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        @click="clearSelection"
                    >
                        Clear
                    </UButton>
                </div>

                <!-- Main layout: list (+ optional detail in split mode) -->
                <div
                    class="flex flex-1 min-h-0"
                    :class="viewMode === 'split' ? 'flex-col lg:flex-row' : 'flex-col'"
                >
                    <!-- Mail List Column -->
                    <div
                        class="flex flex-col min-h-0"
                        :class="viewMode === 'split'
                            ? 'w-full lg:w-[38%] lg:min-w-88 lg:max-w-lg lg:border-r lg:border-default'
                            : 'w-full'"
                    >
                        <!-- Select-all bar -->
                        <div
                            v-if="mailList.length > 0 && !hasSelection"
                            class="flex items-center gap-3 px-4 py-1.5 border-b border-default shrink-0"
                        >
                            <UCheckbox
                                :model-value="false"
                                @update:model-value="toggleSelectAll"
                            />
                            <span class="text-xs text-muted">Select all</span>
                            <div class="flex-1" />
                            <span class="text-xs text-muted">Page {{ currentPage }}</span>
                        </div>

                        <!-- Empty state -->
                        <div
                            v-if="mailList.length === 0 && !mails.loading.value"
                            class="flex flex-col items-center justify-center flex-1 py-16 px-4"
                        >
                            <UIcon :name="folderIcon" class="size-12 mb-4 text-dimmed" />
                            <p class="text-muted text-sm mb-2">No emails in {{ uiFolderPath }}</p>
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
                            <!-- ══ LIST MODE (Gmail-style dense single-line) ══ -->
                            <template v-if="viewMode === 'list'">
                                <div
                                    v-for="mail in mailList"
                                    :key="mail.uid"
                                    class="group relative flex items-center gap-3 px-4 py-1.5 border-b border-default last:border-b-0 cursor-pointer transition-colors text-sm"
                                    :class="[
                                        isSelected(mail.uid)
                                            ? 'bg-primary/10'
                                            : 'hover:bg-elevated/60'
                                    ]"
                                    @click="openMail(mail.uid)"
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
                                    class="group relative flex flex-col gap-0.5 px-3 py-2 border-b border-default last:border-b-0 cursor-pointer transition-colors"
                                    :class="[
                                        activeMailUid === mail.uid
                                            ? 'bg-primary/15 border-l-2 border-l-primary pl-2.5'
                                            : isSelected(mail.uid)
                                                ? 'bg-primary/10'
                                                : 'hover:bg-elevated/60'
                                    ]"
                                    @click="openMail(mail.uid)"
                                >
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
                            </template>
                        </div>

                        <!-- Pagination -->
                        <div class="flex items-center justify-between px-3 py-1.5 border-t border-default shrink-0">
                            <div class="text-xs text-muted">
                                <span v-if="mailList.length > 0">
                                    {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ (currentPage - 1) * PAGE_SIZE + mailList.length }}
                                </span>
                                <span v-else>—</span>
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
                        <MailDetailContent
                            v-if="activeMailUid !== null"
                            :key="activeMailUid"
                            :account-id="accountId"
                            :folder-path="folderPath"
                            :mail-uid="activeMailUid"
                            closable
                            @close="closeActiveMail"
                            @not-found="closeActiveMail"
                        />
                        <div v-else class="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                            <div class="relative mb-6">
                                <div class="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
                                <div class="relative rounded-2xl border border-default p-6">
                                    <UIcon name="i-lucide-mail-open" class="size-12 text-primary/70" />
                                </div>
                            </div>
                            <p class="text-base font-semibold text-default mb-1.5">
                                Nothing selected
                            </p>
                            <p class="text-sm text-muted max-w-sm mb-6">
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
            </div>
        </template>
    </UDashboardPanel>
</template>
