<script setup lang="ts">
import type { TableColumn } from '#ui/types';
import type {
    GetDevPackagesResponses,
    GetDevTasksResponses
} from '@/api-client/types.gen';
import { UserStore } from '~/utils/stores/userStore';

type DevPackage = GetDevPackagesResponses[200]['data'][number];
type DevTask = GetDevTasksResponses[200]['data'][number];

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

// Fetch packages
const { data: devPackages, loading: loadingPackages } = await useAPIAsyncData<DevPackage[]>(
    'dev-packages',
    async () => {
        const res = await useAPI((api) => api.getDevPackages({}))
        if (!res.success) {
            toast.add({ title: 'Failed to load packages', description: res.message, color: 'error' })
            return []
        }
        return res.data
    }
)

// Fetch tasks
const { data: devTasks, loading: loadingTasks } = await useAPIAsyncData<DevTask[]>(
    'dev-tasks',
    async () => {
        const res = await useAPI((api) => api.getDevTasks({}))
        if (!res.success) {
            return []
        }
        return res.data
    }
);

const packageColumns: TableColumn<DevPackage>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'description', header: 'Description' },
    { id: 'actions', header: '', enableSorting: false, enableHiding: false }
];

const recentPackages = computed(() => (devPackages.value || []).slice(0, 5));
const recentTasks = computed(() => (devTasks.value || []).slice(0, 5));

