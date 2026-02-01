<script setup lang="ts">
import type { MailAccount } from '~/utils/types';
import type { TableColumn } from '@nuxt/ui'
import type DashboardPageHeaderVue from '~/components/dashboard/DashboardPageHeader.vue';
import DashboardPageBody from '~/components/dashboard/DashboardPageBody.vue';
import { MailAccountsStore } from '~/utils/stores/mailAccountsStore';

const toast = useToast();

useSeoMeta({
    title: 'Manage Mail Accounts | Delivr',
    description: 'Manage all your mail accounts used for sending and receiving emails.'
});

const mailAccounts = await MailAccountsStore.use();
const loading = MailAccountsStore.isLoading;
function refresh() {
    return MailAccountsStore.refresh()
}

const mailAccountsTableColumns: TableColumn<MailAccount>[] = [
    { accessorKey: 'display_name', header: 'Display Name' },
    { accessorKey: 'created_at', header: 'Created At' },
    { accessorKey: 'is_default', header: 'Is Default' }
]

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <!-- <UDashboardNavbar title="OS Releases" icon="i-lucide-rocket">
                <template #trailing>
                    <span class="text-slate-400 hidden sm:inline"> | Manage all OS releases</span>
                </template>
            </UDashboardNavbar> -->
            <DashboardPageHeader
                title="Manage Mail Accounts"
                icon="i-lucide-at-sign"
                description="Manage Mail Accounts"
            />
        </template>

        <template #body>
            <DashboardPageBody>
                <DashboardDataTable
                    :data="mailAccounts || []"
                    :columns="mailAccountsTableColumns"
                    :loading="loading"
                    empty-title="No Mail Accounts Connected"
                    empty-description="Connect an email account to start sending emails."
                    empty-icon="i-lucide-mail"
                    @refresh="refresh()"
                >
                    <template #header-right>
                        <UButton
                            label="Add Mail Account"
                            icon="i-lucide-plus"
                            color="primary"
                            to="/mail-accounts/new"
                        />
                    </template>


                    <template #display_name-cell="{ row }">
                        <NuxtLink
                            :to="`/mail-accounts/${row.original.id}`"
                            class="font-medium text-primary-400 hover:underline"
                        >
                            {{ row.original.display_name }}
                        </NuxtLink>
                    </template>

                    <template #created_at-cell="{ row }">
                        <span class="text-sm">
                            {{ new Date(row.original.created_at).toLocaleString() }}
                        </span>
                    </template>

                    <template #is_default-cell="{ row }">
                        <UBadge
                            :label="row.original.is_default ? 'Yes' : 'No'"
                            :color="row.original.is_default ? 'success' : 'neutral'"
                            variant="subtle"
                        />
                    </template>
                    <template #empty-actions>
                        <UButton
                            label="Add Mail Account"
                            color="primary"
                            to="/mail-accounts/new"
                        />
                    </template>
                </DashboardDataTable>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>
