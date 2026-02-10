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

// ── Detail expansion ──

const showDetails = ref(false);

// ── Sanitized HTML body (client-side only) ──

const sanitizedHtml = computed(() => {
    if (!mailData.value?.body?.html) return '';
    return useSanitizeHtml(mailData.value.body.html);
});

const hasHtmlBody = computed(() => !!mailData.value?.body?.html);
const hasTextBody = computed(() => !!mailData.value?.body?.text);
const hasAttachments = computed(() => (mailData.value?.attachments?.length ?? 0) > 0);

// ── Navigation ──

function goBack() {
    navigateTo(`/mail/${accountId}/folder/${encodeURIComponent(folderPath)}`);
}

// ── Dropdown actions ──

const dropdownItems = computed(() => [
    [{
        label: 'Mark as unread',
        icon: 'i-lucide-mail',
        disabled: true,
    }],
    [{
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        disabled: true,
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
                    <div class="flex items-center gap-1">
                        <UTooltip text="Reply (coming soon)">
                            <UButton
                                icon="i-lucide-reply"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                disabled
                            />
                        </UTooltip>
                        <UTooltip text="Forward (coming soon)">
                            <UButton
                                icon="i-lucide-forward"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                disabled
                            />
                        </UTooltip>
                        <UDropdownMenu :items="dropdownItems">
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
            <DashboardPageBody>
                <div class="space-y-4">

                    <!-- Sender / Recipient Card -->
                    <div class="rounded-lg border border-default bg-elevated p-5">
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
                                </div>
                                <div class="text-sm text-muted">
                                    {{ mailData.from?.address }}
                                </div>
                                <div v-if="mailData.date" class="text-xs text-dimmed mt-1">
                                    {{ formatFullDate(mailData.date) }}
                                </div>

                                <!-- Expandable details -->
                                <button
                                    class="text-xs text-muted hover:text-default mt-2 flex items-center gap-1 cursor-pointer"
                                    @click="showDetails = !showDetails"
                                >
                                    <UIcon :name="showDetails ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3.5" />
                                    {{ showDetails ? 'Hide details' : 'Show details' }}
                                </button>

                                <div v-if="showDetails" class="mt-3 space-y-1 text-sm">
                                    <div v-if="mailData.to.length > 0" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-12">To:</span>
                                        <span class="text-muted">{{ formatAddressList(mailData.to) }}</span>
                                    </div>
                                    <div v-if="mailData.cc.length > 0" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-12">Cc:</span>
                                        <span class="text-muted">{{ formatAddressList(mailData.cc) }}</span>
                                    </div>
                                    <div v-if="mailData.bcc.length > 0" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-12">Bcc:</span>
                                        <span class="text-muted">{{ formatAddressList(mailData.bcc) }}</span>
                                    </div>
                                    <div v-if="mailData.replyTo" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-12">Reply:</span>
                                        <span class="text-muted">
                                            {{ mailData.replyTo.name ? `${mailData.replyTo.name} <${mailData.replyTo.address}>` : mailData.replyTo.address }}
                                        </span>
                                    </div>
                                    <div v-if="mailData.messageId" class="flex gap-2">
                                        <span class="text-dimmed shrink-0 w-12">ID:</span>
                                        <span class="text-muted font-mono text-xs break-all">{{ mailData.messageId }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Body -->
                    <div class="rounded-lg border border-default overflow-hidden">
                        <!-- HTML body rendered in sandboxed iframe for maximum isolation -->
                        <div v-if="hasHtmlBody" class="p-5 bg-default">
                            <ClientOnly>
                                <iframe
                                    :srcdoc="sanitizedHtml"
                                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                                    referrerpolicy="no-referrer"
                                    class="w-full border-0 min-h-50"
                                    @load="($event.target as HTMLIFrameElement).style.height = (($event.target as HTMLIFrameElement).contentDocument?.documentElement?.scrollHeight || 400) + 'px'"
                                />
                                <template #fallback>
                                    <div class="flex items-center justify-center py-12">
                                        <USkeleton class="h-40 w-full" />
                                    </div>
                                </template>
                            </ClientOnly>
                        </div>

                        <!-- Plain text body -->
                        <div v-else-if="hasTextBody" class="p-5 bg-default">
                            <pre class="whitespace-pre-wrap text-sm text-muted leading-relaxed font-sans">{{ mailData.body?.text }}</pre>
                        </div>

                        <!-- No body -->
                        <div v-else class="p-5 bg-default text-center">
                            <p class="text-sm text-dimmed">This email has no content.</p>
                        </div>
                    </div>

                    <!-- Attachments -->
                    <div v-if="hasAttachments" class="rounded-lg border border-default bg-elevated p-5">
                        <div class="text-sm font-semibold text-default mb-3 flex items-center gap-2">
                            <UIcon name="i-lucide-paperclip" class="size-4" />
                            Attachments ({{ mailData.attachments.length }})
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <div
                                v-for="(attachment, idx) in mailData.attachments"
                                :key="idx"
                                class="flex items-center gap-3 px-4 py-3 rounded-lg border border-default bg-default min-w-50 max-w-75"
                            >
                                <div class="shrink-0 p-2 rounded-md bg-accented">
                                    <UIcon
                                        :name="attachment.contentType?.startsWith('image/') ? 'i-lucide-image' : 'i-lucide-file'"
                                        class="size-5 text-muted"
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
                            </div>
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