const stats = computed(() => [
    {
        label: 'Total Packages',
        value: devPackages.value?.length ?? 0,
        icon: 'i-lucide-package',
        color: 'text-sky-400'
    },
    {
        label: 'Pending Tasks',
        value: recentTasks.value.filter((t) => t.status === 'pending').length,
        icon: 'i-lucide-clock',
        color: 'text-amber-400'
    },
    {
        label: 'Running Tasks',
        value: recentTasks.value.filter((t) => t.status === 'running').length,
        icon: 'i-lucide-loader',
        color: 'text-emerald-400'
    }
]);
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <UDashboardNavbar title="Dashboard" icon="i-lucide-layout-dashboard">
                <template #right>
                    <UButton
                        label="New Package"
                        icon="i-lucide-plus"
                        color="primary"
                        to="/dashboard/packages/new"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <!-- Welcome Section -->
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold">
                            Welcome back, {{ user.display_name || user.username }}
                        </h1>
                        <p class="text-slate-400 mt-1">
                            Here's an overview of your packages and tasks.
                        </p>
                    </div>
                    <UBadge v-if="isAdmin" color="primary" variant="soft" size="lg">
                        <UIcon name="i-lucide-shield" class="mr-1" />
                        Admin
                    </UBadge>
                </div>

                <!-- Stats Cards -->
                <div class="grid gap-4 sm:grid-cols-3">
                    <UCard
                        v-for="stat in stats"
                        :key="stat.label"
                        class="border-slate-800 bg-slate-900/60"
                    >
                        <div class="flex items-center gap-4">
                            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800">
                                <UIcon :name="stat.icon" :class="['text-xl', stat.color]" />
                            </div>
                            <div>
                                <p class="text-2xl font-bold">{{ stat.value }}</p>
                                <p class="text-sm text-slate-400">{{ stat.label }}</p>
                            </div>
                        </div>
                    </UCard>
                </div>

                <!-- Recent Packages -->
                <UCard class="border-slate-800 bg-slate-900/60">
                    <template #header>
                        <div class="flex items-center justify-between">
                            <h2 class="text-lg font-semibold flex items-center gap-2">
                                <UIcon name="i-lucide-package" class="text-sky-400" />
                                Recent Packages
                            </h2>
                            <UButton
                                label="View All"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                to="/dashboard/packages"
                                trailing-icon="i-lucide-arrow-right"
                            />
                        </div>
                    </template>

                    <div v-if="loadingPackages" class="flex items-center justify-center py-8">
                        <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-slate-400" />
                    </div>

                    <UTable
                        v-else-if="recentPackages.length"
                        :data="recentPackages"
                        :columns="packageColumns"
                    >
                        <template #name-cell="{ row }">
                            <NuxtLink
                                :to="`/dashboard/packages/${row.original.name}`"
                                class="font-medium text-sky-400 hover:underline"
                            >
                                {{ row.original.name }}
                            </NuxtLink>
                        </template>
                        <template #description-cell="{ row }">
                            <span class="text-slate-400 line-clamp-1">
                                {{ row.original.description || '—' }}
                            </span>
                        </template>
                        <template #actions-cell="{ row }">
                            <UButton
                                icon="i-lucide-external-link"
                                variant="ghost"
                                color="neutral"
                                size="xs"
                                :to="`/dashboard/packages/${row.original.name}`"
                            />
                        </template>
                    </UTable>

                    <UEmpty
                        v-else
                        icon="i-lucide-package-x"
                        title="No packages yet"
                        description="Create your first package to get started."
                    >
                        <template #actions>
                            <UButton
                                label="Create Package"
                                color="primary"
                                to="/dashboard/packages/new"
                            />
                        </template>
                    </UEmpty>
                </UCard>

                <!-- Recent Tasks -->
                <UCard class="border-slate-800 bg-slate-900/60">
                    <template #header>
                        <div class="flex items-center justify-between">
                            <h2 class="text-lg font-semibold flex items-center gap-2">
                                <UIcon name="i-lucide-list-checks" class="text-emerald-400" />
                                Recent Tasks
                            </h2>
                            <UButton
                                label="View All"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                to="/dashboard/tasks"
                                trailing-icon="i-lucide-arrow-right"
                            />
                        </div>
                    </template>

                    <div v-if="loadingTasks" class="flex items-center justify-center py-8">
                        <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-slate-400" />
                    </div>

                    <div v-else-if="recentTasks.length" class="space-y-3">
                        <div
                            v-for="task in recentTasks"
                            :key="task.id"
                            class="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                        >
                            <div class="flex items-center gap-3">
                                <UIcon
                                    :name="
                                        task.status === 'completed'
                                            ? 'i-lucide-check-circle'
                                            : task.status === 'running'
                                              ? 'i-lucide-loader'
                                              : task.status === 'failed'
                                                ? 'i-lucide-x-circle'
                                                : 'i-lucide-clock'
                                    "
                                    :class="[
                                        'text-lg',
                                        task.status === 'completed'
                                            ? 'text-emerald-400'
                                            : task.status === 'running'
                                              ? 'text-sky-400 animate-spin'
                                              : task.status === 'failed'
                                                ? 'text-red-400'
                                                : 'text-amber-400'
                                    ]"
                                />
                                <div>
                                    <p class="font-medium">Task #{{ task.id }}</p>
                                    <p class="text-sm text-slate-400">
                                        {{ task.message || 'Processing...' }}
                                    </p>
                                </div>
                            </div>
                            <UBadge
                                :color="
                                    task.status === 'completed'
                                        ? 'success'
                                        : task.status === 'running'
                                          ? 'info'
                                          : task.status === 'failed'
                                            ? 'error'
                                            : 'warning'
                                "
                                variant="soft"
                            >
                                {{ task.status }}
                            </UBadge>
                        </div>
                    </div>

                    <UEmpty
                        v-else
                        icon="i-lucide-clipboard-list"
                        title="No tasks"
                        description="Tasks will appear here when you upload releases."
                    />
                </UCard>

                <!-- Quick Actions -->
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <UCard
                        class="border-slate-800 bg-slate-900/60 transition hover:border-sky-500/50 cursor-pointer"
                        @click="navigateTo('/dashboard/packages/new')"
                    >
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
                                <UIcon name="i-lucide-package-plus" class="text-sky-400" />
                            </div>
                            <div>
                                <p class="font-semibold">Create Package</p>
                                <p class="text-sm text-slate-400">Add a new package</p>
                            </div>
                        </div>
                    </UCard>

                    <UCard
                        class="border-slate-800 bg-slate-900/60 transition hover:border-emerald-500/50 cursor-pointer"
                        @click="navigateTo('/dashboard/packages')"
                    >
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                                <UIcon name="i-lucide-upload" class="text-emerald-400" />
                            </div>
                            <div>
                                <p class="font-semibold">Upload Release</p>
                                <p class="text-sm text-slate-400">Add a new build</p>
                            </div>
                        </div>
                    </UCard>

                    <UCard
                        v-if="isAdmin"
                        class="border-slate-800 bg-slate-900/60 transition hover:border-amber-500/50 cursor-pointer"
                        @click="navigateTo('/dashboard/admin/requests')"
                    >
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                                <UIcon name="i-lucide-git-pull-request" class="text-amber-400" />
                            </div>
                            <div>
                                <p class="font-semibold">Review Requests</p>
                                <p class="text-sm text-slate-400">Approve stable promotions</p>
                            </div>
                        </div>
                    </UCard>
                </div>
            </div>
        </template>
    </UDashboardPanel>
</template>