<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import MailAccountsMenu from '~/components/dashboard/MailAccountsMenu.vue';
import MailSearch from '~/components/dashboard/MailSearch.vue';
import NotificationsSlideover from '~/components/dashboard/NotificationsSlideover.vue';
import UserMenu from '~/components/dashboard/UserMenu.vue';
import DelivrIcon from '~/components/img/DelivrIcon.vue';
import DelivrLogo from '~/components/img/DelivrLogo.vue';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import { useUserInfoStore } from '~/composables/stores/useUserStore';
import { MailboxDisplayUtils } from '~/utils/mailboxDisplay';
import { useMailDrag } from '~/composables/useMailDrag';
import type { Mailbox } from '~/utils/types';

const route = useRoute();



const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();
const mailboxes = computed(() => currentMailAccount.value?.mailboxes || []);

const { isMailSearchOpen } = useDashboard();

// ── Drag & drop: sidebar folders act as drop targets for mails ──
// The folder tree is rendered by UNavigationMenu, so instead of custom folder
// components we delegate off the rendered <a href="…/folder/…"> links.

const { dragging, dropOnMailbox } = useMailDrag();

let highlightedEl: HTMLElement | null = null;
function setHighlight(el: HTMLElement | null) {
    if (highlightedEl === el) return;
    highlightedEl?.classList.remove('mail-drop-target');
    highlightedEl = el;
    highlightedEl?.classList.add('mail-drop-target');
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

function onFolderDragOver(e: DragEvent) {
    if (!dragging.value) return;
    const target = resolveDropTarget(e);
    if (target && target.mailbox.path !== dragging.value.sourceFolderPath) {
        e.preventDefault(); // mark as a valid drop zone
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        setHighlight(target.anchor);
    } else {
        setHighlight(null);
    }
}

function onFolderDrop(e: DragEvent) {
    setHighlight(null);
    if (!dragging.value) return;
    const target = resolveDropTarget(e);
    if (!target) return;
    e.preventDefault();
    dropOnMailbox(target.mailbox);
}

// Clear the highlight when the drag ends or leaves the folder area entirely.
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

    if (mailboxes.value.length === 0) {
        mailItems.push({
            label: 'No Folders to show',
            icon: 'i-lucide-mail',
            exact: false,
        });
    } else if (inbox) {
        mailItems.push({
            label: 'Inbox',
            icon: 'i-lucide-inbox',
            to: currentMailAccount.value ? `/mail/${currentMailAccount.value.id}/folder/inbox` : undefined,
            badge: inbox.status.unseen > 0 ? inbox.status.unseen : undefined,
            exact: false,
        });
    }

    // Build the remaining folders as a nested tree (Inbox is pinned above).
    // Hierarchy, leaf names and delimiters are all derived in buildMailboxTree.
    const accountId = currentMailAccount.value?.id;
    if (accountId !== undefined) {
        for (const node of MailboxDisplayUtils.buildMailboxTree(mailboxes.value)) {
            mailItems.push(MailboxDisplayUtils.toNavItem(route.path, node, accountId));
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
        // {
        //     label: "Back to Home",
        //     icon: "i-lucide-home",
        //     to: "/",
        // },
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
                    class="flex flex-col main-bg-color"
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

                    <!-- Drop zone: dragging mails onto a folder link moves them there. -->
                    <div
                        @dragover="onFolderDragOver"
                        @drop="onFolderDrop"
                        @dragleave="onFolderDragLeave"
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

                <!-- <UNavigationMenu
                        :collapsed="collapsed"
                        :items="sidebarItems.footer"
                        orientation="vertical"
                    /> -->

            </template>

            <template #footer="{ collapsed }">
                <UserMenu :collapsed="collapsed" />
            </template>

        </UDashboardSidebar>

        <slot />

        <NotificationsSlideover />

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
</style>
