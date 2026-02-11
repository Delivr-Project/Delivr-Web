<script setup lang="ts">
import type { TableColumn } from '#ui/types';
import { useUserInfoStore } from '~/composables/stores/useUserStore';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';

useSeoMeta({
    title: 'Dashboard | Delivr',
    description: 'Overview of your emails'
});

const toast = useToast();

const userInfoStore = await useUserInfoStore();

const user = await userInfoStore.use();
if (!userInfoStore.isValid(user)) {
    throw new Error('User not authenticated but trying to access Dashboard')
}

const isAdmin = computed(() => user.value.role === 'admin')

// Get current mail account for quick actions
const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();

// Quick stats
const inboxCount = computed(() => {
    const inbox = currentMailAccount.value?.mailboxes?.find(mb => mb.path.toLowerCase() === 'inbox');
    return inbox?.status?.unseen || 0;
});

</script>

<template>
    <UDashboardPanel class="flex-1">
        <template #header>
            <DashboardPageHeader
                title="Dashboard"
                icon="i-lucide-layout-dashboard"
            >
                <template #trailing>
                    <span class="text-muted hidden sm:inline">Welcome back, {{ user.display_name }}</span>
                </template>
            </DashboardPageHeader>
        </template>

        <template #body>
            <DashboardPageBody>
                <!-- Quick Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <UCard v-if="currentMailAccount" :to="`/mail/${currentMailAccount.id}/folder/inbox`" class="hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer">
                        <div class="flex items-start justify-between">
                            <div>
                                <p class="text-sm text-muted mb-1">Unread Emails</p>
                                <p class="text-3xl font-bold text-primary">{{ inboxCount }}</p>
                            </div>
                            <div class="p-2 rounded-lg bg-primary/10">
                                <UIcon name="i-lucide-inbox" class="w-6 h-6 text-primary" />
                            </div>
                        </div>
                    </UCard>

                    <UCard :to="`/mail/${currentMailAccount?.id}/compose`" class="hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer">
                        <div class="flex items-start justify-between">
                            <div>
                                <p class="text-sm text-muted mb-1">Compose</p>
                                <p class="text-lg font-medium">New Email</p>
                            </div>
                            <div class="p-2 rounded-lg bg-sky-500/10">
                                <UIcon name="i-lucide-pen-square" class="w-6 h-6 text-sky-500" />
                            </div>
                        </div>
                    </UCard>

                    <UCard to="/mail-accounts" class="hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer">
                        <div class="flex items-start justify-between">
                            <div>
                                <p class="text-sm text-muted mb-1">Mail Accounts</p>
                                <p class="text-lg font-medium">Manage</p>
                            </div>
                            <div class="p-2 rounded-lg bg-violet-500/10">
                                <UIcon name="i-lucide-at-sign" class="w-6 h-6 text-violet-500" />
                            </div>
                        </div>
                    </UCard>

                    <UCard to="/settings" class="hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer">
                        <div class="flex items-start justify-between">
                            <div>
                                <p class="text-sm text-muted mb-1">Settings</p>
                                <p class="text-lg font-medium">Configure</p>
                            </div>
                            <div class="p-2 rounded-lg bg-slate-500/10">
                                <UIcon name="i-lucide-settings" class="w-6 h-6 text-slate-500" />
                            </div>
                        </div>
                    </UCard>
                </div>

                <!-- Quick Actions Section -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold flex items-center gap-2">
                        <UIcon name="i-lucide-zap" class="w-5 h-5 text-amber-500" />
                        Quick Actions
                    </h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <UCard v-if="currentMailAccount" class="p-4">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 rounded-lg bg-primary/10">
                                        <UIcon name="i-lucide-inbox" class="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p class="font-medium">Go to Inbox</p>
                                        <p class="text-sm text-muted">View your latest emails</p>
                                    </div>
                                </div>
                                <UButton
                                    icon="i-lucide-arrow-right"
                                    color="primary"
                                    variant="ghost"
                                    :to="`/mail/${currentMailAccount.id}/folder/inbox`"
                                />
                            </div>
                        </UCard>

                        <UCard class="p-4">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 rounded-lg bg-violet-500/10">
                                        <UIcon name="i-lucide-key" class="w-5 h-5 text-violet-500" />
                                    </div>
                                    <div>
                                        <p class="font-medium">API Keys</p>
                                        <p class="text-sm text-muted">Manage your API access</p>
                                    </div>
                                </div>
                                <UButton
                                    icon="i-lucide-arrow-right"
                                    color="neutral"
                                    variant="ghost"
                                    to="/apikeys"
                                />
                            </div>
                        </UCard>
                    </div>
                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>