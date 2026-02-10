<script setup lang="ts">
import type { MailAccount, MailData } from '~/utils/types';

const folderPath = decodeURIComponent(useRoute().params.folderPath as string);
const systemFolderPath = folderPath.toLowerCase() === 'inbox' ? 'INBOX' : folderPath;
const uiFolderPath = folderPath.charAt(0).toUpperCase() + folderPath.slice(1).toLowerCase();

const mailUID = parseInt(useRoute().params.mailUID as string);

const toast = useToast();

const mailAccount = useSubrouterInjectedData<MailAccount>('mail_account').inject();

const mail = await useAPIAsyncData(`/mail-accounts/${mailAccount.data.value.id}/mailboxes/${systemFolderPath}/mails/${mailUID}`, async () => {
    const response = await useAPI(api => api.getMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUid({
        path: {
            mailAccountID: mailAccount.data.value.id,
            mailboxPath: systemFolderPath,
            mailUID: mailUID
        }
    }));
    if (!response.success) {
        toast.add({
            title: `Failed to load email with UID ${mailUID}`,
            description: response.message || 'An unknown error occurred while fetching emails.',
            color: 'error'
        });
        navigateTo(`/mail/${mailAccount.data.value.id}/folder/${encodeURIComponent(folderPath)}`);
        return {} as MailData;
    }
    return response.data;
});

const mailData = mail.data;

useSeoMeta({
    title: `${uiFolderPath} | Delivr`,
    description: 'Manage your emails'
});

const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const goBack = () => {
    navigateTo('/inbox');
};

const reply = () => {
    // TODO: Implement reply functionality
    console.log('Reply to:', mailData.value?.uid);
};

const forward = () => {
    // TODO: Implement forward functionality
    console.log('Forward:', mailData.value?.uid);
};

const deleteMail = () => {
    // TODO: Implement delete functionality
    console.log('Delete:', mailData.value?.uid);
    goBack();
};

const markAsUnread = () => {
    // TODO: Implement mark as unread
    console.log('Mark as unread:', mailData.value?.uid);
    goBack();
};

if (!mailData.value) {
    // Email not found, redirect to inbox
    navigateTo('/inbox');
}

const finalSubject = mailData.value?.subject || 'Email with Unknown Subject';

useSeoMeta({
    title: `${finalSubject} | Delivr`,
    description: 'View email details'
});

</script>

