<script setup lang="ts">
import type { MailData } from '~/utils/types';
import { useSanitizeHtml } from '~/composables/useSanitizeHtml';
import { useRemoteContentPolicyStore, extractDomain } from '~/composables/stores/useRemoteContentPolicyStore';
import { Utils } from '~/utils';
import Gravatar from '~/components/Gravatar.vue';

const props = defineProps<{
    accountId: number
    folderPath: string
    mailUid: number
    /** Show a close button in the header (emits `close`). */
    closable?: boolean
}>();

const emit = defineEmits<{
    close: []
    'not-found': []
}>();

const toast = useToast();

const systemFolderPath = computed(() =>
    props.folderPath.toLowerCase() === 'inbox' ? 'INBOX' : props.folderPath
);

const isLoading = ref(true);
const mailData = ref<MailData | null>(null);

async function loadMail() {
    isLoading.value = true;
    try {
        const response = await useAPI(api =>
            api.getMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUid({
                path: {
                    mailAccountID: props.accountId,
                    mailboxPath: systemFolderPath.value,
                    mailUID: props.mailUid,
                }
            })
        );
        if (!response.success) {
            toast.add({
                title: 'Failed to load email',
                description: response.message || 'An unknown error occurred.',
                color: 'error'
            });
            mailData.value = null;
            emit('not-found');
            return;
        }
        mailData.value = response.data;
    } finally {
        isLoading.value = false;
    }
}

watch(
    () => [props.accountId, props.folderPath, props.mailUid] as const,
    () => loadMail(),
    { immediate: true }
);

// ── Helpers ──

function formatFullDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatAddressList(addresses: Array<{ name?: string; address: string }>): string {
    return addresses.map(a => a.name ? `${a.name} <${a.address}>` : a.address).join(', ');
}

function isUnread(m: MailData): boolean {
    return !m.flags?.seen;
}

const subject = computed(() => mailData.value?.subject || '(No subject)');
const showDetails = ref(false);

// ── Remote image / content policy ──

// Normally pre-warmed by the global auth middleware before this component ever
// mounts; refreshed here too as a defensive no-op fallback (cheap when cached).
const remoteContentPolicyStore = useRemoteContentPolicyStore();
remoteContentPolicyStore.refreshIfNeeded();

const senderAddress = computed(() => mailData.value?.from?.address?.trim().toLowerCase() || null);
const senderDomain = computed(() => extractDomain(senderAddress.value));

const resolvedRemotePolicy = computed(() => remoteContentPolicyStore.resolve(senderAddress.value));

// One-time "load images for this message only"; reset whenever a different mail loads.
const loadRemoteOnce = ref(false);
watch(
    () => [props.accountId, props.folderPath, props.mailUid] as const,
    () => { loadRemoteOnce.value = false; }
);

// Block remote content unless the sender is explicitly allowed or the user chose
// to load it once for this message.
const shouldBlockRemote = computed(
    () => !loadRemoteOnce.value && resolvedRemotePolicy.value !== 'allow'
);

const sanitized = computed(() => {
    if (!mailData.value?.body?.html) return { html: '', hasRemoteContent: false };
    return useSanitizeHtml(mailData.value.body.html, {
        wrapForDarkMode: true,
        blockRemoteContent: shouldBlockRemote.value,
    });
});
const sanitizedHtml = computed(() => sanitized.value.html);

// Show the banner only when we actually blocked remote content and the user has
// not yet made a permanent choice (allow/block) for this sender.
const showRemoteBanner = computed(
    () => shouldBlockRemote.value
        && resolvedRemotePolicy.value === 'unset'
        && sanitized.value.hasRemoteContent
);

function loadRemoteImagesOnce() {
    loadRemoteOnce.value = true;
}

type RemoteMenuItem = { label: string; icon: string; onSelect: () => void };

const remoteContentMenu = computed(() => {
    const addr = senderAddress.value;
    const domain = senderDomain.value;

    const allowGroup: RemoteMenuItem[] = [];
    if (domain) allowGroup.push({
        label: `Always load from @${domain}`,
        icon: 'i-lucide-image',
        onSelect: () => remoteContentPolicyStore.setDomainPolicy(domain, 'allow'),
    });
    if (addr) allowGroup.push({
        label: `Always load from ${addr}`,
        icon: 'i-lucide-image',
        onSelect: () => remoteContentPolicyStore.setAddressPolicy(addr, 'allow'),
    });

    const blockGroup: RemoteMenuItem[] = [];
    if (domain) blockGroup.push({
        label: `Never load from @${domain}`,
        icon: 'i-lucide-image-off',
        onSelect: () => remoteContentPolicyStore.setDomainPolicy(domain, 'block'),
    });
    if (addr) blockGroup.push({
        label: `Never load from ${addr}`,
        icon: 'i-lucide-image-off',
        onSelect: () => remoteContentPolicyStore.setAddressPolicy(addr, 'block'),
    });

    return [allowGroup, blockGroup].filter(g => g.length > 0);
});

