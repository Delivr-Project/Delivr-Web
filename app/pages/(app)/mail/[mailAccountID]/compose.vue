<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui';
import type { MailAccountWithMailboxes } from '~/utils/types';
import { Utils } from '~/utils';
import { client } from '~/api-client/client.gen';

const toast = useToast();

const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const accountId = mailAccount.data.value.id;

useSeoMeta({
    title: 'Compose | Delivr',
    description: 'Compose a new email'
});

// ── Special-use folders ──
// The backend send flow is two-step: the mail is first created in a mailbox
// (Drafts) so it gets a UID, then sent via `.../mails/{uid}/send`, which moves
// the original to Sent. We therefore need the Drafts folder path; if the account
// has no resolved Drafts folder we fall back to INBOX so composing still works.
const draftsPath = ref('INBOX');

async function loadSpecialUse() {
    const res = await useAPI(api =>
        api.getMailAccountsByMailAccountIdSpecialUse({ path: { mailAccountID: accountId } })
    );
    if (res.success && res.data.drafts?.path) {
        draftsPath.value = res.data.drafts.path;
    }
}
// Fire immediately; sending awaits this if it hasn't resolved yet.
const specialUsePromise = loadSpecialUse();

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

// ── Recipient & body helpers ──

type Address = { name?: string; address: string };

