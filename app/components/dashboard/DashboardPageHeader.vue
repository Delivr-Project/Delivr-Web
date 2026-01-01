<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'

interface Props {
    title?: string
    icon?: string
    description?: string
    breadcrumbItems?: BreadcrumbItem[]
}

const props = withDefaults(defineProps<Props>(), {
    title: '',
    icon: undefined,
});

</script>

<template>
    <UDashboardNavbar :title="props.title" :icon="props.icon">
        <template #leading>
            <slot name="leading"></slot>
        </template>

        <template #title v-if="breadcrumbItems?.length">
            <slot name="title">
                <UBreadcrumb :items="breadcrumbItems" :ui='{
                    link: "text-md"
                }' />
            </slot>
        </template>

        <template #trailing v-if="description">
            <slot name="trailing">
                <span class="text-slate-400 hidden sm:inline">
                    {{ description }}
                </span>
            </slot>
        </template>

        <template #left>
            <slot name="left"></slot>
        </template>

        <template #default>
            <slot></slot>
        </template>

        <template #right>
            <slot name="right"></slot>
        </template>
    </UDashboardNavbar>
</template>