const hasHtmlBody = computed(() => !!mailData.value?.body?.html);
const hasTextBody = computed(() => !!mailData.value?.body?.text);
const hasAttachments = computed(() => (mailData.value?.attachments?.length ?? 0) > 0);

// ── Attachments ──
// Attachments are streamed from the API on demand and never stored/cached server-
// side. The backend addresses each attachment by its index within the mail, which
// matches this array's order — so the v-for index doubles as the attachment id.

const { downloadAttachment, openAttachment } = useMailAttachments();
const downloadingIdx = ref<number | null>(null);

function isImageAttachment(contentType?: string): boolean {
    return !!contentType?.startsWith('image/');
}

function attachmentRef(idx: number) {
    return {
        accountId: props.accountId,
        mailboxPath: systemFolderPath.value,
        mailUid: props.mailUid,
        attachmentId: idx,
    };
}

async function handleDownloadAttachment(idx: number, filename?: string) {
    downloadingIdx.value = idx;
    try {
        await downloadAttachment(attachmentRef(idx), filename);
    } finally {
        downloadingIdx.value = null;
    }
}

function handleOpenAttachment(idx: number, filename?: string, contentType?: string) {
    openAttachment(attachmentRef(idx), filename, contentType);
}

// ── Action handlers (placeholders) ──

function notAvailable(title: string) {
    toast.add({
        title: `${title} not available`,
        description: 'This feature will be available soon.',
        color: 'warning'
    });
}

const handleArchive = () => notAvailable('Archive');
const handleDelete = () => notAvailable('Delete');
const handleMarkUnread = () => notAvailable('Mark as unread');
const handleSpam = () => notAvailable('Mark as spam');
const handleReply = () => notAvailable('Reply');
const handleReplyAll = () => notAvailable('Reply All');
const handleForward = () => notAvailable('Forward');
const handlePrint = () => window.print();

const moreActions = computed(() => [
    [{
        label: 'Mark as unread',
        icon: 'i-lucide-mail',
        onSelect: handleMarkUnread,
    }],
    [{
        label: 'Print',
        icon: 'i-lucide-printer',
        onSelect: handlePrint,
    }],
    [{
        label: 'Report spam',
        icon: 'i-lucide-shield-alert',
        onSelect: handleSpam,
    }, {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: handleDelete,
    }],
]);

