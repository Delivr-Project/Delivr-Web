<script setup lang="ts">
import type { TableColumn } from '#ui/types';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import { useUserInfoStore } from '~/composables/stores/useUserStore';

useSeoMeta({
    title: 'Admin Panel | Delivr',
    description: 'Overview of your admin panel'
});

const toast = useToast();

const userInfoStore = await useUserInfoStore();

const user = await userInfoStore.use();
if (!userInfoStore.isValid(user)) {
    throw new Error('User not authenticated but trying to access Admin Panel')
}

const isAdmin = computed(() => user.value.role === 'admin');

if (!isAdmin.value) {
    toast.add({
        title: 'Access Denied',
        description: 'You do not have permission to access the Admin Panel.',
        icon: 'i-lucide-alert-triangle',
        color: 'error',
    });
    navigateTo('/');
} else {
    // navigate to /admin/users as default admin page for now
    navigateTo('/admin/users');
}

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="Admin Panel"
                icon="i-lucide-shield"
            />
        </template>

        <template #body>
            <DashboardPageBody>
                
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>