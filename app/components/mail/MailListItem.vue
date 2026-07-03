<script setup lang="ts">
interface MailAddress {
    name?: string
    address: string
}

interface MailFlags {
    seen?: boolean
    answered?: boolean
    flagged?: boolean
    deleted?: boolean
    draft?: boolean
    recent?: boolean
}

interface MailAttachment {
    filename?: string
    contentType: string
    size: number
    contentId?: string
    contentDisposition?: string
}

export interface MailItem {
    uid: number
    from?: MailAddress
    to: MailAddress[]
    cc?: MailAddress[]
    bcc?: MailAddress[]
    subject?: string
    date?: number
    flags?: MailFlags
    attachments?: MailAttachment[]
    body?: {
        text?: string
        html?: string
    }
    messageId?: string
}

const props = defineProps<{
    mail: MailItem
    selected?: boolean
}>()

const emit = defineEmits<{
    click: [mail: MailItem]
    select: [mail: MailItem, selected: boolean]
    star: [mail: MailItem, starred: boolean]
}>()

const isUnread = computed(() => !props.mail.flags?.seen)
const isStarred = computed(() => props.mail.flags?.flagged ?? false)

// Get sender display name
const senderName = computed(() => {
    if (!props.mail.from) return 'Unknown'
    return props.mail.from.name || props.mail.from.address
})

// Get preview text from body
const previewText = computed(() => {
    const text = props.mail.body?.text || ''
    // Strip HTML and get first 100 chars
    const stripped = text.replace(/<[^>]*>/g, '').trim()
    return stripped.length > 100 ? stripped.slice(0, 100) + '...' : stripped
})

// Format date relative
const formattedDate = computed(() => {
    if (!props.mail.date) return ''
    
    const date = new Date(props.mail.date)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
        // Today - show time
        return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays < 7) {
        // This week - show day name
        return date.toLocaleDateString('de-DE', { weekday: 'short' })
    } else if (date.getFullYear() === now.getFullYear()) {
        // This year - show day and month
        return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
    } else {
        // Older - show full date
        return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
    }
})

const hasAttachments = computed(() => (props.mail.attachments?.length ?? 0) > 0)

function handleClick(e: MouseEvent) {
    // Don't trigger click when clicking on checkbox or star
    const target = e.target as HTMLElement
    if (target.closest('[data-action]')) return
    emit('click', props.mail)
}

function handleSelect(value: boolean | 'indeterminate') {
    if (typeof value === 'boolean') {
        emit('select', props.mail, value)
    }
}

function handleStarToggle() {
    emit('star', props.mail, !isStarred.value)
}
</script>

<template>
    <div
        class="group flex items-center gap-2 px-2 py-2 cursor-pointer border-b border-default transition-colors hover:bg-elevated hover:shadow-sm"
        :class="[
            selected ? 'bg-elevated' : 'bg-default',
            isUnread ? 'font-semibold' : ''
        ]"
        @click="handleClick"
    >
        <!-- Checkbox -->
        <div data-action="checkbox" class="shrink-0">
            <UCheckbox
                :model-value="selected"
                @update:model-value="handleSelect"
            />
        </div>

        <!-- Star -->
        <button
            data-action="star"
            class="shrink-0 p-1 rounded hover:bg-accented transition-colors"
            @click.stop="handleStarToggle"
        >
            <UIcon
                :name="isStarred ? 'i-lucide-star' : 'i-lucide-star'"
                :class="[
                    'size-4 transition-colors',
                    isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-muted group-hover:text-dimmed'
                ]"
            />
        </button>

        <!-- Sender -->
        <div class="shrink-0 w-44 truncate text-sm" :class="isUnread ? 'text-default' : 'text-muted'">
            {{ senderName }}
        </div>

        <!-- Subject and Preview -->
        <div class="flex-1 min-w-0 flex items-center gap-2">
            <span class="truncate text-sm" :class="isUnread ? 'text-default' : 'text-muted'">
                {{ mail.subject || '(Kein Betreff)' }}
            </span>
            <span v-if="previewText" class="hidden sm:inline truncate text-sm text-dimmed">
                — {{ previewText }}
            </span>
        </div>

        <!-- Attachment indicator -->
        <div v-if="hasAttachments" class="shrink-0">
            <UIcon name="i-lucide-paperclip" class="size-4 text-muted" />
        </div>

        <!-- Date -->
        <div class="shrink-0 text-xs w-16 text-right" :class="isUnread ? 'text-default' : 'text-muted'">
            {{ formattedDate }}
        </div>
    </div>
</template>