defineExpose({ reload: loadMail });
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <!-- Loading skeleton -->
        <div v-if="isLoading && !mailData" class="p-4 space-y-4">
            <div class="rounded-lg border border-default p-4">
                <div class="flex items-start gap-4">
                    <USkeleton class="size-12 rounded-full" />
                    <div class="flex-1 space-y-2">
                        <USkeleton class="h-4 w-1/3" />
                        <USkeleton class="h-3 w-1/2" />
                        <USkeleton class="h-3 w-1/4" />
                    </div>
                </div>
            </div>
            <div class="rounded-lg border border-default p-4 space-y-3">
                <USkeleton class="h-4 w-full" />
                <USkeleton class="h-4 w-11/12" />
                <USkeleton class="h-4 w-10/12" />
                <USkeleton class="h-4 w-9/12" />
            </div>
        </div>

        <!-- Not found -->
        <div v-else-if="!mailData" class="flex flex-col items-center justify-center py-16">
            <UIcon name="i-lucide-mail-x" class="size-12 mb-4 text-dimmed" />
            <p class="text-muted mb-4">Email not found</p>
            <UButton
                v-if="closable"
                color="neutral"
                variant="outline"
                size="sm"
                @click="emit('close')"
            >
                Close
            </UButton>
        </div>

        <template v-else>
            <!-- Toolbar -->
            <div class="flex items-center gap-1 px-3 py-2 border-b border-default shrink-0">
                <UButton
                    v-if="closable"
                    icon="i-lucide-x"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    @click="emit('close')"
                />

                <div class="flex-1" />

                <div class="flex items-center gap-0.5 shrink-0">
                    <UTooltip text="Archive">
                        <UButton icon="i-lucide-archive" color="neutral" variant="ghost" size="sm" @click="handleArchive" />
                    </UTooltip>
                    <UTooltip text="Delete">
                        <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" @click="handleDelete" />
                    </UTooltip>
                    <UTooltip text="Mark as unread">
                        <UButton icon="i-lucide-mail" color="neutral" variant="ghost" size="sm" @click="handleMarkUnread" />
                    </UTooltip>

                    <div class="w-px h-5 bg-default mx-1" />

                    <UTooltip text="Reply">
                        <UButton icon="i-lucide-reply" color="neutral" variant="ghost" size="sm" @click="handleReply" />
                    </UTooltip>
                    <UTooltip text="Reply All">
                        <UButton icon="i-lucide-reply-all" color="neutral" variant="ghost" size="sm" @click="handleReplyAll" />
                    </UTooltip>
                    <UTooltip text="Forward">
                        <UButton icon="i-lucide-forward" color="neutral" variant="ghost" size="sm" @click="handleForward" />
                    </UTooltip>

                    <div class="w-px h-5 bg-default mx-1" />

                    <UDropdownMenu :items="moreActions">
                        <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="sm" />
                    </UDropdownMenu>
                </div>
            </div>

            <!-- Body (scrollable) -->
            <div class="flex-1 min-h-0 overflow-y-auto">
                <div class="p-4 space-y-4">
                    <!-- Subject -->
                    <h1 class="text-xl font-semibold text-highlighted wrap-break-word">
                        {{ subject }}
                    </h1>

                    <!-- Sender card -->
                    <div class="rounded-lg border border-default p-4">
                        <div class="flex items-start gap-4">
                            <Gravatar
                                :email="mailData.from?.address"
                                size="lg"
                                class="shrink-0"
                            />
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span class="font-semibold text-default">
                                        {{ mailData.from?.name || mailData.from?.address || 'Unknown' }}
                                    </span>
                                    <UBadge v-if="isUnread(mailData)" color="primary" size="xs">Unread</UBadge>
                                    <UBadge v-if="mailData.priority === 'high'" color="error" variant="subtle" size="xs">
                                        High Priority
                                    </UBadge>
                                </div>
                                <div class="text-sm text-muted truncate">
                                    {{ mailData.from?.address }}
                                </div>
                                <div v-if="mailData.date" class="text-xs text-dimmed mt-1">
                                    {{ formatFullDate(mailData.date) }}
                                </div>

                                <button
                                    class="text-xs text-primary hover:underline mt-2 flex items-center gap-1 cursor-pointer"
                                    @click="showDetails = !showDetails"
                                >
                                    <UIcon
                                        :name="showDetails ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                                        class="size-3.5"
                                    />
                                    {{ showDetails ? 'Hide details' : 'Show details' }}
                                </button>

                                <div v-if="showDetails" class="mt-3 space-y-1.5 text-sm border-t border-default pt-3">
                                    <div v-if="mailData.to.length > 0" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-14">To:</span>
                                        <span class="text-muted break-all">{{ formatAddressList(mailData.to) }}</span>
                                    </div>
                                    <div v-if="mailData.cc.length > 0" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-14">Cc:</span>
                                        <span class="text-muted break-all">{{ formatAddressList(mailData.cc) }}</span>
                                    </div>
                                    <div v-if="mailData.bcc.length > 0" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-14">Bcc:</span>
                                        <span class="text-muted break-all">{{ formatAddressList(mailData.bcc) }}</span>
                                    </div>
                                    <div v-if="mailData.replyTo && mailData.replyTo.length > 0" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-14">Reply-To:</span>
                                        <span class="text-muted break-all">{{ formatAddressList(mailData.replyTo) }}</span>
                                    </div>
                                    <div v-if="mailData.messageId" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-14">Message-ID:</span>
                                        <span class="text-muted font-mono text-xs break-all">{{ mailData.messageId }}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center gap-1 shrink-0">
                                <UButton
                                    icon="i-lucide-reply"
                                    color="primary"
                                    variant="soft"
                                    size="sm"
                                    @click="handleReply"
                                >
                                    Reply
                                </UButton>
                            </div>
                        </div>
                    </div>

                    <!-- Body -->
                    <div class="rounded-lg border border-default overflow-hidden">
                        <div v-if="hasHtmlBody">
                            <!-- Remote-content notice: images are not loaded automatically -->
                            <div
                                v-if="showRemoteBanner"
                                class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-default bg-elevated/50 text-sm"
                            >
                                <UIcon name="i-lucide-image-off" class="size-4 text-muted shrink-0" />
                                <span class="text-muted flex-1 min-w-40">
                                    External images have been blocked to protect your privacy.
                                </span>
                                <div class="flex items-center gap-1 shrink-0">
                                    <UButton
                                        color="primary"
                                        variant="soft"
                                        size="xs"
                                        icon="i-lucide-image"
                                        @click="loadRemoteImagesOnce"
                                    >
                                        Show images
                                    </UButton>
                                    <UDropdownMenu v-if="remoteContentMenu.length" :items="remoteContentMenu">
                                        <UButton
                                            color="neutral"
                                            variant="ghost"
                                            size="xs"
                                            icon="i-lucide-chevron-down"
                                            trailing
                                        >
                                            Options
                                        </UButton>
                                    </UDropdownMenu>
                                </div>
                            </div>

                            <ClientOnly>
                                <iframe
                                    :srcdoc="sanitizedHtml"
                                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                                    referrerpolicy="no-referrer"
                                    class="w-full border-0 block min-h-[60vh]"
                                    style="background: transparent;"
                                />
                                <template #fallback>
                                    <div class="flex items-center justify-center py-12">
                                        <USkeleton class="h-40 w-full" />
                                    </div>
                                </template>
                            </ClientOnly>
                        </div>

                        <div v-else-if="hasTextBody" class="p-4">
                            <pre class="whitespace-pre-wrap text-sm text-muted leading-relaxed font-sans m-0">{{ mailData.body?.text }}</pre>
                        </div>

                        <div v-else class="p-6 text-center">
                            <UIcon name="i-lucide-mail-x" class="size-8 text-dimmed mb-2" />
                            <p class="text-sm text-dimmed">This email has no content.</p>
                        </div>
                    </div>

                    <!-- Attachments -->
                    <div v-if="hasAttachments" class="rounded-lg border border-default p-4">
                        <div class="text-sm font-semibold text-default mb-3 flex items-center gap-2">
                            <UIcon name="i-lucide-paperclip" class="size-4" />
                            Attachments ({{ mailData.attachments.length }})
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div
                                v-for="(attachment, idx) in mailData.attachments"
                                :key="idx"
                                class="flex items-center gap-3 p-3 rounded-lg border border-default hover:border-primary focus-within:border-primary transition-colors"
                            >
                                <!-- Semantic button for preview: native keyboard/SR support,
                                     kept a sibling of the download button (no nested controls). -->
                                <button
                                    type="button"
                                    :aria-label="`Preview ${attachment.filename || 'attachment'}`"
                                    class="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    @click="handleOpenAttachment(idx, attachment.filename ?? undefined, attachment.contentType)"
                                >
                                    <div class="shrink-0 p-2 rounded-md bg-primary/10">
                                        <UIcon
                                            :name="isImageAttachment(attachment.contentType) ? 'i-lucide-image' : 'i-lucide-file'"
                                            class="size-5 text-primary"
                                        />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-sm font-medium text-default truncate">
                                            {{ attachment.filename || 'Unnamed file' }}
                                        </div>
                                        <div class="text-xs text-dimmed">
                                            {{ Utils.formatFileSize(attachment.size) }}
                                        </div>
                                    </div>
                                </button>
                                <UTooltip text="Download">
                                    <UButton
                                        icon="i-lucide-download"
                                        color="neutral"
                                        variant="ghost"
                                        size="xs"
                                        :aria-label="`Download ${attachment.filename || 'attachment'}`"
                                        :loading="downloadingIdx === idx"
                                        @click="handleDownloadAttachment(idx, attachment.filename ?? undefined)"
                                    />
                                </UTooltip>
                            </div>
                        </div>
                    </div>

                    <!-- Footer actions -->
                    <div class="flex items-center justify-between pt-2 border-t border-default">
                        <div class="flex items-center gap-2">
                            <UButton icon="i-lucide-reply" color="neutral" variant="outline" size="sm" @click="handleReply">
                                Reply
                            </UButton>
                            <UButton icon="i-lucide-reply-all" color="neutral" variant="outline" size="sm" @click="handleReplyAll">
                                Reply All
                            </UButton>
                            <UButton icon="i-lucide-forward" color="neutral" variant="outline" size="sm" @click="handleForward">
                                Forward
                            </UButton>
                        </div>
                        <div class="text-xs text-dimmed">
                            UID: {{ mailUid }}
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