type CreateMailResponse = {
    success: boolean;
    code: number;
    message: string;
    data: { uid: number };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse a comma/semicolon-separated recipient string into structured addresses.
 * Supports both bare addresses (`a@b.com`) and the `Name <a@b.com>` form.
 * Invalid entries are collected separately so the caller can surface them.
 */
function parseRecipients(raw: string): { valid: Address[]; invalid: string[] } {
    const valid: Address[] = [];
    const invalid: string[] = [];

    for (const part of splitRecipients(raw)) {
        const entry = part.trim();
        if (!entry) continue;

        const angle = entry.match(/^(.*)<(.+)>$/);
        if (angle) {
            const name = angle[1]!.trim().replace(/^["']|["']$/g, '').trim();
            const address = angle[2]!.trim();
            if (EMAIL_RE.test(address)) valid.push(name ? { name, address } : { address });
            else invalid.push(entry);
        } else if (EMAIL_RE.test(entry)) {
            valid.push({ address: entry });
        } else {
            invalid.push(entry);
        }
    }

    return { valid, invalid };
}

/** Split recipients without treating delimiters inside quoted display names as separators. */
function splitRecipients(raw: string): string[] {
    const entries: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;
    let escaped = false;
    let angleDepth = 0;

    for (const char of raw) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (quote && char === '\\') {
            current += char;
            escaped = true;
            continue;
        }

        if ((char === '"' || char === "'") && angleDepth === 0) {
            quote = quote === char ? null : quote ?? char;
        } else if (!quote && char === '<') {
            angleDepth++;
        } else if (!quote && char === '>' && angleDepth > 0) {
            angleDepth--;
        }

        if (!quote && angleDepth === 0 && (char === ',' || char === ';')) {
            entries.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    entries.push(current);
    return entries;
}

/** Best-effort plain-text fallback derived from the HTML editor content. */
function htmlToText(html: string): string {
    if (import.meta.client) {
        const el = document.createElement('div');
        el.innerHTML = html;
        return (el.textContent || el.innerText || '').trim();
    }
    return html.replace(/<[^>]*>/g, '').trim();
}

/** The `From` address for this account, required by the SMTP backend. */
function accountFrom(): Address {
    const address = mailAccount.data.value.smtp_username;
    const name = mailAccount.data.value.display_name;
    return name ? { name, address } : { address };
}

/**
 * Build the create-mail request body from the current form state. Returns
 * `null` (and shows a toast) when recipients are missing or malformed.
 */
function buildMailBody(asDraft: boolean, requireRecipient: boolean) {
    const toParsed = parseRecipients(to.value);
    const ccParsed = parseRecipients(cc.value);
    const bccParsed = parseRecipients(bcc.value);

    const allInvalid = [...toParsed.invalid, ...ccParsed.invalid, ...bccParsed.invalid];
    if (allInvalid.length > 0) {
        toast.add({
            title: 'Invalid recipient',
            description: `These addresses look invalid: ${allInvalid.join(', ')}`,
            color: 'error'
        });
        return null;
    }

    const recipientCount = toParsed.valid.length + ccParsed.valid.length + bccParsed.valid.length;
    if (requireRecipient && recipientCount === 0) {
        toast.add({
            title: 'Missing recipient',
            description: 'Please enter at least one valid recipient.',
            color: 'error'
        });
        return null;
    }

    const html = body.value?.trim() ?? '';
    const text = htmlToText(html);

    return {
        from: accountFrom(),
        to: toParsed.valid,
        cc: ccParsed.valid,
        bcc: bccParsed.valid,
        subject: subject.value.trim() || undefined,
        priority: 'normal' as const,
        flags: { draft: asDraft },
        body: { html: html || undefined, text: text || undefined }
    };
}

/** Create a mail in the Drafts folder and return its UID (or null on failure). */
async function createDraftMail(asDraft: boolean, requireRecipient: boolean): Promise<number | null> {
    const mailBody = buildMailBody(asDraft, requireRecipient);
    if (!mailBody) return null;

    await specialUsePromise;

    const res = attachments.value.length > 0
        ? await useAPI(() => {
            const form = new FormData();
            form.set('mail', JSON.stringify(mailBody));
            for (const attachment of attachments.value) form.append('attachments', attachment);

            return client.post<'$fetch', CreateMailResponse>({
                url: '/mail-accounts/{mailAccountID}/mailboxes/{mailboxPath}/mails',
                path: { mailAccountID: accountId, mailboxPath: draftsPath.value },
                body: form
            });
        })
        : await useAPI(api =>
            api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMails({
                path: { mailAccountID: accountId, mailboxPath: draftsPath.value },
                body: mailBody
            })
        );

    if (!res.success) {
        toast.add({
            title: 'Could not save message',
            description: res.message || 'An unknown error occurred.',
            color: 'error'
        });
        return null;
    }

    return res.data.uid;
}

// ── Actions ──

function goBack() {
    navigateTo(`/mail/${accountId}/folder/inbox`);
}

async function handleSend() {
    if (sending.value || savingDraft.value) return;

    if (attachments.value.length > 0) {
        toast.add({
            title: 'Attachments are not supported yet',
            description: 'Remove attachments before sending this message. You can still save it as a draft.',
            color: 'warning'
        });
        return;
    }

    if (!to.value.trim() && !cc.value.trim() && !bcc.value.trim()) {
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
    try {
        // Step 1: create the draft so it has a UID the send endpoint can act on.
        const uid = await createDraftMail(true, true);
        if (uid === null) return;

        // Step 2: send it and move the original into the Sent folder.
        const sendRes = await useAPI(api =>
            api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUidSend({
                path: { mailAccountID: accountId, mailboxPath: draftsPath.value, mailUID: uid },
                body: { moveToSent: true }
            })
        );

        if (!sendRes.success) {
            toast.add({
                title: 'Failed to send message',
                description: sendRes.message || 'The message was saved to Drafts but could not be sent.',
                color: 'error'
            });
            return;
        }

        toast.add({
            title: 'Message sent',
            description: 'Your email has been sent successfully.',
            color: 'success'
        });
        navigateTo(`/mail/${accountId}/folder/inbox`);
    } finally {
        sending.value = false;
    }
}

async function handleSaveDraft() {
    if (sending.value || savingDraft.value) return;

    if (!to.value.trim() && !cc.value.trim() && !bcc.value.trim()
        && !subject.value.trim() && !body.value?.trim()) {
        toast.add({
            title: 'Nothing to save',
            description: 'Write something before saving a draft.',
            color: 'warning'
        });
        return;
    }

    savingDraft.value = true;
    try {
        const uid = await createDraftMail(true, false);
        if (uid === null) return;

        toast.add({
            title: 'Draft saved',
            description: 'Your message has been saved to Drafts.',
            color: 'success'
        });
        navigateTo(`/mail/${accountId}/folder/${encodeURIComponent(draftsPath.value)}`);
    } finally {
        savingDraft.value = false;
    }
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
                                    @click="showCc = true;"
                                />
                                <UButton
                                    v-if="!showBcc"
                                    label="Bcc"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    @click="showBcc = true;"
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

                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>
