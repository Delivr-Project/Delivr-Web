<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import MailAccountsMenu from '~/components/dashboard/MailAccountsMenu.vue';
import MailSearch from '~/components/dashboard/MailSearch.vue';
import NotificationsSlideover from '~/components/dashboard/NotificationsSlideover.vue';
import UserMenu from '~/components/dashboard/UserMenu.vue';
import DelivrIcon from '~/components/img/DelivrIcon.vue';
import DelivrLogo from '~/components/img/DelivrLogo.vue';
import { useFolderDragDropStore } from '~/composables/stores/useFolderDragDropStore';
import { useFolderNestingStore } from '~/composables/stores/useFolderNestingStore';
import { useMailAccountsStore } from '~/composables/stores/useMailAccountsStore';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import { useUserInfoStore } from '~/composables/stores/useUserStore';
import { MailboxDisplayUtils } from '~/utils/mailboxDisplay';
import { useMailDrag } from '~/composables/useMailDrag';
import type { Mailbox } from '~/utils/types';

const route = useRoute();
const toast = useToast();
const mailAccountsStore = useMailAccountsStore();



const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();
const mailboxes = computed(() => currentMailAccount.value?.mailboxes || []);

// Preference: nest INBOX sub-folders under the Inbox item instead of lifting
// them to top-level siblings. Reactive, so toggling it re-renders the tree.
const folderNestingStore = useFolderNestingStore();
await folderNestingStore.use();
const nestUnderInbox = folderNestingStore.nestUnderInbox;

// Preference: folder drag-and-drop is opt-in, so it's off unless enabled.
const folderDragDropStore = useFolderDragDropStore();
await folderDragDropStore.use();
const folderDndEnabled = folderDragDropStore.enabled;

const { isMailSearchOpen } = useDashboard();

// ── Drag & drop: sidebar folders act as drop targets for mails ──
// The folder tree is rendered by UNavigationMenu, so instead of custom folder
// components we delegate off the rendered <a href="…/folder/…"> links.

const { dragging, dropOnMailbox } = useMailDrag();

let highlightedEl: HTMLElement | null = null;
let highlightedClass = 'mail-drop-target';
function setHighlight(el: HTMLElement | null, className = 'mail-drop-target') {
    if (highlightedEl === el && highlightedClass === className) return;
    highlightedEl?.classList.remove(highlightedClass);
    highlightedEl = el;
    highlightedClass = className;
    highlightedEl?.classList.add(className);
}

