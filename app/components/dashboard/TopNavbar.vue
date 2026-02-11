<script setup lang="ts">
import DelivrLogo from '~/components/img/DelivrLogo.vue';
import { useUserInfoStore } from '~/composables/stores/useUserStore';
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui';

const props = defineProps<{
    sidebarId?: string;
}>();

const emit = defineEmits<{
    (e: 'toggle-sidebar'): void;
}>();

const userInfoStore = useUserInfoStore();
const user = await userInfoStore.use();

const isAdmin = computed(() => user.value?.role === 'admin');

const toast = useToast();

// User dropdown items
const userDropdownItems = computed<DropdownMenuItem[][]>(() => {
    const baseItems: DropdownMenuItem[][] = [
        [
            {
                type: 'label',
                label: user.value?.display_name || 'User',
            },
        ],
        [
            {
                label: 'Settings',
                icon: 'i-lucide-settings',
                to: '/settings',
            },
            {
                label: 'Security',
                icon: 'i-lucide-shield',
                to: '/settings/security',
            },
        ],
        [
            {
                label: 'Manage Mail Accounts',
                icon: 'i-lucide-at-sign',
                to: '/mail-accounts',
            },
            {
                label: 'API Keys',
                icon: 'i-lucide-key',
                to: '/apikeys',
            },
        ],
    ];

    // Add admin section if user is admin
    if (isAdmin.value) {
        baseItems.push([
            {
                label: 'Admin: Users',
                icon: 'i-lucide-users',
                to: '/admin/users',
            },
        ]);
    }

    baseItems.push([
        {
            label: 'Documentation',
            icon: 'i-lucide-book-open',
            to: 'https://github.com/Delivr-Project',
            target: '_blank',
        },
        {
            label: 'GitHub',
            icon: 'i-simple-icons-github',
            to: 'https://github.com/Delivr-Project',
            target: '_blank',
        },
    ]);

    baseItems.push([
        {
            label: 'Logout',
            icon: 'i-lucide-log-out',
            color: 'error' as const,
            onSelect: logout,
        },
    ]);

    return baseItems;
});

async function logout() {
    try {
        const result = await useAPI((api) => api.postAuthLogout({}));
        await userInfoStore.clear();
        useAppCookies().sessionToken.get().value = null;

        if (!result.success) {
            toast.add({
                title: 'Error',
                description: result.message || 'An error occurred during logout.',
                icon: 'i-lucide-alert-circle',
                color: 'error',
            });
            return;
        }

        toast.add({
            title: 'Logged out',
            description: 'You have been successfully logged out.',
            icon: 'i-lucide-check',
            color: 'success',
        });

        await navigateTo('/auth/login');
    } catch (error) {
        toast.add({
            title: 'Error',
            description: 'An unexpected error occurred during logout.',
            icon: 'i-lucide-alert-circle',
            color: 'error',
        });
    }
}

// Search placeholder items for command palette
const { isNotificationsSlideoverOpen } = useDashboard();

// Search groups - will be populated from parent component or via provide/inject
const searchGroups = inject<Ref<any[]>>('searchGroups', ref([]));
</script>

<template>
    <header class="h-14 flex items-center gap-4 px-4 border-b border-default main-bg-color shrink-0">
        <!-- Left: Menu toggle + Logo -->
        <div class="flex items-center gap-3">
            <UDashboardSidebarToggle v-if="sidebarId" class="lg:hidden" />
            <UDashboardSidebarCollapse v-if="sidebarId" class="hidden lg:flex" />
            
            <NuxtLink to="/" class="flex items-center">
                <DelivrLogo class="h-7 w-auto" />
            </NuxtLink>
        </div>

        <!-- Center: Search bar -->
        <div class="flex-1 flex justify-center max-w-2xl mx-auto">
            <UDashboardSearchButton
                class="w-full max-w-md bg-elevated/50 ring-1 ring-default hover:bg-elevated transition-colors"
                label="Search mail, settings, pages..."
                icon="i-lucide-search"
            />
        </div>

        <!-- Right: Actions + User menu -->
        <div class="flex items-center gap-2">
            <!-- Notifications -->
            <UTooltip text="Notifications">
                <UButton
                    icon="i-lucide-bell"
                    color="neutral"
                    variant="ghost"
                    size="md"
                    @click="isNotificationsSlideoverOpen = true"
                />
            </UTooltip>

            <!-- Settings quick access -->
            <UTooltip text="Settings">
                <UButton
                    icon="i-lucide-settings"
                    color="neutral"
                    variant="ghost"
                    size="md"
                    to="/settings"
                />
            </UTooltip>

            <!-- User dropdown -->
            <UDropdownMenu :items="userDropdownItems">
                <UButton color="neutral" variant="ghost" class="p-0.5">
                    <UAvatar
                        :alt="user?.display_name || 'User'"
                        size="sm"
                    />
                </UButton>
            </UDropdownMenu>
        </div>
    </header>
</template>
