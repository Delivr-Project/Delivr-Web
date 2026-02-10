<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import MailAccountsMenu from '~/components/dashboard/MailAccountsMenu.vue';
import NotificationsSlideover from '~/components/dashboard/NotificationsSlideover.vue';
import UserMenu from '~/components/dashboard/UserMenu.vue';
import DelivrIcon from '~/components/img/DelivrIcon.vue';
import DelivrLogo from '~/components/img/DelivrLogo.vue';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import { useUserInfoStore } from '~/composables/stores/useUserStore';


const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();
const mailboxes = computed(() => currentMailAccount.value?.mailboxes || []);

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

    for (const mailbox of mailboxes.value) {
        if (mailbox.path.toLowerCase() === 'inbox') continue;

        const lowerPath = mailbox.path.toLowerCase();
        let icon = 'i-lucide-folder';
        if (lowerPath === 'sent' || lowerPath === 'sent mail' || lowerPath === 'sent messages') icon = 'i-lucide-send';
        else if (lowerPath === 'drafts') icon = 'i-lucide-file-edit';
        else if (lowerPath === 'trash' || lowerPath === 'deleted' || lowerPath === 'deleted messages') icon = 'i-lucide-trash-2';
        else if (lowerPath === 'spam' || lowerPath === 'junk') icon = 'i-lucide-shield-alert';
        else if (lowerPath === 'archive') icon = 'i-lucide-archive';

        mailItems.push({
            label: mailbox.name,
            icon,
            to: currentMailAccount.value ? `/mail/${currentMailAccount.value.id}/folder/${encodeURIComponent(mailbox.path)}` : undefined,
            badge: mailbox.status.unseen > 0 ? mailbox.status.unseen : undefined,
            exact: false,
        });
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
            to: "/mail-accounts",
            icon: "i-lucide-at-sign",
        },
        {
            label: "API Keys",
            to: "/apikeys",
            icon: "i-lucide-key",
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

const searchGroups = computed(() => [{
	id: 'links',
	label: 'Go to',
	items: Object.values(sidebarItems.value).flat()
}])


</script>

<template>
	<UDashboardGroup class="main-bg-color">

        <UDashboardSearch
            :groups="searchGroups"
            placeholder="Search..."
            title="Search"
            description="Search"
        />

		<UDashboardSidebar id="default"
			collapsible
			resizable
			:ui="{
                header: 'main-bg-color',
                body: 'main-bg-color',
                content: 'main-bg-color',
                footer: 'border-t border-default main-bg-color',
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
                    label="Search..."
				/>

                <UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems.basic"
                    orientation="vertical"
                />

                <div class="flex flex-col main-bg-color">
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
                    <div v-if="currentMailAccount" class="px-2 mb-2">
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
                    </div>
                    
                    <UNavigationMenu
                        :collapsed="collapsed"
                        :items="sidebarItems.mail"
                        orientation="vertical"
                        class="mt-0"
                    />
                </div>

                <UNavigationMenu
                    v-if="isAdmin"
                    :collapsed="collapsed"
                    :items="sidebarItems.admin"
                    orientation="vertical"
                    class="mt-auto"
                />

                <UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems.settings"
                    orientation="vertical"
                    :class="!isAdmin ? 'mt-auto' : ''"
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
