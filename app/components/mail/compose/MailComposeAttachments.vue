<script setup lang="ts">
import type { ComposeAttachment } from '~/composables/useMailDraft';
import { isPreviewableType, useMailAttachments } from '~/composables/useMailAttachments';
import { Utils } from '~/utils';

/** Attachments of the message being composed, with remove and add actions. */
const props = defineProps<{
    attachments: ComposeAttachment[];
    accountId: number;
    draftsPath: string;
    draftUid: number | null;
    /** A save is uploading the pending files. */
    uploading: boolean;
    disabled?: boolean;
}>();

const emit = defineEmits<{
    remove: [key: string];
    add: [];
}>();

const { openAttachment } = useMailAttachments();

const totalSize = computed(() => props.attachments.reduce((sum, attachment) => sum + attachment.size, 0));

function iconFor(attachment: ComposeAttachment): string {
    const type = attachment.contentType.toLowerCase();
    const extension = attachment.filename.split('.').pop()?.toLowerCase() ?? '';
    if (type.startsWith('image/')) return 'i-lucide-image';
    if (type.startsWith('video/')) return 'i-lucide-video';
    if (type.startsWith('audio/')) return 'i-lucide-music';
    if (type === 'application/pdf') return 'i-lucide-file-text';
    if (/zip|rar|7z|tar|gzip/.test(type) || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'i-lucide-file-archive';
    if (/sheet|excel|csv/.test(type) || ['xls', 'xlsx', 'csv', 'ods'].includes(extension)) return 'i-lucide-file-spreadsheet';
    if (/word|document|text\//.test(type)) return 'i-lucide-file-text';
    return 'i-lucide-file';
}

function isUploading(attachment: ComposeAttachment): boolean {
    return props.uploading && attachment.kind === 'pending';
}

function canOpen(attachment: ComposeAttachment): boolean {
    return attachment.kind === 'stored' ? props.draftUid !== null : isPreviewableType(attachment.contentType);
}

function open(attachment: ComposeAttachment) {
    if (attachment.kind === 'stored' && props.draftUid !== null) {
        openAttachment({
            accountId: props.accountId,
            mailboxPath: props.draftsPath,
            mailUid: props.draftUid,
            attachmentId: attachment.storedId
        }, attachment.filename, attachment.contentType);
    } else if (attachment.kind === 'pending' && isPreviewableType(attachment.contentType)) {
        // Not uploaded yet: show the local file. Only inert types (see the
        // preview allowlist) are opened this way.
        const url = URL.createObjectURL(attachment.file);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
}
</script>

<template>
    <div class="px-4 sm:px-6 py-3 border-t border-default space-y-2.5">
        <div class="flex items-center gap-1.5 text-xs text-muted">
            <UIcon name="i-lucide-paperclip" class="size-3.5" />
            <span>{{ attachments.length }} attachment{{ attachments.length === 1 ? '' : 's' }}</span>
            <span class="text-dimmed">·</span>
            <span>{{ Utils.formatFileSize(totalSize) }}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            <div
                v-for="attachment in attachments"
                :key="attachment.key"
                class="flex items-center gap-2 p-2 rounded-lg border border-default bg-elevated/30 hover:border-primary/60 focus-within:border-primary transition-colors min-w-0"
            >
                <button
                    type="button"
                    class="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    :class="canOpen(attachment) ? 'cursor-pointer' : 'cursor-default'"
                    :aria-label="`Open ${attachment.filename}`"
                    @click="open(attachment)"
                >
                    <div class="shrink-0 p-1.5 rounded-md bg-primary/10">
                        <UIcon
                            :name="isUploading(attachment) ? 'i-lucide-loader-circle' : iconFor(attachment)"
                            class="size-4 text-primary"
                            :class="{ 'animate-spin': isUploading(attachment) }"
                        />
                    </div>
                    <div class="min-w-0">
                        <div class="text-sm text-default truncate">{{ attachment.filename }}</div>
                        <div class="text-xs text-dimmed">
                            {{ isUploading(attachment) ? 'Uploading…' : Utils.formatFileSize(attachment.size) }}
                        </div>
                    </div>
                </button>

                <UTooltip text="Remove">
                    <UButton
                        icon="i-lucide-x"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        :disabled="disabled"
                        :aria-label="`Remove ${attachment.filename}`"
                        @click="emit('remove', attachment.key)"
                    />
                </UTooltip>
            </div>

            <button
                type="button"
                class="flex items-center justify-center gap-2 p-2 min-h-13 rounded-lg border border-dashed border-default text-sm text-muted hover:border-primary hover:text-primary transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="disabled"
                @click="emit('add')"
            >
                <UIcon name="i-lucide-plus" class="size-4" />
                Add files
            </button>
        </div>
    </div>
</template>
