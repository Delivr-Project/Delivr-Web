<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

useSeoMeta({
    title: 'API Keys | Delivr',
    description: 'Manage your API keys'
});

const toast = useToast();

const apikeysTableColumns: TableColumn<APIKey>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "description", header: "Description" },
    { accessorKey: "created_at", header: "Created At" },
    { accessorKey: "expires_at", header: "Expires At" },
    { accessorKey: "status", header: "Status" },
    // implement later
    // { accessorKey: "last_used_at", header: "Last Used At" },
    { accessorKey: "actions", header: "" },
];

const apiKeys = await useAPIAsyncData<APIKey[]>(
    '/account/apikeys',
    async () => {
        const res = await useAPI((api) => api.getAccountApikeys({}));
        if (!res.success) {
            toast.add({ title: 'Failed to load API Keys', description: res.message, color: 'error' });
            return [];
        }

        // res.data.push({
        //     id: "demo-key",
        //     description: 'Demo API Key',
        //     created_at: Date.now() - 1000 * 60 * 60 * 24 * 30,
        //     expires_at: Date.now() + 1000 * 60 * 60 * 24 * 335,
        //     // last_used_at: Date.now() - 1000 * 60 * 60 * 24 * 1,
        // });

        // res.data.push({
        //     id: "expired-key",
        //     description: 'Expired API Key',
        //     created_at: Date.now() - 1000 * 60 * 60 * 24 * 60,
        //     expires_at: Date.now() - 1000 * 60 * 60 * 24 * 30,
        //     // last_used_at: Date.now() - 1000 * 60 * 60 * 24 * 31,
        // });

        // res.data.push({
        //     id: "never-expire-key",
        //     description: 'Never Expire API Key',
        //     created_at: Date.now() - 1000 * 60 * 60 * 24 * 10,
        //     expires_at: null,
        //     // last_used_at: Date.now() - 1000 * 60 * 60 * 24 * 2,
        // });

        return res.data;
    }
);

const deleteConfirmOpen = ref(false);
const latestOnDeleteClickAPIKeyId = ref<string | null>(null);

async function onDeleteApiKey() {

    try {

        if (!latestOnDeleteClickAPIKeyId.value) {
            throw new Error('No API Key ID specified for deletion.');
        }

        const res = await useAPI((api) => api.deleteAccountApikeysByApiKeyId({
            path: {
                apiKeyID: latestOnDeleteClickAPIKeyId.value as string
            }
        }));

        if (res.success) {

            toast.add({
                title: 'API Key deleted',
                description: 'The API Key has been successfully deleted.',
                color: 'success'
            });

            // Refresh the API keys list
            await apiKeys.refresh();

            deleteConfirmOpen.value = false;

        } else {
            throw new Error(res.message || 'Failed to delete API Key.');
        }

    } catch (error: any) {
        toast.add({
            title: 'Failed to delete API Key',
            description: error.message || 'An unknown error occurred.',
            icon: 'i-lucide-alert-circle',
            color: 'error'
        });
    }
}

</script>

<template>
    <UDashboardPanel class="flex-1">
        <template #header>
            <DashboardPageHeader
                title="API Keys"
                icon="i-lucide-key"
                description="Manage your API keys"
            >
                <template #leading>
                    <UButton
                        icon="i-lucide-arrow-left"
                        color="neutral"
                        variant="ghost"
                        to="/"
                        class="mr-2"
                    />
                </template>
            </DashboardPageHeader>
        </template>

        <template #body>
            <DashboardPageBody>


                 <DashboardDataTable
                    :data="apiKeys.data"
                    :columns="apikeysTableColumns"
                    :loading="apiKeys.loading"
                    :filters="[
                        { 
                            column: 'description', 
                            type: 'text',
                            placeholder: 'Search description...', 
                            icon: 'i-lucide-search' 
                        }
                    ]"
                    empty-title="No API keys"
                    empty-description="Create your first API key to get started."
                    empty-icon="i-lucide-key"
                    @refresh="apiKeys.refresh()"
                >

                    <template #header-right>
                        <UButton
                            label="New API Key"
                            icon="i-lucide-plus"
                            color="primary"
                            to="/apikeys/new"
                        />
                    </template>


                    <template #id-cell="{ row }">
                        <NuxtLink
                            :to="`/apikeys/${row.original.id}`"
                            class="font-medium text-sky-400 hover:underline"
                        >
                            {{ row.original.id }}
                        </NuxtLink>
                    </template>
                    
                    <template #description-cell="{ row }">
                        <span class="text-slate-400 line-clamp-1 max-w-xs">
                            {{ row.original.description || '—' }}
                        </span>
                    </template>

                    <template #created_at-cell="{ row }">
                        <span class="text-sm">
                            {{ new Date(row.original.created_at).toLocaleString() }}
                        </span>
                    </template>
                    

                    <template #expires_at-cell="{ row }">
                        <span v-if="row.original.expires_at" class="text-sm" :class="new Date(row.original.expires_at) < new Date() ? 'text-red-500' : ''">
                            {{ new Date(row.original.expires_at).toLocaleString() }}
                        </span>
                        <span v-else class="text-sm text-slate-400">
                            Never
                        </span>
                    </template>

                    <template #status-cell="{ row }">
                        <UBadge
                            v-if="row.original.expires_at ? new Date(row.original.expires_at) < new Date() : false"
                            :color="'error'"
                            variant="soft"
                            size="sm"
                        >
                            Expired
                        </UBadge>
                        <UBadge
                            v-else
                            :color="'success'"
                            variant="soft"
                            size="sm"
                        >
                            Active
                        </UBadge>
                    </template>


                    <template #actions-cell="{ row }">
                        <UButton
                            icon="i-lucide-trash"
                            color="error"
                            variant="ghost"
                            size="sm"
                            @click="() => {
                                latestOnDeleteClickAPIKeyId = row.original.id;
                                deleteConfirmOpen = true;
                            }"
                        />
                    </template>


                    <template #empty-actions>
                        <UButton
                            label="Create API Key"
                            color="primary"
                            to="/apikeys/new"
                        />
                    </template>

                </DashboardDataTable>

            </DashboardPageBody>
        </template>
    </UDashboardPanel>

    <DashboardDeleteModal
        title="Delete API Key"
        warning-text="Are you sure you want to delete this API key? This action cannot be undone."
        v-model:open="deleteConfirmOpen"
        @delete="onDeleteApiKey"
        :prevent-auto-close=true
    />
</template>