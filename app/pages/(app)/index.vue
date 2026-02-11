<script setup lang="ts">
import type { TableColumn } from '#ui/types';
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