<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import TopNavbar from '~/components/dashboard/TopNavbar.vue';
import MailSidebar from '~/components/dashboard/MailSidebar.vue';
import NotificationsSlideover from '~/components/dashboard/NotificationsSlideover.vue';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import { useUserInfoStore } from '~/composables/stores/useUserStore';

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();
const mailboxes = computed(() => currentMailAccount.value?.mailboxes || []);

// Build search groups for the command palette
const searchGroups = computed(() => {
    const items: NavigationMenuItem[] = [
        {
            label: "Overview",
            icon: "i-lucide-layout-dashboard",
            to: "/",
        },
    ];

    // Add mail folders to search
    if (currentMailAccount.value) {
        for (const mailbox of mailboxes.value) {
            const lowerPath = mailbox.path.toLowerCase();
            let icon = 'i-lucide-folder';
            if (lowerPath === 'inbox') icon = 'i-lucide-inbox';
            else if (lowerPath === 'sent' || lowerPath === 'sent mail') icon = 'i-lucide-send';
            else if (lowerPath === 'drafts') icon = 'i-lucide-file-edit';
            else if (lowerPath === 'trash' || lowerPath === 'deleted') icon = 'i-lucide-trash-2';
            else if (lowerPath === 'spam' || lowerPath === 'junk') icon = 'i-lucide-shield-alert';
            else if (lowerPath === 'archive') icon = 'i-lucide-archive';

            items.push({
                label: mailbox.name,
                icon,
                to: `/mail/${currentMailAccount.value.id}/folder/${encodeURIComponent(mailbox.path)}`,
            });
        }
    }

    // Add settings pages
    items.push(
        { label: "Settings", icon: "i-lucide-settings", to: "/settings" },
        { label: "Security", icon: "i-lucide-shield", to: "/settings/security" },
        { label: "Mail Accounts", icon: "i-lucide-at-sign", to: "/mail-accounts" },
        { label: "API Keys", icon: "i-lucide-key", to: "/apikeys" },
    );

    // Add admin pages if admin
    if (isAdmin.value) {
        items.push({ label: "Admin: Users", icon: "i-lucide-users", to: "/admin/users" });
    }

    return [{
        id: 'pages',
        label: 'Go to',
        items
    }];
});

// Provide search groups for TopNavbar
provide('searchGroups', searchGroups);
</script>

<template>
    <UDashboardGroup class="main-bg-color flex-col">
        <!-- Command Palette / Search -->
        <UDashboardSearch
            :groups="searchGroups"
            placeholder="Search mail, settings, pages..."
            title="Search"
            description="Quick navigation"
        />

        <!-- Top Navbar - Gmail/GitLab style -->
        <TopNavbar sidebar-id="mail" />

        <!-- Main content area with sidebar -->
        <div class="flex flex-1 overflow-hidden">
            <!-- Slim Sidebar - Mail navigation only -->
            <UDashboardSidebar
                id="mail"
                collapsible
                :ui="{
                    header: 'hidden',
                    body: 'main-bg-color',
                    content: 'main-bg-color',
                    footer: 'hidden',
                }"
                :min-size="14"
                :default-size="16"
                :max-size="22"
            >
                <template #default="{ collapsed }">
                    <MailSidebar :collapsed="collapsed" />
                </template>
            </UDashboardSidebar>

            <!-- Main content slot -->
            <div class="flex-1 flex overflow-hidden">
                <slot />
            </div>
        </div>

        <!-- Notifications Slideover -->
        <NotificationsSlideover />
    </UDashboardGroup>
</template>
