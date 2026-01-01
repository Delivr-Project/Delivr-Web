<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { UserStore } from '~/utils/stores/userStore';

const route = useRoute()

const user = await UserStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const sidebarItems = computed<NavigationMenuItem[][]>(() => {
    const basicItems: NavigationMenuItem[] = [
        {
            label: "Overview",
            icon: "i-lucide-layout-dashboard",
            to: "/",
        },
		{
			label: "Emails",
			icon: "i-lucide-mail",
			to: "/emails/inbox",
		},
        {
            label: "Chats",
            icon: "i-lucide-package",
            to: "/chats",
        },
        {
            label: "Meine Aufgaben",
            icon: "i-lucide-list-checks",
            to: "/my-tasks",
        },
    ];
    const settings: NavigationMenuItem[] = [
        {
            type: "label",
            class: "mt-4 pt-3 border-t-2 border-default",
        },
        {
            label: "Settings",
            to: "/dashboard/settings",
            icon: "i-lucide-settings",
            defaultOpen: true,
            type: "trigger",
            children: [
                {
                    label: "General",
                    to: "/dashboard/settings",
                    exact: true,
                },
                {
                    label: "Security",
                    to: "/dashboard/settings/security",
                },
            ],
        },
    ];

    const adminItems: NavigationMenuItem[] = isAdmin.value ? [
        {
            label: "Admin",
            icon: "i-lucide-shield",
            type: "label",
            class: "mt-4 pt-4 border-t-2 border-default",
        },
        {
            label: "Users",
            icon: "i-lucide-users",
            to: "/dashboard/admin/users",
        },
        {
            label: "Alle Freizeiten",
            icon: "i-lucide-package-search",
            to: "/dashboard/admin/packages",
        },
        {
            label: "Tasks",
            icon: "i-lucide-list-checks",
            to: "/dashboard/admin/tasks",
        }
    ] : [];

    const footerItems: NavigationMenuItem[] = [
        {
            label: "Explorer",
            icon: "i-lucide-compass",
            to: "/explorer",
        },
        {
            label: "Back to Home",
            icon: "i-lucide-home",
            to: "/",
        },
    ];

    return [[...basicItems], [...adminItems, ...settings], [...footerItems]];
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
				<h1
					class="text-lg font-semibold"
					v-if="!collapsed"
				>
                    Delivr Dashboard
                </h1>
			</template>

			<template #default="{ collapsed }">
				
				<UDashboardSearchButton
					:collapsed="collapsed"
					class="bg-transparent ring-default"
				/>

				<UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems[0]"
                    orientation="vertical"
					class="mb-4 pb-4 border-b-2 border-default"
                />

				<CampsMenu :collapsed="collapsed" />

                <UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems[1]"
                    orientation="vertical"
                />

                <UNavigationMenu
                    :collapsed="collapsed"
                    :items="sidebarItems[2]"
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
