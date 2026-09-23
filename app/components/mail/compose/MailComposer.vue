<script setup lang="ts">
import type { DropdownMenuItem, SelectMenuItem } from '@nuxt/ui';
import { breakpointsTailwind, useBreakpoints, useEventListener, useNow } from '@vueuse/core';
import MailComposeAttachments from '~/components/mail/compose/MailComposeAttachments.vue';
import MailComposeEditor from '~/components/mail/compose/MailComposeEditor.vue';
import MailRecipientInput from '~/components/mail/compose/MailRecipientInput.vue';
import { useMailDraft, type MailComposeSetup } from '~/composables/useMailDraft';
import { MailAddressUtils } from '~/utils/mail/mailAddress';
import { MailComposeUtils } from '~/utils/mail/mailCompose';

const props = defineProps<{
    accountId: number;
    setup: MailComposeSetup;
    /** Where to go after sending or discarding when there's no page to go back to. */
    fallbackRoute: string;
}>();

const toast = useToast();
const route = useRoute();
const router = useRouter();
const isMobile = useBreakpoints(breakpointsTailwind).smaller('sm');

const draft = useMailDraft({
    accountId: props.accountId,
    draftsPath: props.setup.draftsPath,
    content: props.setup.content,
    storedAttachments: props.setup.storedAttachments,
    pendingFiles: props.setup.pendingFiles,
    draftUid: props.setup.draftUid
});
const { content } = draft;

const MODE_META: Record<MailComposeUtils.Mode, { title: string; icon: string }> = {
    new: { title: 'New message', icon: 'i-lucide-pen-square' },
    draft: { title: 'Draft', icon: 'i-lucide-file-pen-line' },
    reply: { title: 'Reply', icon: 'i-lucide-reply' },
    replyAll: { title: 'Reply all', icon: 'i-lucide-reply-all' },
    forward: { title: 'Forward', icon: 'i-lucide-forward' }
};
const modeMeta = computed(() => MODE_META[props.setup.mode]);

useSeoMeta({
    title: () => `${content.subject.trim() || modeMeta.value.title} | Delivr`
});

// ── Recipients ──

const showCc = ref(content.cc.length > 0);
const showBcc = ref(content.bcc.length > 0);
const toInput = useTemplateRef('toInput');
const ccInput = useTemplateRef('ccInput');
const bccInput = useTemplateRef('bccInput');

async function revealField(field: 'cc' | 'bcc') {
    if (field === 'cc') showCc.value = true;
    else showBcc.value = true;
    await nextTick();
    (field === 'cc' ? ccInput : bccInput).value?.focus();
}

function hideField(field: 'cc' | 'bcc') {
    if (field === 'cc') {
        showCc.value = false;
        content.cc = [];
    } else {
        showBcc.value = false;
        content.bcc = [];
    }
}

const recipients = computed(() => [...content.to, ...content.cc, ...content.bcc]);
const invalidRecipients = computed(() => recipients.value.filter(address => !MailAddressUtils.isValid(address.address)));

// ── Sender ──

const senders = computed(() => {
    const list = [...props.setup.senders];
    // A draft may come from an address that isn't configured (anymore).
    if (content.from && !list.some(sender => MailAddressUtils.isSame(sender.address, content.from!.address))) {
        list.push(content.from);
    }
    return list;
});

const senderItems = computed<SelectMenuItem[]>(() => senders.value.map(sender => ({
    label: MailAddressUtils.format(sender),
    value: sender.address
})));

const selectedSender = computed({
    get: () => content.from?.address,
    set: (address?: string) => {
        const sender = senders.value.find(candidate => candidate.address === address);
        if (sender) content.from = { ...sender };
    }
});

// ── Attachments ──

const fileInput = useTemplateRef('fileInput');

function pickFiles() {
    fileInput.value?.click();
}

function onFilesPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) draft.addFiles(input.files);
    input.value = '';
}

// Files dragged anywhere over the composer are attached on drop. Drops the
// editor already handled (it attaches them too) are left alone.
const dragDepth = ref(0);

function carriesFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function onDragEnter(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dragDepth.value++;
}

