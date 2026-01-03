<script setup lang="ts">
import Gravatar from '~/components/Gravatar.vue';
import { useGravatarURL } from '~/composables/useGravatarURL';
import type { MailAccount, MailRessource } from '~/utils/types';
type Mail = MailRessource.IMail;

useSeoMeta({
    title: 'Inbox | Delivr',
    description: 'Manage your emails'
});

const toast = useToast();

// Helper to strip HTML tags for preview
const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

const mailAccount = useSubrouterInjectedData<MailAccount>('mail_account').inject();

const mails = await useAPIAsyncData(`/mail-accounts/${mailAccount.data.value.id}/mails`, async () => {
    const response = await useAPI(api => api.getMailAccountsMailAccountIdMails({
        path: {
            mailAccountID: mailAccount.data.value.id
        }
    }));
    if (!response.success) {
        toast.add({
            title: 'Error loading emails',
            description: response.message || 'An unknown error occurred while fetching emails.',
            color: 'error'
        });
        return [];
    }
    return response.data;
});

const mails_data = mails.data;

const selectedMails = ref<number[]>([]);
const searchQuery = ref<string>('');

// Filter emails based on search
const filteredMails = computed(() => {
    const query = searchQuery.value;
    if (!query) return mails_data.value;
    
    const queryLower = query.toLowerCase();
    const result = [];
    
    for (const mail of mails_data.value) {
        const bodyText = mail.body?.text || (mail.body?.html ? stripHtml(mail.body.html) : '');
        if (
            mail.subject?.toLowerCase().includes(queryLower) ||
            mail.from?.name?.toLowerCase().includes(queryLower) ||
            mail.from?.address?.toLowerCase().includes(queryLower) ||
            bodyText?.toLowerCase().includes(queryLower)
        ) {
            result.push(mail);
        }
    }
    
    return result;
});

const unreadCount = computed(() => {
    let count = 0;
    for (const mail of mails_data.value) {
        // @TODO: add unred flag
        if ((mail as any).unread) count++;
    }
    return count;
});

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m`;
    } else if (diffHours < 24) {
        return `${diffHours}h`;
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays}d`;
    } else {
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    }
};

const openEmail = (mailId: number) => {
    navigateTo(`/inbox/${mailId}`);
};

const toggleSelection = (mailId: number) => {
    const index = selectedMails.value.indexOf(mailId);
    if (index > -1) {
        selectedMails.value.splice(index, 1);
    } else {
        selectedMails.value.push(mailId);
    }
};

const selectAll = () => {
    if (selectedMails.value.length === filteredMails.value.length) {
        selectedMails.value = [];
    } else {
        const uids: number[] = [];
        for (const mail of filteredMails.value) {
            uids.push(mail.uid);
        }
        selectedMails.value = uids;
    }
};

const markAsRead = () => {
    for (const uid of selectedMails.value) {
        for (const mail of mails_data.value) {
            if (mail.uid === uid) {
                (mail as any).unread = false;
                break;
            }
        }
    }
    selectedMails.value = [];
};

const markAsUnread = () => {
    for (const uid of selectedMails.value) {
        for (const mail of mails_data.value) {
            if (mail.uid === uid) {
                (mail as any).unread = true;
                break;
            }
        }
    }
    selectedMails.value = [];
};

const deleteMails = () => {
    const remaining = [];
    for (const mail of mails_data.value) {
        if (!selectedMails.value.includes(mail.uid)) {
            remaining.push(mail);
        }
    }
    mails_data.value = remaining;
    selectedMails.value = [];
};

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="Inbox"
                icon="i-lucide-inbox"
                :description="unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'"
            />
        </template>

        <template #body>
            <DashboardPageBody>
                <!-- Search and Actions Bar -->
                <div class="flex items-center gap-3 mb-4">
                    <UInput
                        v-model="searchQuery"
                        icon="i-lucide-search"
                        placeholder="Search emails..."
                        class="flex-1"
                        size="md"
                    />
                    <UButton
                        icon="i-lucide-refresh-cw"
                        color="neutral"
                        variant="outline"
                        size="md"
                        aria-label="Refresh"
                    />
                </div>

                <!-- Bulk Actions Toolbar -->
                <div v-if="selectedMails.length > 0" class="flex items-center gap-2 mb-4 p-3 bg-primary-50 dark:bg-primary-950 rounded-lg border border-primary-200 dark:border-primary-800">
                    <UCheckbox
                        :model-value="selectedMails.length === filteredMails.length"
                        :indeterminate="selectedMails.length > 0 && selectedMails.length < filteredMails.length"
                        @update:model-value="selectAll"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {{ selectedMails.length }} selected
                    </span>
                    <div class="flex-1"></div>
                    <UButton
                        icon="i-lucide-mail-open"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="markAsRead"
                    >
                        Mark as read
                    </UButton>
                    <UButton
                        icon="i-lucide-mail"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="markAsUnread"
                    >
                        Mark as unread
                    </UButton>
                    <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="sm"
                        @click="deleteMails"
                    >
                        Delete
                    </UButton>
                </div>

                <!-- Email List -->
                <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    <div v-if="filteredMails.length === 0" class="p-12 text-center">
                        <UIcon name="i-lucide-inbox" class="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p class="text-gray-500 dark:text-gray-400">
                            {{ searchQuery ? 'No emails found' : 'Your inbox is empty' }}
                        </p>
                    </div>

                    <div
                        v-for="mail in filteredMails"
                        :key="mail.uid"
                        class="group flex items-start gap-3 p-4 border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors"
                        :class="{
                            'bg-white dark:bg-gray-950': !(mail as any).unread,
                            'bg-blue-50 dark:bg-blue-950/30': (mail as any).unread,
                            'bg-primary-50 dark:bg-primary-950/50': selectedMails.includes(mail.uid)
                        }"
                        @click="openEmail(mail.uid)"
                    >
                        <!-- Checkbox -->
                        <UCheckbox
                            :model-value="selectedMails.includes(mail.uid)"
                            class="mt-1"
                            @click.stop
                            @update:model-value="toggleSelection(mail.uid)"
                        />

                        <!-- Avatar -->
                        <Gravatar
                            :email="mail.from?.address"
                            size="md"
                            class="shrink-0 mt-0.5"
                        />

                        <!-- Email Content -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-2 mb-1">
                                <div class="flex items-center gap-2 min-w-0 flex-1">
                                    <span 
                                        class="font-semibold text-gray-900 dark:text-gray-100 truncate"
                                        :class="{ 'font-bold': (mail as any).unread }"
                                    >
                                        {{ mail.from?.name || "Unknown" }}
                                    </span>
                                    <UBadge
                                        v-if="(mail as any).unread"
                                        color="primary"
                                        size="xs"
                                        class="shrink-0"
                                    >
                                        New
                                    </UBadge>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <UIcon
                                        v-if="(mail as any).hasAttachment"
                                        name="i-lucide-paperclip"
                                        class="w-4 h-4 text-gray-400"
                                    />
                                    <span class="text-sm text-gray-500 dark:text-gray-400">
                                        {{ mail.date ? formatDate(mail.date.toString()) : "Unknown" }}
                                    </span>
                                </div>
                            </div>
                            <div 
                                class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 truncate"
                                :class="{ 'font-semibold': (mail as any).unread }"
                            >
                                {{ mail.subject }}
                            </div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {{ mail.body?.text ? stripHtml(mail.body.text) : (mail.body?.html ? stripHtml(mail.body.html) : 'No preview available.') }}
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>