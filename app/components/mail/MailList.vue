<script setup lang="ts">
import type { MailItem } from './MailListItem.vue'

const props = defineProps<{
    mails: MailItem[]
    loading?: boolean
    emptyTitle?: string
    emptyDescription?: string
}>()

const emit = defineEmits<{
    'mail-click': [mail: MailItem]
    'mail-select': [mail: MailItem, selected: boolean]
    'mail-star': [mail: MailItem, starred: boolean]
    'selection-change': [selectedIds: number[]]
    'select-all': [selected: boolean]
}>()

// Track selected mail UIDs
const selectedUids = defineModel<number[]>('selectedUids', { default: () => [] })

// Check if all visible mails are selected
const allSelected = computed(() => {
    if (props.mails.length === 0) return false
    return props.mails.every(mail => selectedUids.value.includes(mail.uid))
})

// Check if some (but not all) mails are selected
const someSelected = computed(() => {
    if (props.mails.length === 0) return false
    const selectedCount = props.mails.filter(mail => selectedUids.value.includes(mail.uid)).length
    return selectedCount > 0 && selectedCount < props.mails.length
})

function isSelected(mail: MailItem): boolean {
    return selectedUids.value.includes(mail.uid)
}

function handleMailClick(mail: MailItem) {
    emit('mail-click', mail)
}

function handleMailSelect(mail: MailItem, selected: boolean) {
    if (selected) {
        if (!selectedUids.value.includes(mail.uid)) {
            selectedUids.value = [...selectedUids.value, mail.uid]
        }
    } else {
        selectedUids.value = selectedUids.value.filter(uid => uid !== mail.uid)
    }
    emit('mail-select', mail, selected)
    emit('selection-change', selectedUids.value)
}

function handleMailStar(mail: MailItem, starred: boolean) {
    emit('mail-star', mail, starred)
}

function handleSelectAll(value: boolean | 'indeterminate') {
    if (typeof value !== 'boolean') return
    if (value) {
        selectedUids.value = props.mails.map(mail => mail.uid)
    } else {
        selectedUids.value = []
    }
    emit('select-all', value)
    emit('selection-change', selectedUids.value)
}

function toggleSelectAll() {
    handleSelectAll(!allSelected.value)
}
</script>

<template>
    <div class="flex flex-col bg-default rounded-lg border border-default overflow-hidden">
        <!-- Header / Toolbar -->
        <div class="flex items-center gap-2 px-2 py-2 border-b border-default bg-default">
            <!-- Select All Checkbox -->
            <UCheckbox
                :model-value="allSelected"
                :indeterminate="someSelected"
                @update:model-value="handleSelectAll"
            />
            
            <!-- Refresh button slot -->
            <slot name="toolbar-start" />
            
            <div class="flex-1" />
            
            <!-- Pagination / Info slot -->
            <slot name="toolbar-end">
                <span v-if="mails.length > 0" class="text-xs text-muted">
                    {{ mails.length }} {{ mails.length === 1 ? 'E-Mail' : 'E-Mails' }}
                </span>
            </slot>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-12">
            <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
        </div>

        <!-- Empty State -->
        <div v-else-if="mails.length === 0" class="flex flex-col items-center justify-center py-12 px-4 text-center">
            <UIcon name="i-lucide-inbox" class="size-12 text-muted mb-4" />
            <p class="text-sm font-medium text-default">
                {{ emptyTitle || 'Keine E-Mails' }}
            </p>
            <p v-if="emptyDescription" class="text-sm text-muted mt-1">
                {{ emptyDescription }}
            </p>
        </div>

        <!-- Mail List -->
        <div v-else class="divide-y divide-default">
            <MailListItem
                v-for="mail in mails"
                :key="mail.uid"
                :mail="mail"
                :selected="isSelected(mail)"
                @click="handleMailClick"
                @select="handleMailSelect"
                @star="handleMailStar"
            />
        </div>

        <!-- Footer slot (pagination, etc.) -->
        <slot name="footer" />
    </div>
</template>
