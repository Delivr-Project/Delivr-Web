<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import MailAccountsMenu from '~/components/dashboard/MailAccountsMenu.vue';
import UserMenu from '~/components/dashboard/UserMenu.vue';
import DelivrIcon from '~/components/img/DelivrIcon.vue';
import DelivrLogo from '~/components/img/DelivrLogo.vue';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';


const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();
const mailboxes = computed(() => currentMailAccount.value?.mailboxes || []);

const sidebarItems = computed<NavigationMenuItem[][]>(() => {

    const basicItems: NavigationMenuItem[] = [
        {
            label: "Overview",
            icon: "i-lucide-layout-dashboard",
            to: "/",
        },
		{
			label: "Inbox",
			icon: "i-lucide-mail",
			to: currentMailAccount.value ? `/mail/${currentMailAccount.value.id}/folder/inbox` : undefined,
            badge: mailboxes.value?.find(mb => mb.path.toLowerCase() === 'inbox')?.status.unseen || 0,
            exact: false,
		}
    ];

    for (const mailbox of mailboxes.value || []) {
        if (mailbox.path.toLowerCase() === 'inbox') continue;

        basicItems.push({
            label: mailbox.name,
            icon: "i-lucide-folder",
            to: currentMailAccount.value ? `/mail/${currentMailAccount.value.id}/folder/${encodeURIComponent(mailbox.path)}` : undefined,
            badge: mailbox.status.unseen || 0,
            exact: false,
        });
    }

    const adminItems: NavigationMenuItem[] = isAdmin.value ? [
        {
            label: "Admin",
            icon: "i-lucide-shield",
            type: "label",
            // class: "mt-4 pt-4 border-t-2 border-default",
        },
        {
            label: "Users",
            icon: "i-lucide-users",
            to: "/admin/users",
        }
    ] : [];

    const settings: NavigationMenuItem[] = [
        {
            type: "label",
            class: "mt-4 pt-3 border-t-2 border-default",
        },

        {
            label: "Manage Mail Accounts",
            to: "/mail-accounts",
            icon: "i-lucide-at-sign",
        },

        {
            label: "Settings",
            to: "/settings",
            icon: "i-lucide-settings",
            defaultOpen: true,
            type: "trigger",
            children: [
                {
                    label: "General",
                    to: "/settings",
                    exact: true,
                },
                {
                    label: "Security",
                    to: "/settings/security",
                },
            ],
        },
    ];

    const footerItems: NavigationMenuItem[] = [
        {
            label: "Explorer",
            icon: "i-lucide-compass",
            to: "/explorer",
            class: "mt-4 pt-4 border-t-2 border-default",
        },
        {
            label: "Back to Home",
            icon: "i-lucide-home",
            to: "/",
        },
    ];

    return [[...basicItems], [...adminItems, ...settings, ...footerItems]];
});

const groups = computed(() => [{
	id: 'links',
	label: 'Go to',
	items: sidebarItems.value.flat()
}])


</script>

<template>
	<UDashboardGroup>
		<UDashboardSidebar id="default"
			collapsible
			resizable
			:ui="{
				footer: 'lg:border-t lg:border-default'
			}"
			:min-size="18"
            :default-size="18"
            :max-size="30"
		>
			<template #header="{ collapsed }">
                <div :class="`${!collapsed ? 'ms-2.5' : ''} flex items-center gap-1.5`">
                    <DelivrLogo v-if="!collapsed" class="h-8 w-auto flex-none" />
                    <DelivrIcon v-else class="h-8 w-8" />
                </div>
			</template>

			<template #default="{ collapsed }">
				
				<UDashboardSearchButton
					:collapsed="collapsed"
					class="bg-transparent ring-default"
				/>

                <MailAccountsMenu :collapsed="collapsed" />

                <UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems[0]"
                    orientation="vertical"
                />

                <UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems[1]"
                    orientation="vertical"
                    class="mt-auto"
                />
            </template>

			<template #footer="{ collapsed }">
				<UserMenu :collapsed="collapsed" />
			</template>

		</UDashboardSidebar>

		<UDashboardSearch :groups="groups" />

		<slot />

		<NotificationsSlideover />
	</UDashboardGroup>
</template>
