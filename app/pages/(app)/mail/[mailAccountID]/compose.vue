<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui';
import type { MailAccountWithMailboxes } from '~/utils/types';
import { Utils } from '~/utils';

const toast = useToast();

const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const accountId = mailAccount.data.value.id;

useSeoMeta({
    title: 'Compose | Delivr',
    description: 'Compose a new email'
});

// ── Form state ──

const to = ref('');
const cc = ref('');
const bcc = ref('');
const subject = ref('');
const body = ref('');
const attachments = ref<File[]>([]);

const showCc = ref(false);
const showBcc = ref(false);
const sending = ref(false);
const savingDraft = ref(false);

// ── File input ref ──
const fileInputRef = ref<HTMLInputElement | null>(null);

// ── Editor toolbar items ──

const toolbarItems: EditorToolbarItem[][] = [
    [
        {
            icon: 'i-lucide-heading',
            tooltip: { text: 'Headings' },
            content: { align: 'start' },
            items: [
                { kind: 'heading', level: 1, icon: 'i-lucide-heading-1', label: 'Heading 1' },
                { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', label: 'Heading 2' },
                { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', label: 'Heading 3' },
            ]
        },
        {
            icon: 'i-lucide-list',
            tooltip: { text: 'Lists' },
            content: { align: 'start' },
            items: [
                { kind: 'bulletList', icon: 'i-lucide-list', label: 'Bullet List' },
                { kind: 'orderedList', icon: 'i-lucide-list-ordered', label: 'Ordered List' },
            ]
        },
        { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: 'Quote' } },
        { kind: 'horizontalRule', icon: 'i-lucide-separator-horizontal', tooltip: { text: 'Divider' } },
    ],
    [
        { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold (Ctrl+B)' } },
        { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic (Ctrl+I)' } },
        { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline (Ctrl+U)' } },
        { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } },
        { kind: 'mark', mark: 'code', icon: 'i-lucide-code', tooltip: { text: 'Inline Code' } },
    ],
    [
        { kind: 'link', icon: 'i-lucide-link', tooltip: { text: 'Insert Link' } },
    ],
    [
        { kind: 'undo', icon: 'i-lucide-undo', tooltip: { text: 'Undo (Ctrl+Z)' } },
        { kind: 'redo', icon: 'i-lucide-redo', tooltip: { text: 'Redo (Ctrl+Shift+Z)' } },
    ],
];

// ── Attachment handling ──

function triggerFileSelect() {
    fileInputRef.value?.click();
}

function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
        attachments.value = [...attachments.value, ...Array.from(input.files)];
        input.value = ''; // Reset input
    }
}

function removeAttachment(index: number) {
    attachments.value = attachments.value.filter((_, i) => i !== index);
}

function getFileIcon(file: File): string {
    if (file.type.startsWith('image/')) return 'i-lucide-image';
    if (file.type.startsWith('video/')) return 'i-lucide-video';
    if (file.type.startsWith('audio/')) return 'i-lucide-music';
    if (file.type.includes('pdf')) return 'i-lucide-file-text';
    if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('7z')) return 'i-lucide-archive';
    if (file.type.includes('word') || file.type.includes('document')) return 'i-lucide-file-text';
    if (file.type.includes('sheet') || file.type.includes('excel')) return 'i-lucide-table';
    return 'i-lucide-file';
}

const totalAttachmentSize = computed(() => {
    return attachments.value.reduce((sum, file) => sum + file.size, 0);
});

// ── Actions ──

function goBack() {
    navigateTo(`/mail/${accountId}/folder/inbox`);
}

async function handleSend() {
    if (!to.value.trim()) {
        toast.add({
            title: 'Missing recipient',
            description: 'Please enter at least one recipient.',
            color: 'error'
        });
        return;
    }

    if (!subject.value.trim()) {
        const confirmed = confirm('Send without a subject?');
        if (!confirmed) return;
    }

    sending.value = true;
    
    // Backend not implemented yet
    setTimeout(() => {
        sending.value = false;
        toast.add({
            title: 'Sending not available yet',
            description: 'The mail sending feature is coming soon. Your draft cannot be saved at this time.',
            color: 'warning'
        });
    }, 500);
}

function handleSaveDraft() {
    savingDraft.value = true;
    setTimeout(() => {
        savingDraft.value = false;
        toast.add({
            title: 'Drafts not available yet',
            description: 'Draft saving will be available soon.',
            color: 'warning'
        });
    }, 500);
}

function handleDiscard() {
    const hasContent = to.value || subject.value || body.value || attachments.value.length > 0;
    if (hasContent) {
        if (!confirm('Discard this draft?')) return;
    }
    goBack();
}

// ── Keyboard shortcuts ──

function handleKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleSend();
    }
}

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="New Message"
                icon="i-lucide-pen-square"
            >
                <template #leading>
                    <UButton
                        icon="i-lucide-arrow-left"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="goBack"
                    />
                </template>
                <template #trailing>
                    <div class="flex items-center gap-2">
                        <UTooltip text="Save draft">
                            <UButton
                                icon="i-lucide-save"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                :loading="savingDraft"
                                @click="handleSaveDraft"
                            />
                        </UTooltip>
                        <UTooltip text="Attach files">
                            <UButton
                                icon="i-lucide-paperclip"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="triggerFileSelect"
                            />
                        </UTooltip>
                        <UButton
                            icon="i-lucide-trash-2"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            @click="handleDiscard"
                        >
                            Discard
                        </UButton>
                        <UButton
                            icon="i-lucide-send"
                            color="primary"
                            size="sm"
                            :loading="sending"
                            @click="handleSend"
                        >
                            Send
                        </UButton>
                    </div>
                </template>
            </DashboardPageHeader>
        </template>

        <template #body>
            <DashboardPageBody>
                <div class="max-w-4xl mx-auto space-y-4">

                    <!-- Hidden file input -->
                    <input
                        ref="fileInputRef"
                        type="file"
                        multiple
                        class="hidden"
                        @change="handleFileSelect"
                    />

                    <!-- From / Recipients card -->
                    <div class="rounded-lg border border-default bg-elevated">
                        <!-- From -->
                        <div class="flex items-center gap-3 px-4 py-3 border-b border-default">
                            <span class="text-sm text-dimmed w-14 shrink-0">From</span>
                            <div class="flex-1 flex items-center gap-2">
                                <Gravatar :email="mailAccount.data.value.smtp_username" size="xs" />
                                <span class="text-sm text-default">{{ mailAccount.data.value.display_name }} &lt;{{ mailAccount.data.value.smtp_username }}&gt;</span>
                            </div>
                        </div>

                        <!-- To -->
                        <div class="flex items-center gap-3 px-4 py-3 border-b border-default">
                            <span class="text-sm text-dimmed w-14 shrink-0">To</span>
                            <UInput
                                v-model="to"
                                placeholder="recipient@example.com"
                                variant="none"
                                class="flex-1"
                                size="md"
                            />
                            <div class="flex items-center gap-1 shrink-0">
                                <UButton
                                    v-if="!showCc"
                                    label="Cc"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    @click="showCc = true"
                                />
                                <UButton
                                    v-if="!showBcc"
                                    label="Bcc"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    @click="showBcc = true"
                                />
                            </div>
                        </div>

                        <!-- Cc -->
                        <div v-if="showCc" class="flex items-center gap-3 px-4 py-3 border-b border-default">
                            <span class="text-sm text-dimmed w-14 shrink-0">Cc</span>
                            <UInput
                                v-model="cc"
                                placeholder="cc@example.com"
                                variant="none"
                                class="flex-1"
                                size="md"
                            />
                            <UButton
                                icon="i-lucide-x"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="showCc = false; cc = ''"
                            />
                        </div>

                        <!-- Bcc -->
                        <div v-if="showBcc" class="flex items-center gap-3 px-4 py-3 border-b border-default">
                            <span class="text-sm text-dimmed w-14 shrink-0">Bcc</span>
                            <UInput
                                v-model="bcc"
                                placeholder="bcc@example.com"
                                variant="none"
                                class="flex-1"
                                size="md"
                            />
                            <UButton
                                icon="i-lucide-x"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="showBcc = false; bcc = ''"
                            />
                        </div>

                        <!-- Subject -->
                        <div class="flex items-center gap-3 px-4 py-3">
                            <span class="text-sm text-dimmed w-14 shrink-0">Subject</span>
                            <UInput
                                v-model="subject"
                                placeholder="Enter subject..."
                                variant="none"
                                class="flex-1"
                                size="md"
                            />
                        </div>
                    </div>

                    <!-- Attachments -->
                    <div v-if="attachments.length > 0" class="rounded-lg border border-default bg-elevated p-4">
                        <div class="flex items-center justify-between mb-3">
                            <div class="text-sm font-medium text-default flex items-center gap-2">
                                <UIcon name="i-lucide-paperclip" class="size-4" />
                                Attachments ({{ attachments.length }})
                            </div>
                            <span class="text-xs text-dimmed">
                                Total: {{ Utils.formatFileSize(totalAttachmentSize) }}
                            </span>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <div
                                v-for="(file, index) in attachments"
                                :key="index"
                                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-default bg-default group"
                            >
                                <UIcon :name="getFileIcon(file)" class="size-4 text-primary shrink-0" />
                                <div class="min-w-0">
                                    <div class="text-sm text-default truncate max-w-32">{{ file.name }}</div>
                                    <div class="text-xs text-dimmed">{{ Utils.formatFileSize(file.size) }}</div>
                                </div>
                                <UButton
                                    icon="i-lucide-x"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    class="opacity-50 group-hover:opacity-100"
                                    @click="removeAttachment(index)"
                                />
                            </div>
                            <button
                                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-default text-sm text-muted hover:border-primary hover:text-primary transition-colors cursor-pointer"
                                @click="triggerFileSelect"
                            >
                                <UIcon name="i-lucide-plus" class="size-4" />
                                Add more
                            </button>
                        </div>
                    </div>

                    <!-- Editor -->
                    <div class="rounded-lg border border-default overflow-hidden">
                        <UEditor
                            v-slot="{ editor }"
                            v-model="body"
                            content-type="html"
                            placeholder="Write your message..."
                            class="min-h-80 flex flex-col"
                        >
                            <UEditorToolbar
                                :editor="editor"
                                :items="toolbarItems"
                                layout="fixed"
                                class="border-b border-default px-2 py-1 bg-elevated"
                            />
                        </UEditor>
                    </div>

                    <!-- Bottom toolbar -->
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <UButton
                                icon="i-lucide-paperclip"
                                color="neutral"
                                variant="outline"
                                size="sm"
                                @click="triggerFileSelect"
                            >
                                Attach
                            </UButton>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-dimmed">Ctrl+Enter to send</span>
                            <UButton
                                icon="i-lucide-send"
                                color="primary"
                                size="md"
                                :loading="sending"
                                @click="handleSend"
                            >
                                Send Message
                            </UButton>
                        </div>
                    </div>

                    <!-- Info banner -->
                    <div class="flex items-center gap-3 px-4 py-3 rounded-lg border border-warning/30 bg-warning/5">
                        <UIcon name="i-lucide-info" class="size-4 text-warning shrink-0" />
                        <p class="text-xs text-muted">
                            Mail sending is not yet available. This compose view will be fully functional once the backend endpoint is implemented.
                        </p>
                    </div>

                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>
