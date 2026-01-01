<script setup lang="ts">
import type { TableColumn } from '#ui/types';
import { UserStore } from '~/utils/stores/userStore';
useSeoMeta({
    title: 'Dashboard | Delivr',
    description: 'Overview of your emails'
});

const toast = useToast();

const user = await UserStore.use();
if (!UserStore.isValid(user)) {
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
            <DashboardPageBody></DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>