<template>
    <UDashboardPanel v-if="mailData">
        <template #header>
            <DashboardPageHeader
                :title="finalSubject"
                icon="i-lucide-mail"
            >
                <template #leading>
                    <UButton
                        icon="i-lucide-arrow-left"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="goBack"
                    >
                        Back to Inbox
                    </UButton>
                </template>
            </DashboardPageHeader>
        </template>

        <template #body>
            <DashboardPageBody>
                <!-- Email Header -->
                <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    <!-- Subject Line -->
                    <div class="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                        <div class="flex items-start justify-between gap-4 mb-4">
                            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {{ finalSubject }}
                            </h1>
                            <div class="flex items-center gap-2 shrink-0">
                                <UBadge v-if="mailData.unread" color="primary" size="sm">
                                    Unread
                                </UBadge>
                                <UBadge v-if="mailData.hasAttachment" color="neutral" variant="outline" size="sm">
                                    <UIcon name="i-lucide-paperclip" class="w-3 h-3 mr-1" />
                                    Attachment
                                </UBadge>
                            </div>
                        </div>

                        <!-- Sender Info -->
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex items-start gap-3">
                                <UAvatar
                                    :src="mail.from.avatar?.src"
                                    :alt="mail.from.name"
                                    size="lg"
                                />
                                <div>
                                    <div class="font-semibold text-gray-900 dark:text-gray-100">
                                        {{ mail.from.name }}
                                    </div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">
                                        {{ mail.from.email }}
                                    </div>
                                    <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                        {{ formatFullDate(mail.date) }}
                                    </div>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex items-center gap-2 shrink-0">
                                <UButton
                                    icon="i-lucide-reply"
                                    color="neutral"
                                    variant="outline"
                                    size="sm"
                                    @click="reply"
                                >
                                    Reply
                                </UButton>
                                <UDropdownMenu
                                    :items="[[
                                        { label: 'Forward', icon: 'i-lucide-forward', click: forward },
                                        { label: 'Mark as unread', icon: 'i-lucide-mail', click: markAsUnread }
                                    ], [
                                        { label: 'Delete', icon: 'i-lucide-trash-2', click: deleteMail, color: 'error' }
                                    ]]"
                                >
                                    <UButton
                                        icon="i-lucide-more-vertical"
                                        color="neutral"
                                        variant="ghost"
                                        size="sm"
                                    />
                                </UDropdownMenu>
                            </div>
                        </div>
                    </div>

                    <!-- Email Body -->
                    <div class="p-6 bg-gray-50 dark:bg-gray-900/50">
                        <div v-if="mail.isHTML" class="prose prose-sm dark:prose-invert max-w-none">
                            <div 
                                v-html="sanitizeHtml(mail.body)"
                                class="html-email-content"
                            ></div>
                        </div>
                        <div v-else class="prose prose-sm dark:prose-invert max-w-none">
                            <div class="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                                {{ mail.body }}
                            </div>
                        </div>
                    </div>

                    <!-- Attachments (if any) -->
                    <div v-if="mail.hasAttachment" class="p-6 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                        <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Attachments
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <!-- Mock attachments -->
                            <UCard
                                class="w-64 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                            >
                                <div class="flex items-center gap-3">
                                    <div class="p-2 bg-primary-100 dark:bg-primary-900 rounded">
                                        <UIcon name="i-lucide-file-text" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                            document.pdf
                                        </div>
                                        <div class="text-xs text-gray-500 dark:text-gray-400">
                                            2.4 MB
                                        </div>
                                    </div>
                                    <UButton
                                        icon="i-lucide-download"
                                        color="neutral"
                                        variant="ghost"
                                        size="xs"
                                    />
                                </div>
                            </UCard>
                        </div>
                    </div>

                    <!-- Reply Section -->
                    <div class="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                        <UButton
                            icon="i-lucide-reply"
                            color="primary"
                            size="md"
                            @click="reply"
                        >
                            Reply to {{ mail.from.name }}
                        </UButton>
                    </div>
                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>

<style scoped>
/*.html-email-content {
    color: rgb(55 65 81);
}

:global(.dark) .html-email-content {
    color: rgb(209 213 219);
}

.html-email-content :deep(h1),
.html-email-content :deep(h2),
.html-email-content :deep(h3),
.html-email-content :deep(h4),
.html-email-content :deep(h5),
.html-email-content :deep(h6) {
    font-weight: 700;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
}

.html-email-content :deep(h1) {
    font-size: 1.5rem;
    line-height: 2rem;
}

.html-email-content :deep(h2) {
    font-size: 1.25rem;
    line-height: 1.75rem;
}

.html-email-content :deep(h3) {
    font-size: 1.125rem;
    line-height: 1.75rem;
}

.html-email-content :deep(p) {
    margin-bottom: 0.75rem;
}

.html-email-content :deep(ul),
.html-email-content :deep(ol) {
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
}

.html-email-content :deep(li) {
    margin-bottom: 0.25rem;
}

.html-email-content :deep(a) {
    color: rgb(37 99 235);
    text-decoration: none;
}

.html-email-content :deep(a):hover {
    text-decoration: underline;
}

:global(.dark) .html-email-content :deep(a) {
    color: rgb(96 165 250);
}

.html-email-content :deep(strong) {
    font-weight: 600;
}

.html-email-content :deep(code) {
    background-color: rgb(243 244 246);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-family: ui-monospace, monospace;
}

:global(.dark) .html-email-content :deep(code) {
    background-color: rgb(31 41 55);
}

.html-email-content :deep(blockquote) {
    border-left: 4px solid rgb(209 213 219);
    padding-left: 1rem;
    font-style: italic;
    margin: 0.75rem 0;
}

:global(.dark) .html-email-content :deep(blockquote) {
    border-left-color: rgb(55 65 81);
}*/
</style>
