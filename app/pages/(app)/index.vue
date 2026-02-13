<script setup lang="ts">
import type { TableColumn } from '#ui/types';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import { useUserInfoStore } from '~/composables/stores/useUserStore';

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

const selectMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await selectMailAccountStore.use();
if (currentMailAccount.value) {
    navigateTo(`/mail/${currentMailAccount.value.id}/folder/inbox`);
} else {
    // No mail account selected, navigate to mail accounts page to add one
    navigateTo('/mail-accounts');
}

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="Dashboard"
                icon="i-lucide-layout-dashboard"
            />
        </template>

        <template #body>
            <DashboardPageBody>
                not used for now
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>