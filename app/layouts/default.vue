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
import { buildMailboxTree, folderUrl, type MailboxTreeNode } from '~/utils/mailboxDisplay';

const route = useRoute();

// Original folder icon logic: match the full lowercased mailbox path.
function folderIconFor(node: MailboxTreeNode): string {
    const lowerPath = node.mailbox?.path.toLowerCase();
    if (lowerPath === 'sent' || lowerPath === 'sent mail' || lowerPath === 'sent messages') return 'i-lucide-send';
    if (lowerPath === 'drafts') return 'i-lucide-file-edit';
    if (lowerPath === 'trash' || lowerPath === 'deleted' || lowerPath === 'deleted messages') return 'i-lucide-trash-2';
    if (lowerPath === 'spam' || lowerPath === 'junk') return 'i-lucide-shield-alert';
    if (lowerPath === 'archive') return 'i-lucide-archive';
    return 'i-lucide-folder';
}

// Does the active route point at this node or any of its descendants?
// Used to auto-expand the ancestors of the folder currently being viewed.
function subtreeContainsActive(node: MailboxTreeNode, accountId: number): boolean {
    if (node.mailbox && route.path === folderUrl(accountId, node.mailbox)) return true;
    return node.children.some((child) => subtreeContainsActive(child, accountId));
}

// Map a folder-tree node to a (possibly nested) navigation menu item.
function toNavItem(node: MailboxTreeNode, accountId: number): NavigationMenuItem {
    const unseen = node.mailbox ? node.mailbox.status.unseen : node.unseenTotal;
    const item: NavigationMenuItem = {
        label: node.name,
        icon: folderIconFor(node),
        badge: unseen > 0 ? unseen : undefined,
        exact: false,
    };
    if (node.mailbox) {
        item.to = folderUrl(accountId, node.mailbox);
    }
    if (node.children.length > 0) {
        item.children = node.children.map((child) => toNavItem(child, accountId));
        item.defaultOpen = subtreeContainsActive(node, accountId);
    }
    return item;
}

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();
const mailboxes = computed(() => currentMailAccount.value?.mailboxes || []);

const { isMailSearchOpen } = useDashboard();

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
        for (const node of buildMailboxTree(mailboxes.value)) {
            mailItems.push(toNavItem(node, accountId));
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
            label: "Security",
            icon: "i-lucide-shield",
            to: "/settings/security",
        },
        {
            label: "Manage Mail Accounts",
            to: "/settings/mail-accounts",
            icon: "i-lucide-at-sign",
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
            :min-size="10"
            :default-size="18"
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

                    <UNavigationMenu
                        :collapsed="collapsed"
                        :items="sidebarItems.mail"
                        orientation="vertical"
                        class="mt-0"
                    />
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
