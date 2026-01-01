<script setup lang="ts">
interface Props {
    title: string
    description?: string
    icon?: string
    iconColor?: 'sky' | 'amber' | 'emerald' | 'error' | 'neutral'
    loading?: boolean
}

defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const iconColorClasses: Record<NonNullable<Props['iconColor']>, string> = {
    sky: 'text-sky-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    error: 'text-red-400',
    neutral: 'text-slate-400'
}
</script>

<template>
    <UModal
        v-model:open="open"
        :title="title"
        :description="description"
        :ui="{
            content: 'sm:max-w-lg',
            footer: 'justify-end'
        }"
    >
        <template #title>
            <div class="flex items-center gap-2">
                <UIcon
                    v-if="icon"
                    :name="icon"
                    :class="iconColorClasses[iconColor ?? 'sky']"
                />
                <span>{{ title }}</span>
            </div>
        </template>

        <template #body>
            <div v-if="loading" class="flex items-center justify-center py-8">
                <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-slate-400" />
            </div>
            <slot v-else />
        </template>

        <template #footer>
            <slot name="footer" />
        </template>
    </UModal>
</template>
