<script setup lang="ts">
import type { MailAccountWithMailboxes, MailData } from '~/utils/types';
import { useSanitizeHtml } from '~/composables/useSanitizeHtml';
import { Utils } from '~/utils';

const route = useRoute();
const toast = useToast();

const folderPath = decodeURIComponent(route.params.folderPath as string);
const systemFolderPath = folderPath.toLowerCase() === 'inbox' ? 'INBOX' : folderPath;
const mailUID = parseInt(route.params.mailUID as string);

const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const accountId = mailAccount.data.value.id;

const mail = await useAPIAsyncData<MailData | null>(
    `/mail-accounts/${accountId}/mailboxes/${systemFolderPath}/mails/${mailUID}`,
    async () => {
        const response = await useAPI(api => api.getMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUid({
            path: {
                mailAccountID: accountId,
                mailboxPath: systemFolderPath,
                mailUID: mailUID,
            }
        }));
        if (!response.success) {
            toast.add({
                title: `Failed to load email`,
                description: response.message || 'An unknown error occurred.',
                color: 'error'
            });
            return null;
        }
        return response.data;
    }
);

const mailData = mail.data;

// Redirect if mail not found
if (!mailData.value) {
    navigateTo(`/mail/${accountId}/folder/${encodeURIComponent(folderPath)}`);
}

const subject = computed(() => mailData.value?.subject || '(No subject)');

useSeoMeta({
    title: `${subject.value} | Delivr`,
    description: 'View email'
});

// ── Helpers ──

function formatFullDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('de-DE', {
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

function isFlagged(m: MailData): boolean {
    return !!m.flags?.flagged;
}

// ── Detail expansion ──

const showDetails = ref(false);

// ── Sanitized HTML body with dark mode wrapper ──

const sanitizedHtml = computed(() => {
    if (!mailData.value?.body?.html) return '';
    return useSanitizeHtml(mailData.value.body.html, { wrapForDarkMode: true });
});

const hasHtmlBody = computed(() => !!mailData.value?.body?.html);
const hasTextBody = computed(() => !!mailData.value?.body?.text);
const hasAttachments = computed(() => (mailData.value?.attachments?.length ?? 0) > 0);

// ── Action handlers (placeholders for backend) ──

function handleArchive() {
    toast.add({
        title: 'Archive not available',
        description: 'This feature will be available soon.',
        color: 'warning'
    });
}

function handleDelete() {
    toast.add({
        title: 'Delete not available',
        description: 'Move to trash will be available soon.',
        color: 'warning'
    });
}

function handleMarkUnread() {
    toast.add({
        title: 'Mark as unread not available',
        description: 'This feature will be available soon.',
        color: 'warning'
    });
}

function handleToggleStar() {
    toast.add({
        title: 'Star feature not available',
        description: 'This feature will be available soon.',
        color: 'warning'
    });
}

function handleSpam() {
    toast.add({
        title: 'Mark as spam not available',
        description: 'This feature will be available soon.',
        color: 'warning'
    });
}

function handleReply() {
    toast.add({
        title: 'Reply not available',
        description: 'Email composing will be available soon.',
        color: 'warning'
    });
}

function handleReplyAll() {
    toast.add({
        title: 'Reply All not available',
        description: 'Email composing will be available soon.',
        color: 'warning'
    });
}

function handleForward() {
    toast.add({
        title: 'Forward not available',
        description: 'Email composing will be available soon.',
        color: 'warning'
    });
}

function handlePrint() {
    window.print();
}

// ── Navigation ──

function goBack() {
    navigateTo(`/mail/${accountId}/folder/${encodeURIComponent(folderPath)}`);
}

// ── Dropdown actions ──

const moreActions = computed(() => [
    [{
        label: 'Mark as unread',
        icon: 'i-lucide-mail',
        click: handleMarkUnread,
    }, {
        label: isFlagged(mailData.value!) ? 'Remove star' : 'Add star',
        icon: isFlagged(mailData.value!) ? 'i-lucide-star-off' : 'i-lucide-star',
        click: handleToggleStar,
    }],
    [{
        label: 'Print',
        icon: 'i-lucide-printer',
        click: handlePrint,
    }],
    [{
        label: 'Report spam',
        icon: 'i-lucide-shield-alert',
        click: handleSpam,
    }, {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        click: handleDelete,
    }],
]);

</script>

<template>
    <UDashboardPanel v-if="mailData">
        <template #header>
            <DashboardPageHeader
                :title="subject"
                icon="i-lucide-mail-open"
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
                    <div class="flex items-center gap-0.5">
                        <!-- Archive -->
                        <UTooltip text="Archive">
                            <UButton
                                icon="i-lucide-archive"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="handleArchive"
                            />
                        </UTooltip>

                        <!-- Delete -->
                        <UTooltip text="Delete">
                            <UButton
                                icon="i-lucide-trash-2"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="handleDelete"
                            />
                        </UTooltip>

                        <!-- Mark unread -->
                        <UTooltip text="Mark as unread">
                            <UButton
                                icon="i-lucide-mail"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="handleMarkUnread"
                            />
                        </UTooltip>

                        <!-- Star -->
                        <UTooltip :text="isFlagged(mailData) ? 'Remove star' : 'Add star'">
                            <UButton
                                :icon="isFlagged(mailData) ? 'i-lucide-star' : 'i-lucide-star'"
                                :color="isFlagged(mailData) ? 'warning' : 'neutral'"
                                :variant="isFlagged(mailData) ? 'soft' : 'ghost'"
                                size="sm"
                                @click="handleToggleStar"
                            />
                        </UTooltip>

                        <div class="w-px h-5 bg-default mx-1" />

                        <!-- Reply -->
                        <UTooltip text="Reply">
                            <UButton
                                icon="i-lucide-reply"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="handleReply"
                            />
                        </UTooltip>

                        <!-- Reply All -->
                        <UTooltip text="Reply All">
                            <UButton
                                icon="i-lucide-reply-all"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="handleReplyAll"
                            />
                        </UTooltip>

                        <!-- Forward -->
                        <UTooltip text="Forward">
                            <UButton
                                icon="i-lucide-forward"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="handleForward"
                            />
                        </UTooltip>

                        <div class="w-px h-5 bg-default mx-1" />

                        <!-- More actions -->
                        <UDropdownMenu :items="moreActions">
                            <UButton
                                icon="i-lucide-ellipsis-vertical"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                            />
                        </UDropdownMenu>
                    </div>
                </template>
            </DashboardPageHeader>
        </template>

        <template #body>
            <DashboardPageBody class="h-full">
                <div class="space-y-4 h-full flex flex-col">

                    <!-- Sender / Recipient Card -->
                    <div class="rounded-lg border border-default bg-elevated p-4">
                        <div class="flex items-start gap-4">
                            <Gravatar
                                :email="mailData.from?.address"
                                size="lg"
                                class="shrink-0"
                            />
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-0.5">
                                    <span class="font-semibold text-default">
                                        {{ mailData.from?.name || mailData.from?.address || 'Unknown' }}
                                    </span>
                                    <UBadge v-if="isUnread(mailData)" color="primary" size="xs">Unread</UBadge>
                                    <UBadge v-if="mailData.priority === 'high'" color="error" variant="subtle" size="xs">
                                        High Priority
                                    </UBadge>
                                    <UIcon 
                                        v-if="isFlagged(mailData)" 
                                        name="i-lucide-star" 
                                        class="size-4 text-amber-500" 
                                    />
                                </div>
                                <div class="text-sm text-muted">
                                    {{ mailData.from?.address }}
                                </div>
                                <div v-if="mailData.date" class="text-xs text-dimmed mt-1">
                                    {{ formatFullDate(mailData.date) }}
                                </div>

                                <!-- Expandable details -->
                                <button
                                    class="text-xs text-primary hover:underline mt-2 flex items-center gap-1 cursor-pointer"
                                    @click="showDetails = !showDetails"
                                >
                                    <UIcon :name="showDetails ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3.5" />
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
                                    <div v-if="mailData.replyTo" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-14">Reply-To:</span>
                                        <span class="text-muted break-all">
                                            {{ mailData.replyTo.name ? `${mailData.replyTo.name} <${mailData.replyTo.address}>` : mailData.replyTo.address }}
                                        </span>
                                    </div>
                                    <div v-if="mailData.messageId" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-14">Message-ID:</span>
                                        <span class="text-muted font-mono text-xs break-all">{{ mailData.messageId }}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Quick actions on right side -->
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
                    <div class="rounded-lg border border-default overflow-y-auto grow">
                        <!-- HTML body rendered in sandboxed iframe for maximum isolation -->
                        <div v-if="hasHtmlBody" class="bg-default h-full">
                            <ClientOnly>
                                <iframe
                                    :srcdoc="sanitizedHtml"
                                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                                    referrerpolicy="no-referrer"
                                    class="w-full border-0 block h-full"
                                    style="background: transparent;"
                                />
                                <template #fallback>
                                    <div class="flex items-center justify-center py-12">
                                        <USkeleton class="h-40 w-full" />
                                    </div>
                                </template>
                            </ClientOnly>
                        </div>

                        <!-- Plain text body -->
                        <div v-else-if="hasTextBody" class="p-4 bg-default">
                            <pre class="whitespace-pre-wrap text-sm text-muted leading-relaxed font-sans m-0">{{ mailData.body?.text }}</pre>
                        </div>

                        <!-- No body -->
                        <div v-else class="p-6 bg-default text-center">
                            <UIcon name="i-lucide-mail-x" class="size-8 text-dimmed mb-2" />
                            <p class="text-sm text-dimmed">This email has no content.</p>
                        </div>
                    </div>

                    <!-- Attachments -->
                    <div v-if="hasAttachments" class="rounded-lg border border-default bg-elevated p-4">
                        <div class="text-sm font-semibold text-default mb-3 flex items-center gap-2">
                            <UIcon name="i-lucide-paperclip" class="size-4" />
                            Attachments ({{ mailData.attachments.length }})
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div
                                v-for="(attachment, idx) in mailData.attachments"
                                :key="idx"
                                class="flex items-center gap-3 p-3 rounded-lg border border-default bg-default hover:border-primary transition-colors cursor-pointer"
                            >
                                <div class="shrink-0 p-2 rounded-md bg-primary/10">
                                    <UIcon
                                        :name="attachment.contentType?.startsWith('image/') ? 'i-lucide-image' : 'i-lucide-file'"
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
                                <UButton
                                    icon="i-lucide-download"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    disabled
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Footer actions -->
                    <div class="flex items-center justify-between pt-2 border-t border-default">
                        <div class="flex items-center gap-2">
                            <UButton
                                icon="i-lucide-reply"
                                color="neutral"
                                variant="outline"
                                size="sm"
                                @click="handleReply"
                            >
                                Reply
                            </UButton>
                            <UButton
                                icon="i-lucide-reply-all"
                                color="neutral"
                                variant="outline"
                                size="sm"
                                @click="handleReplyAll"
                            >
                                Reply All
                            </UButton>
                            <UButton
                                icon="i-lucide-forward"
                                color="neutral"
                                variant="outline"
                                size="sm"
                                @click="handleForward"
                            >
                                Forward
                            </UButton>
                        </div>
                        <div class="text-xs text-dimmed">
                            Message UID: {{ mailUID }}
                        </div>
                    </div>

                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>

    <!-- Not found state -->
    <UDashboardPanel v-else>
        <template #body>
            <div class="flex flex-col items-center justify-center py-16">
                <UIcon name="i-lucide-mail-x" class="size-12 mb-4 text-dimmed" />
                <p class="text-muted mb-4">Email not found</p>
                <UButton color="neutral" variant="outline" @click="goBack">
                    Back to {{ folderPath }}
                </UButton>
            </div>
        </template>
    </UDashboardPanel>
</template>