function onDragOver(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

function onDragLeave(event: DragEvent) {
    if (!carriesFiles(event)) return;
    dragDepth.value = Math.max(0, dragDepth.value - 1);
}

function onDrop(event: DragEvent) {
    dragDepth.value = 0;
    if (!carriesFiles(event) || event.defaultPrevented) return;
    event.preventDefault();
    if (event.dataTransfer?.files.length) draft.addFiles(event.dataTransfer.files);
}

// ── Save status ──

const now = useNow({ interval: 30_000 });

const saveStatus = computed(() => {
    if (draft.status.value === 'saving') {
        return { icon: 'i-lucide-loader-circle', label: 'Saving…', spin: true, tone: 'text-muted' };
    }
    if (draft.status.value === 'error') {
        return { icon: 'i-lucide-cloud-alert', label: 'Not saved', spin: false, tone: 'text-error' };
    }
    if (draft.hasUnsavedChanges.value) {
        return { icon: 'i-lucide-cloud', label: 'Unsaved changes', spin: false, tone: 'text-dimmed' };
    }
    if (draft.draftUid.value !== null) {
        return { icon: 'i-lucide-cloud-check', label: 'Saved', spin: false, tone: 'text-dimmed' };
    }
    return null;
});

const savedAtText = computed(() => {
    const savedAt = draft.lastSavedAt.value;
    if (!savedAt) return draft.draftUid.value !== null ? 'Saved in Drafts' : '';
    const minutes = Math.floor((now.value.getTime() - savedAt) / 60_000);
    if (minutes < 1) return 'Saved just now';
    if (minutes < 60) return `Saved ${minutes} min ago`;
    return `Saved at ${new Date(savedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
});

async function saveNow() {
    const saved = await draft.save({ force: !draft.isEmpty.value });
    if (saved && draft.draftUid.value !== null) {
        toast.add({ title: 'Draft saved', icon: 'i-lucide-cloud-check', color: 'success' });
    } else if (!saved) {
        toast.add({ title: 'Draft not saved', description: draft.saveError.value ?? undefined, color: 'error' });
    }
}

// ── Options menu ──

const moreItems = computed<DropdownMenuItem[][]>(() => [
    [
        {
            label: 'High priority',
            icon: 'i-lucide-flag',
            type: 'checkbox',
            checked: content.priority === 'high',
            onUpdateChecked: (checked: boolean) => { content.priority = checked ? 'high' : 'normal'; }
        },
        {
            label: 'Low priority',
            icon: 'i-lucide-flag-off',
            type: 'checkbox',
            checked: content.priority === 'low',
            onUpdateChecked: (checked: boolean) => { content.priority = checked ? 'low' : 'normal'; }
        }
    ],
    [
        { label: 'Save draft', icon: 'i-lucide-save', kbds: ['meta', 's'], onSelect: () => void saveNow() }
    ],
    [
        { label: 'Discard draft', icon: 'i-lucide-trash-2', color: 'error', onSelect: requestDiscard }
    ]
]);

// ── Sending ──

const confirmSendOpen = ref(false);
const sendWarnings = ref<string[]>([]);

// Words that suggest a file was meant to be attached (English and German).
const ATTACHMENT_HINT = /\b(attach(?:ed|ment|ments)?|enclosed|anbei|angeh(?:ä|ae)ngt|anhang)\b/i;

function mentionsAttachment(): boolean {
    // Only the new text counts, not a quoted original below it.
    const ownText = content.html.split('<blockquote')[0] ?? '';
    return ATTACHMENT_HINT.test(MailComposeUtils.htmlToText(ownText)) || ATTACHMENT_HINT.test(content.subject);
}

function requestSend() {
    if (draft.sending.value) return;

    if (recipients.value.length === 0) {
        toast.add({ title: 'Add a recipient', description: 'The message needs at least one recipient.', color: 'error' });
        toInput.value?.focus();
        return;
    }
    if (invalidRecipients.value.length > 0) {
        toast.add({
            title: 'Check the recipients',
            description: `Not valid: ${invalidRecipients.value.map(address => address.address).join(', ')}`,
            color: 'error'
        });
        return;
    }

    const warnings: string[] = [];
    if (content.subject.trim() === '') warnings.push('The message has no subject.');
    if (draft.attachments.value.length === 0 && mentionsAttachment()) {
        warnings.push('The message mentions an attachment, but nothing is attached.');
    }

    if (warnings.length > 0) {
        sendWarnings.value = warnings;
        confirmSendOpen.value = true;
        return;
    }
    void send();
}

async function send() {
    confirmSendOpen.value = false;
    const result = await draft.send();
    if (!result.ok) {
        toast.add({ title: 'Message not sent', description: result.error, color: 'error' });
        return;
    }
    toast.add({
        title: 'Message sent',
        description: result.savedToSent ? undefined : 'It was sent, but no copy could be saved to your Sent folder.',
        icon: 'i-lucide-send',
        color: result.savedToSent ? 'success' : 'warning'
    });
    leave();
}

// ── Discarding ──

const confirmDiscardOpen = ref(false);
const discarding = ref(false);

function requestDiscard() {
    if (draft.isEmpty.value && draft.draftUid.value === null) {
        void discard();
        return;
    }
    confirmDiscardOpen.value = true;
}

async function discard() {
    discarding.value = true;
    try {
        const hadDraft = draft.draftUid.value !== null;
        if (!await draft.discard()) {
            toast.add({ title: 'Draft not discarded', description: 'The saved draft could not be deleted.', color: 'error' });
            return;
        }
        confirmDiscardOpen.value = false;
        if (hadDraft) toast.add({ title: 'Draft discarded', icon: 'i-lucide-trash-2', color: 'neutral' });
        leave();
    } finally {
        discarding.value = false;
    }
}

// ── Leaving ──

function leave() {
    // Back to where the composer was opened from, or the fallback when there's
    // no in-app history (e.g. the composer was opened directly).
    if (window.history.state?.back) router.back();
    else void navigateTo(props.fallbackRoute);
}

onBeforeRouteLeave(async () => {
    if (draft.closed.value) return true;
    if (draft.hasUnsavedChanges.value || draft.status.value === 'saving') {
        if (!await draft.save()) {
            return window.confirm('Your draft could not be saved. Leave anyway and lose your latest changes?');
        }
    }
    if (draft.lastSavedAt.value !== null) {
        toast.add({ title: 'Draft saved', description: 'Continue it anytime from your Drafts folder.', icon: 'i-lucide-cloud-check' });
    }
    return true;
});

useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
    if (draft.closed.value) return;
    if (draft.hasUnsavedChanges.value || draft.status.value === 'saving') {
        void draft.save();
        event.preventDefault();
    }
});

// Keep the URL on the stored draft, so reloading resumes it (and doesn't
// start the reply or forward over).
watch(() => draft.draftUid.value, (uid) => {
    if (uid !== null && !draft.closed.value && route.query.draft !== String(uid)) {
        void router.replace({ query: { draft: String(uid) } });
    }
});

defineShortcuts({
    meta_enter: { handler: requestSend, usingInput: true },
    meta_s: { handler: () => void saveNow(), usingInput: true }
});

const focusEditor = props.setup.mode === 'reply' || props.setup.mode === 'replyAll'
    || (props.setup.mode === 'draft' && content.to.length > 0);
</script>

<template>
    <UDashboardPanel id="mail-compose" :ui="{ body: 'p-0 sm:p-6 lg:py-8' }">
        <template #header>
            <UDashboardNavbar :title="modeMeta.title" :icon="isMobile ? undefined : modeMeta.icon">
                <template #leading>
                    <UTooltip text="Back">
                        <UButton
                            icon="i-lucide-arrow-left"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            aria-label="Back"
                            @click="leave"
                        />
                    </UTooltip>
                </template>

                <template #right>
                    <UTooltip v-if="saveStatus" :text="draft.saveError.value ?? savedAtText" :disabled="!(draft.saveError.value ?? savedAtText)">
                        <div class="flex items-center gap-1.5 text-xs select-none" :class="saveStatus.tone">
                            <UIcon :name="saveStatus.icon" class="size-4 shrink-0" :class="{ 'animate-spin': saveStatus.spin }" />
                            <span class="hidden md:inline">{{ saveStatus.label }}</span>
                        </div>
                    </UTooltip>
                    <UButton
                        v-if="draft.status.value === 'error'"
                        label="Retry"
                        color="error"
                        variant="ghost"
                        size="xs"
                        @click="saveNow"
                    />

                    <div v-if="saveStatus" class="w-px h-5 bg-default mx-1 hidden sm:block" />

                    <UTooltip text="Attach files">
                        <UButton
                            icon="i-lucide-paperclip"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            aria-label="Attach files"
                            :disabled="draft.sending.value"
                            @click="pickFiles"
                        />
                    </UTooltip>

                    <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
                        <UButton
                            icon="i-lucide-ellipsis-vertical"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            aria-label="More options"
                            :disabled="draft.sending.value"
                        />
                    </UDropdownMenu>

                    <UButton
                        :label="isMobile ? undefined : 'Send'"
                        icon="i-lucide-send"
                        color="primary"
                        size="md"
                        :loading="draft.sending.value"
                        aria-label="Send"
                        @click="requestSend"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <div
                class="relative w-full lg:max-w-4xl mx-auto"
                @dragenter="onDragEnter"
                @dragover="onDragOver"
                @dragleave="onDragLeave"
                @drop="onDrop"
            >
                <input
                    ref="fileInput"
                    type="file"
                    multiple
                    class="hidden"
                    @change="onFilesPicked"
                />

                <UAlert
                    v-if="setup.draftsFallback"
                    icon="i-lucide-folder-x"
                    color="warning"
                    variant="subtle"
                    title="No Drafts folder found"
                    description="Drafts of this message are saved to your Inbox. Assign a Drafts folder in the folder settings to change this."
                    class="mb-4 max-sm:rounded-none"
                />

                <div class="sm:rounded-xl sm:border border-default bg-default/60 backdrop-blur-sm overflow-clip">
                    <!-- Header fields -->
                    <div class="divide-y divide-default border-b border-default">
                        <div class="flex items-center gap-3 px-4 sm:px-6 py-2 min-h-12">
                            <span class="w-14 shrink-0 text-sm text-dimmed">From</span>
                            <USelectMenu
                                v-if="senderItems.length > 1"
                                v-model="selectedSender"
                                :items="senderItems"
                                value-key="value"
                                variant="none"
                                :search-input="false"
                                :disabled="draft.sending.value"
                                class="flex-1 min-w-0"
                                :ui="{ base: 'px-0' }"
                            >
                                <template #leading>
                                    <Gravatar :key="content.from?.address" :email="content.from?.address" size="2xs" />
                                </template>
                            </USelectMenu>
                            <div v-else class="flex items-center gap-2 min-w-0 flex-1">
                                <Gravatar :key="content.from?.address" :email="content.from?.address" size="2xs" />
                                <span class="text-sm text-default truncate">
                                    {{ content.from ? MailAddressUtils.format(content.from) : '—' }}
                                </span>
                            </div>
                        </div>

                        <div class="flex items-start gap-3 px-4 sm:px-6 py-1.5 min-h-12">
                            <label class="w-14 shrink-0 pt-1.5 text-sm text-dimmed" @click="toInput?.focus()">To</label>
                            <MailRecipientInput
                                ref="toInput"
                                v-model="content.to"
                                placeholder="Add recipients"
                                :autofocus="!focusEditor && content.to.length === 0"
                                class="flex-1 min-w-0"
                            />
                            <div class="flex items-center gap-0.5 pt-1 shrink-0">
                                <UButton v-if="!showCc" label="Cc" color="neutral" variant="ghost" size="xs" @click="revealField('cc')" />
                                <UButton v-if="!showBcc" label="Bcc" color="neutral" variant="ghost" size="xs" @click="revealField('bcc')" />
                            </div>
                        </div>

                        <div v-if="showCc" class="flex items-start gap-3 px-4 sm:px-6 py-1.5 min-h-12">
                            <label class="w-14 shrink-0 pt-1.5 text-sm text-dimmed" @click="ccInput?.focus()">Cc</label>
                            <MailRecipientInput ref="ccInput" v-model="content.cc" class="flex-1 min-w-0" />
                            <UTooltip text="Remove Cc">
                                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" class="mt-1" aria-label="Remove Cc" @click="hideField('cc')" />
                            </UTooltip>
                        </div>

                        <div v-if="showBcc" class="flex items-start gap-3 px-4 sm:px-6 py-1.5 min-h-12">
                            <label class="w-14 shrink-0 pt-1.5 text-sm text-dimmed" @click="bccInput?.focus()">Bcc</label>
                            <MailRecipientInput ref="bccInput" v-model="content.bcc" class="flex-1 min-w-0" />
                            <UTooltip text="Remove Bcc">
                                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" class="mt-1" aria-label="Remove Bcc" @click="hideField('bcc')" />
                            </UTooltip>
                        </div>

                        <div class="flex items-center gap-3 px-4 sm:px-6 py-1.5 min-h-12">
                            <span class="w-14 shrink-0 text-sm text-dimmed">Subject</span>
                            <UInput
                                v-model="content.subject"
                                placeholder="What is this about?"
                                variant="none"
                                size="md"
                                autocomplete="off"
                                :disabled="draft.sending.value"
                                class="flex-1 min-w-0"
                                :ui="{ base: 'px-0 font-medium' }"
                            />
                            <UBadge
                                v-if="content.priority !== 'normal'"
                                :label="content.priority === 'high' ? 'High priority' : 'Low priority'"
                                :color="content.priority === 'high' ? 'error' : 'neutral'"
                                :icon="content.priority === 'high' ? 'i-lucide-flag' : 'i-lucide-flag-off'"
                                variant="subtle"
                                size="sm"
                                class="shrink-0"
                            />
                        </div>
                    </div>

                    <!-- Body -->
                    <MailComposeEditor
                        v-model="content.html"
                        :autofocus="focusEditor"
                        :disabled="draft.sending.value"
                        @files="draft.addFiles"
                        @ready="draft.markPristine"
                    />

                    <MailComposeAttachments
                        v-if="draft.attachments.value.length > 0"
                        :attachments="draft.attachments.value"
                        :account-id="accountId"
                        :drafts-path="draft.draftsPath"
                        :draft-uid="draft.draftUid.value"
                        :uploading="draft.status.value === 'saving'"
                        :disabled="draft.sending.value"
                        @remove="draft.removeAttachment"
                        @add="pickFiles"
                    />

                    <!-- Footer -->
                    <div class="flex items-center gap-2 px-4 sm:px-6 py-3 border-t border-default">
                        <UButton
                            label="Send"
                            icon="i-lucide-send"
                            color="primary"
                            :loading="draft.sending.value"
                            @click="requestSend"
                        />
                        <UButton
                            v-if="draft.attachments.value.length === 0"
                            label="Attach"
                            icon="i-lucide-paperclip"
                            color="neutral"
                            variant="ghost"
                            :disabled="draft.sending.value"
                            @click="pickFiles"
                        />
                        <div class="flex-1" />
                        <span class="hidden md:flex items-center gap-1 text-xs text-dimmed">
                            <UKbd value="meta" size="sm" /><UKbd value="enter" size="sm" />
                            <span class="ms-1">to send</span>
                        </span>
                        <UTooltip text="Discard draft">
                            <UButton
                                icon="i-lucide-trash-2"
                                color="neutral"
                                variant="ghost"
                                aria-label="Discard draft"
                                :disabled="draft.sending.value"
                                @click="requestDiscard"
                            />
                        </UTooltip>
                    </div>
                </div>

                <!-- Drop zone overlay while files are dragged over the composer -->
                <div
                    v-if="dragDepth > 0"
                    class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center sm:rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[2px]"
                >
                    <div class="flex flex-col items-center gap-2 text-primary">
                        <UIcon name="i-lucide-paperclip" class="size-8" />
                        <span class="text-sm font-medium">Drop files to attach them</span>
                    </div>
                </div>
            </div>

            <!-- Send anyway? -->
            <DashboardModal
                v-model:open="confirmSendOpen"
                title="Send anyway?"
                icon="i-lucide-send"
                icon-color="amber"
            >
                <ul class="space-y-1.5 text-sm text-muted list-disc ps-5">
                    <li v-for="warning in sendWarnings" :key="warning">{{ warning }}</li>
                </ul>

                <template #footer>
                    <div class="flex justify-end gap-3">
                        <UButton label="Keep editing" color="neutral" variant="ghost" @click="confirmSendOpen = false;" />
                        <UButton label="Send anyway" color="primary" icon="i-lucide-send" :loading="draft.sending.value" @click="send" />
                    </div>
                </template>
            </DashboardModal>

            <!-- Discard? -->
            <DashboardModal
                v-model:open="confirmDiscardOpen"
                title="Discard draft?"
                icon="i-lucide-trash-2"
                icon-color="error"
            >
                <p class="text-sm text-muted">
                    This message{{ draft.draftUid.value !== null ? ' and its saved draft' : '' }} will be deleted. This can't be undone.
                </p>

                <template #footer>
                    <div class="flex justify-end gap-3">
                        <UButton label="Keep editing" color="neutral" variant="ghost" @click="confirmDiscardOpen = false;" />
                        <UButton label="Discard" color="error" icon="i-lucide-trash-2" :loading="discarding" @click="discard" />
                    </div>
                </template>
            </DashboardModal>
        </template>
    </UDashboardPanel>
</template>
