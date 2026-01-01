<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import UserMenu from "~/components/dashboard/UserMenu.vue";
import DelivrLogo from "~/components/img/DelivrLogo.vue";
import DelivrIcon from "~/components/img/DelivrIcon.vue";
import { UserStore } from "~/utils/stores/userStore";

const user = await UserStore.use();

const isAdmin = computed(() => user.value?.role === "admin");

const sidebarItems = computed<NavigationMenuItem[][]>(() => {
    const devItems: NavigationMenuItem[] = [
        {
            label: "Overview",
            icon: "i-lucide-layout-dashboard",
            to: "/dashboard",
        },
        {
            label: "Packages",
            icon: "i-lucide-package",
            to: "/dashboard/packages",
        },
        {
            label: "Tasks",
            icon: "i-lucide-list-checks",
            to: "/dashboard/tasks",
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
            // defaultOpen: route.path.startsWith("/dashboard/admin"),
            // children: [
            //     {
            //         label: "Stable Requests",
            //         to: "/dashboard/admin/requests",
            //     },
            //     {
            //         label: "Users",
            //         to: "/dashboard/admin/users",
            //     },
            //     {
            //         label: "All Packages",
            //         to: "/dashboard/admin/packages",
            //     },
            // ],
        },
        {
            label: "Users",
            icon: "i-lucide-users",
            to: "/dashboard/admin/users",
        },
        {
            label: "All Packages",
            icon: "i-lucide-package-search",
            to: "/dashboard/admin/packages",
        },
        {
            label: "Stable Requests",
            icon: "i-lucide-git-pull-request",
            to: "/dashboard/admin/requests",
        },
        {
            label: "OS Releases",
            icon: "i-lucide-rocket",
            to: "/dashboard/admin/os-releases",
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
            to: "/explore",
        },
        {
            label: "Back to Home",
            icon: "i-lucide-home",
            to: "/",
        },
    ];

    return [[...devItems, ...adminItems, ...settings], footerItems];
});


</script>

<template>
    <NuxtLoadingIndicator
        color="#00bcff"
        position="top"
    />

    <UDashboardGroup class="app-layout-dashboard">
        <UDashboardSidebar
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
                <NuxtLink to="/" class="lg:ms-2.5 flex items-center gap-1.5">
                    <DelivrLogo v-if="!collapsed" class="h-6 w-auto flex-none" />
                    <span v-if="!collapsed" class="text-lg font-semibold">/</span>
                    <span v-if="!collapsed" class="text-lg font-semibold">Hub</span>
                    <DelivrIcon v-else class="h-8 w-8" />
                </NuxtLink>
            </template>

            <template #default="{ collapsed }">
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
                <UserMenu :collapsed="collapsed"></UserMenu>
            </template>
        </UDashboardSidebar>

        <slot />
    </UDashboardGroup>
</template>