// Resolve the folder link (and its mailbox) under the cursor, if any.
function resolveDropTarget(e: DragEvent): { anchor: HTMLElement; mailbox: Mailbox } | null {
    const anchor = (e.target as HTMLElement | null)?.closest?.('a[href*="/folder/"]') as HTMLElement | null;
    if (!anchor) return null;
    const href = anchor.getAttribute('href') ?? '';
    const match = href.match(/\/folder\/([^/?#]+)/);
    if (!match || !match[1]) return null;
    const segments = MailboxDisplayUtils.parseFolderParam(match[1]);
    const mailbox = MailboxDisplayUtils.findMailboxByUrlSegments(mailboxes.value, segments);
    return mailbox ? { anchor, mailbox } : null;
}

// ── Drag & drop: re-nest folders by dragging one onto another ──
// Same delegation trick as the mail drop — no custom folder components, we hook
// the folder links UNavigationMenu renders. The links are natively draggable,
// so dragstart fires on them and we resolve the mailbox being dragged. Dropping
// folder A onto folder B renames A's IMAP path to live directly under B.

const draggedFolder = ref<Mailbox | null>(null);

function onFolderDragStart(e: DragEvent) {
    // Folder drag-and-drop is opt-in; when off, folders aren't drag sources.
    if (!folderDndEnabled.value) return;
    const target = resolveDropTarget(e);
    // Inbox can't be renamed on any IMAP server, so it isn't a drag source.
    if (!target || MailboxDisplayUtils.isInbox(target.mailbox)) return;
    draggedFolder.value = target.mailbox;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', target.mailbox.path);
        // Use the folder row itself as the drag ghost so it tracks the cursor,
        // instead of the browser's default link-URL image. Offset keeps the
        // ghost pinned under the pointer where the grab started.
        const rect = target.anchor.getBoundingClientRect();
        e.dataTransfer.setDragImage(target.anchor, e.clientX - rect.left, e.clientY - rect.top);
    }
}

function onFolderDragEnd() {
    draggedFolder.value = null;
    setHighlight(null);
}

// A folder drop lands either inside another folder, or at the top level (root)
// when dropped into the sidebar's clear space.
type FolderMoveTarget =
    | { kind: 'folder'; mailbox: Mailbox }
    | { kind: 'root' };

// The destination IMAP path: the source's own leaf name, placed under the target
// folder — or bare at the root for a top-level move.
function destinationPath(src: Mailbox, target: FolderMoveTarget): string {
    const leaf = src.path.split(src.delimiter).pop() || src.path;
    return target.kind === 'root' ? leaf : target.mailbox.path + target.mailbox.delimiter + leaf;
}

// A folder can't be dropped where it already is (a no-op), or onto itself / any
// of its own descendants (that would orphan the subtree).
function isValidFolderTarget(target: FolderMoveTarget): boolean {
    const src = draggedFolder.value;
    if (!src) return false;
    if (target.kind === 'folder') {
        if (target.mailbox.path === src.path) return false;
        if (target.mailbox.path.startsWith(src.path + src.delimiter)) return false;
    }
    return destinationPath(src, target) !== src.path;
}

// Where a folder drop resolves: the folder link under the cursor, or the top
// level when dropping into clear space. `highlight` is the element to outline.
function resolveFolderDropTarget(e: DragEvent): { target: FolderMoveTarget; highlight: HTMLElement | null } | null {
    const onFolder = resolveDropTarget(e);
    if (onFolder) return { target: { kind: 'folder', mailbox: onFolder.mailbox }, highlight: onFolder.anchor };

    // Clear space → top level. Outline the whole zone so the intent is visible.
    const container = e.currentTarget as HTMLElement | null;
    return { target: { kind: 'root' }, highlight: container };
}

function targetLabel(target: FolderMoveTarget): string {
    return target.kind === 'root' ? 'the top level' : `“${MailboxDisplayUtils.leafName(target.mailbox)}”`;
}

async function moveFolder(src: Mailbox, target: FolderMoveTarget) {
    const accountId = currentMailAccount.value?.id;
    if (accountId === undefined) return;

    const response = await useAPI(api =>
        api.putMailAccountsByMailAccountIdMailboxesByMailboxPath({
            path: { mailAccountID: accountId, mailboxPath: src.path },
            body: { path: destinationPath(src, target) },
        })
    );

    if (!response.success) {
        toast.add({
            title: 'Failed to move folder',
            description: response.message || 'An unknown error occurred.',
            color: 'error',
        });
        return;
    }

    toast.add({
        title: 'Folder moved',
        description: `“${MailboxDisplayUtils.leafName(src)}” moved to ${targetLabel(target)}.`,
        color: 'success',
    });

    // Reload mailboxes so the sidebar tree reflects the new hierarchy.
    await mailAccountsStore.refresh();
}

// A drop only stages the move; it isn't applied until the user confirms in the
// dialog below (folder moves rename the IMAP path and carry sub-folders along,
// so they warrant a second look).
const pendingFolderMove = ref<{ src: Mailbox; target: FolderMoveTarget } | null>(null);
const folderMoveConfirmOpen = ref(false);
const isMovingFolder = ref(false);

const pendingFolderMoveText = computed(() => {
    const move = pendingFolderMove.value;
    if (!move) return '';
    return `Move “${MailboxDisplayUtils.leafName(move.src)}” to ${targetLabel(move.target)}?`;
});

async function confirmFolderMove() {
    const move = pendingFolderMove.value;
    if (!move) return;
    isMovingFolder.value = true;
    try {
        await moveFolder(move.src, move.target);
    } finally {
        isMovingFolder.value = false;
        folderMoveConfirmOpen.value = false;
        pendingFolderMove.value = null;
    }
}

function cancelFolderMove() {
    folderMoveConfirmOpen.value = false;
    pendingFolderMove.value = null;
}

function onFolderDragOver(e: DragEvent) {
    const target = resolveDropTarget(e);
    // Mails being dragged onto a folder (move mails there).
    if (dragging.value) {
        if (target && target.mailbox.path !== dragging.value.sourceFolderPath) {
            e.preventDefault(); // mark as a valid drop zone
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            setHighlight(target.anchor);
        } else {
            setHighlight(null);
        }
        return;
    }
    // A folder being dragged onto another folder — or into clear space, which
    // moves it to the top level.
    if (draggedFolder.value) {
        const folderTarget = resolveFolderDropTarget(e);
        if (folderTarget && isValidFolderTarget(folderTarget.target)) {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            setHighlight(
                folderTarget.highlight,
                folderTarget.target.kind === 'root' ? 'folder-root-drop-target' : 'mail-drop-target',
            );
        } else {
            setHighlight(null);
        }
    }
}

function onFolderDrop(e: DragEvent) {
    setHighlight(null);
    // Mails must be dropped onto an actual folder.
    if (dragging.value) {
        const target = resolveDropTarget(e);
        if (!target) return;
        e.preventDefault();
        dropOnMailbox(target.mailbox);
        return;
    }
    // Folders drop onto the folder under the cursor, or the top level in clear space.
    if (draggedFolder.value) {
        const folderTarget = resolveFolderDropTarget(e);
        if (folderTarget && isValidFolderTarget(folderTarget.target)) {
            e.preventDefault();
            const src = draggedFolder.value;
            draggedFolder.value = null;
            // Stage the move and ask for confirmation before applying it.
            pendingFolderMove.value = { src, target: folderTarget.target };
            folderMoveConfirmOpen.value = true;
        }
    }
}

// Clear the highlight when the mail drag ends or leaves the folder area entirely.
watch(dragging, (v) => { if (!v) setHighlight(null); });
function onFolderDragLeave(e: DragEvent) {
    const to = e.relatedTarget as Node | null;
    if (!to || !(e.currentTarget as HTMLElement).contains(to)) setHighlight(null);
}

const sidebarItems = computed(() => {

    const basicItems: NavigationMenuItem[] = [
        {
            label: "Overview",
            icon: "i-lucide-layout-dashboard",
            to: "/",
        },
    ];

    const inbox = mailboxes.value?.find(mb => mb.path.toLowerCase() === 'inbox');

    const mailItems: NavigationMenuItem[] = [];

    // NOTE: Compose button moved to separate prominent button in template

    const accountId = currentMailAccount.value?.id;

    if (mailboxes.value.length === 0) {
        mailItems.push({
            label: 'No Folders to show',
            icon: 'i-lucide-mail',
            exact: false,
        });
    } else if (nestUnderInbox.value) {
        // Inbox lives inside the tree as the parent of its sub-folders.
        if (accountId !== undefined) {
            for (const node of MailboxDisplayUtils.buildMailboxTree(mailboxes.value, { nestUnderInbox: true })) {
                mailItems.push(MailboxDisplayUtils.toNavItem(route.path, node, accountId));
            }
        }
    } else {
        // Pin the Inbox, then the remaining folders as top-level siblings.
        if (inbox) {
            mailItems.push({
                label: 'Inbox',
                icon: 'i-lucide-inbox',
                to: currentMailAccount.value ? `/mail/${currentMailAccount.value.id}/folder/inbox` : undefined,
                badge: inbox.status.unseen > 0 ? inbox.status.unseen : undefined,
                exact: false,
            });
        }
        if (accountId !== undefined) {
            for (const node of MailboxDisplayUtils.buildMailboxTree(mailboxes.value)) {
                mailItems.push(MailboxDisplayUtils.toNavItem(route.path, node, accountId));
            }
        }
    }

    const adminItems: NavigationMenuItem[] = [
        {
            label: "Admin",
            icon: "i-lucide-shield",
            type: "label"
        },
        {
            label: "Users",
            icon: "i-lucide-users",
            to: "/admin/users",
        },
    ];

    const settings: NavigationMenuItem[] = [
        {
            label: "Settings",
            icon: "i-lucide-settings",
            type: "label",
        },
        {
            label: "General",
            icon: "i-lucide-user",
            to: "/settings",
            exact: true,
        },
        {
            label: "Preferences",
            icon: "i-lucide-sliders-horizontal",
            // Expandable group (submenu). Open it whenever we're on any
            // preferences sub-route so the active child is visible.
            defaultOpen: route.path.startsWith("/settings/preferences"),
            type: 'trigger',
            children: [
                {
                    label: "Mail",
                    icon: "i-lucide-mail",
                    to: "/settings/preferences/mail",
                },
                {
                    label: "Remote Content",
                    icon: "i-lucide-image",
                    to: "/settings/preferences/remote-content",
                },
            ],
        },
        {
            label: "Security",
            icon: "i-lucide-shield",
            to: "/settings/security",
        },
        {
            label: "Manage Mail Accounts",
            to: "/settings/mail-accounts",
            icon: "i-lucide-at-sign",
            // The per-account pages (/settings/mail-accounts/:id and its
            // nested backend-configuration) don't keep the parent link active
            // under router-based matching. Force active on any sub-route.
            active: route.path.startsWith("/settings/mail-accounts"),
        },
        {
            label: "API Keys",
            to: "/settings/apikeys",
            icon: "i-lucide-key",
            // The detail/create pages (/settings/apikeys/new, /settings/apikeys/:id)
            // are sibling routes, not children, so router-based active matching
            // misses them. Force active on any apikeys sub-route.
            active: route.path.startsWith("/settings/apikeys"),
        }
    ];

    const footerItems: NavigationMenuItem[] = [
        {
            label: "Folder Settings",
            icon: "i-lucide-settings",
            to: `/settings/mail-accounts/${currentMailAccount.value?.id}/folder-settings`,
        },
    ];

    return {
        basic: basicItems,
        mail: mailItems,
        settings: settings,
        admin: adminItems,
        footer: footerItems,
    }
});

const displaySidebars = computed(() => {

    const settingsSidebar = route.path.startsWith('/settings');
    const adminSidebar = route.path.startsWith('/admin');

    return {
        mailSidebar: !settingsSidebar && !adminSidebar,
        settingsSidebar: settingsSidebar,
        adminSidebar: adminSidebar,
    }
});

</script>

<template>
    <UDashboardGroup class="main-bg-color">

        <MailSearch v-model:open="isMailSearchOpen" />


        <UDashboardSidebar
            id="default"
            collapsible
            resizable
            :ui="{
                header: 'main-bg-color',
                body: 'main-bg-color',
                content: 'main-bg-color',
                footer: 'border-t border-default main-bg-color',
            }"
            :min-size="18"
            :default-size="20"
            :max-size="30"
        >
            <template #header="{ collapsed }">
                <NuxtLink to="/" :class="`${!collapsed ? 'ms-2.5' : ''} flex items-center gap-1.5`">
                    <DelivrLogo v-if="!collapsed" class="h-8 w-auto flex-none" />
                    <DelivrIcon v-else class="h-8 w-8" />
                </NuxtLink >
            </template>

            <template #default="{ collapsed }">

                <!-- NOTE: Basic items removed for now, can be added back if needed in the future -->
                <!-- <UNavigationMenu
                        :collapsed="collapsed"
                        :items="sidebarItems.basic"
                        orientation="vertical"
                    /> -->

                <div
                    v-if="displaySidebars.mailSidebar"
                    class="flex flex-col flex-1 min-h-0 main-bg-color"
                >
                    <UNavigationMenu
                        :collapsed="collapsed"
                        :items="[{
                            label: 'Mail',
                            icon: 'i-lucide-mail',
                            type: 'label'
                        }]"
                        orientation="vertical"
                    />

                    <MailAccountsMenu :collapsed="collapsed" />

                    <!-- Compose Button - Prominent -->
                    <!-- <div v-if="currentMailAccount" class="px-2 mb-2">
                            <UButton
                                v-if="!collapsed"
                                icon="i-lucide-pen-square"
                                color="primary"
                                variant="solid"
                                size="md"
                                class="w-full justify-start"
                                :to="`/mail/${currentMailAccount.id}/compose`"
                            >
                                Compose
                            </UButton>
                            <UTooltip v-else text="Compose">
                                <UButton
                                    icon="i-lucide-pen-square"
                                    color="primary"
                                    variant="solid"
                                    size="md"
                                    :to="`/mail/${currentMailAccount.id}/compose`"
                                />
                            </UTooltip>
                        </div> -->

                    <!-- Drop zone: drag mails onto a folder to move them there. When
                         folder drag-and-drop is enabled, dragging a folder re-nests
                         it (onto another folder) or moves it to the top level (into
                         the clear space), so the zone grows to give a drop area. -->
                    <div
                        class="flex-1"
                        @dragstart="onFolderDragStart"
                        @dragover="onFolderDragOver"
                        @drop="onFolderDrop"
                        @dragleave="onFolderDragLeave"
                        @dragend="onFolderDragEnd"
                    >
                        <UNavigationMenu
                            :key="currentMailAccount?.id"
                            :collapsed="collapsed"
                            :items="sidebarItems.mail"
                            orientation="vertical"
                            class="mt-0"
                        />
                    </div>
                </div>


                <UNavigationMenu
                    v-if="displaySidebars.adminSidebar || displaySidebars.settingsSidebar"
                    :collapsed="collapsed"
                    :items="[{
                        label: 'Go back to Mails',
                        icon: 'i-lucide-arrow-left',
                        to: '/',
                    }]"
                    orientation="vertical"
                    class="mb-2"
                />

                <UNavigationMenu
                    v-if="isAdmin && displaySidebars.adminSidebar"
                    :collapsed="collapsed"
                    :items="sidebarItems.admin"
                    orientation="vertical"
                />

                <UNavigationMenu
                    v-if="displaySidebars.settingsSidebar"
                    :collapsed="collapsed"
                    :items="sidebarItems.settings"
                    orientation="vertical"
                />

                <UNavigationMenu
                    v-if="displaySidebars.mailSidebar"
                    :collapsed="collapsed"
                    :items="sidebarItems.footer"
                    orientation="vertical"
                />

            </template>

            <template #footer="{ collapsed }">
                <UserMenu :collapsed="collapsed" />
            </template>

        </UDashboardSidebar>

        <slot />

        <NotificationsSlideover />

        <!-- Confirmation for a drag-and-drop folder move. -->
        <DashboardModal
            v-model:open="folderMoveConfirmOpen"
            title="Move folder"
            icon="i-lucide-folder-input"
            icon-color="amber"
            @update:open="(value: boolean) => { if (!value) cancelFolderMove(); }"
        >
            <p class="text-sm text-muted">
                {{ pendingFolderMoveText }}
            </p>
            <p class="text-sm text-muted mt-2">
                Any sub-folders move with it.
            </p>

            <template #footer>
                <div class="flex justify-end gap-3">
                    <UButton
                        label="Cancel"
                        color="neutral"
                        variant="ghost"
                        @click="cancelFolderMove"
                    />
                    <UButton
                        label="Move folder"
                        color="primary"
                        icon="i-lucide-folder-input"
                        :loading="isMovingFolder"
                        @click="confirmFolderMove"
                    />
                </div>
            </template>
        </DashboardModal>

    </UDashboardGroup>
</template>

<!-- Not scoped: the highlighted element is a link rendered inside UNavigationMenu. -->
<style>
.mail-drop-target {
    outline: 2px solid var(--ui-primary);
    outline-offset: -2px;
    border-radius: var(--ui-radius, 0.375rem);
    background-color: color-mix(in oklch, var(--ui-primary) 12%, transparent);
}

/* Dropping a folder into the sidebar's clear space moves it to the top level. */
.folder-root-drop-target {
    outline: 2px dashed var(--ui-primary);
    /* outline-offset: -4px; */
    border-radius: 0.25rem;
    background-color: color-mix(in oklch, var(--ui-primary) 6%, transparent);
}
</style>
