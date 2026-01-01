<script setup lang="ts">
import type { Mail } from '~/utils/types';
import DOMPurify from 'isomorphic-dompurify';

useSeoMeta({
    title: 'Inbox | Delivr',
    description: 'Manage your emails'
});

const router = useRouter();

// Helper to strip HTML tags for preview
const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

// Mock data - in a real app, this would come from an API
const mails = ref<Mail[]>([
    {
        id: 1,
        unread: true,
        from: {
            id: 1,
            name: 'Sarah Johnson',
            email: 'sarah.j@example.com',
            avatar: { src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah' }
        },
        subject: 'Welcome to Delivr - Get Started Today',
        body: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">Welcome to Delivr! 🎉</h2>
            <p>Hi there!</p>
            <p>We're <strong>excited</strong> to have you on board. Here are some tips to get started with Delivr:</p>
            <ul>
                <li><strong>Organize your inbox:</strong> Use labels and filters</li>
                <li><strong>Set up notifications:</strong> Stay on top of important emails</li>
                <li><strong>Use keyboard shortcuts:</strong> Speed up your workflow</li>
            </ul>
            <p>If you have any questions, feel free to reach out!</p>
            <p style="color: #666;">Best regards,<br>Sarah Johnson</p>
        </div>`,
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        hasAttachment: true,
        isHTML: true
    },
    {
        id: 2,
        unread: true,
        from: {
            id: 2,
            name: 'Marketing Team',
            email: 'marketing@company.com',
            avatar: { src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marketing' }
        },
        subject: 'Q1 Campaign Results & Analysis',
        body: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Dear Team,</p>
            <p>Please find attached the comprehensive analysis of our Q1 marketing campaigns.</p>
            <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #1e40af;">Key Highlights:</h3>
                <ul style="margin-bottom: 0;">
                    <li>Email campaign performance increased by <strong>45%</strong></li>
                    <li>Social media engagement up by <strong>67%</strong></li>
                    <li>Overall ROI improved by <strong>32%</strong></li>
                </ul>
            </div>
            <p>Please review and come prepared for Friday's meeting.</p>
        </div>`,
        date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        hasAttachment: true,
        isHTML: true
    },
    {
        id: 3,
        unread: false,
        from: {
            id: 3,
            name: 'John Doe',
            email: 'john.doe@example.com',
            avatar: { src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John' }
        },
        subject: 'Meeting Notes - Product Review',
        body: 'Here are the notes from today\'s product review meeting. Key points discussed include...',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        hasAttachment: false,
        isHTML: false
    },
    {
        id: 4,
        unread: false,
        from: {
            id: 4,
            name: 'Support Team',
            email: 'support@delivr.app',
            avatar: { src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Support' }
        },
        subject: 'Your ticket has been resolved',
        body: 'Good news! Your support ticket #12345 has been successfully resolved. We hope...',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        hasAttachment: false,
        isHTML: false
    },
    {
        id: 5,
        unread: false,
        from: {
            id: 5,
            name: 'Newsletter',
            email: 'newsletter@techweekly.com',
            avatar: { src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Newsletter' }
        },
        subject: 'Tech Weekly - Latest Updates in Web Development',
        body: 'This week\'s highlights: New Nuxt 4 features, TypeScript 5.3 released, and more...',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        hasAttachment: false,
        isHTML: false
    }
]);

const selectedMails = ref<number[]>([]);
const searchQuery = ref<string>('');

// Filter emails based on search
const filteredMails = computed(() => {
    const query = searchQuery.value;
    if (!query) return mails.value;
    
    const queryLower = query.toLowerCase();
    const result = [];
    
    for (const mail of mails.value) {
        const bodyText = mail.isHTML ? stripHtml(mail.body) : mail.body;
        if (
            mail.subject.toLowerCase().includes(queryLower) ||
            mail.from.name.toLowerCase().includes(queryLower) ||
            mail.from.email.toLowerCase().includes(queryLower) ||
            bodyText.toLowerCase().includes(queryLower)
        ) {
            result.push(mail);
        }
    }
    
    return result;
});

const unreadCount = computed(() => {
    let count = 0;
    for (const mail of mails.value) {
        if (mail.unread) count++;
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
        const ids: number[] = [];
        for (const mail of filteredMails.value) {
            ids.push(mail.id);
        }
        selectedMails.value = ids;
    }
};

const markAsRead = () => {
    for (const id of selectedMails.value) {
        for (const mail of mails.value) {
            if (mail.id === id) {
                mail.unread = false;
                break;
            }
        }
    }
    selectedMails.value = [];
};

const markAsUnread = () => {
    for (const id of selectedMails.value) {
        for (const mail of mails.value) {
            if (mail.id === id) {
                mail.unread = true;
                break;
            }
        }
    }
    selectedMails.value = [];
};

const deleteMails = () => {
    const remaining = [];
    for (const mail of mails.value) {
        if (!selectedMails.value.includes(mail.id)) {
            remaining.push(mail);
        }
    }
    mails.value = remaining;
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
                        :key="mail.id"
                        class="group flex items-start gap-3 p-4 border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors"
                        :class="{
                            'bg-white dark:bg-gray-950': !mail.unread,
                            'bg-blue-50 dark:bg-blue-950/30': mail.unread,
                            'bg-primary-50 dark:bg-primary-950/50': selectedMails.includes(mail.id)
                        }"
                        @click="openEmail(mail.id)"
                    >
                        <!-- Checkbox -->
                        <UCheckbox
                            :model-value="selectedMails.includes(mail.id)"
                            class="mt-1"
                            @click.stop
                            @update:model-value="toggleSelection(mail.id)"
                        />

                        <!-- Avatar -->
                        <UAvatar
                            :src="mail.from.avatar?.src"
                            :alt="mail.from.name"
                            size="md"
                            class="shrink-0 mt-0.5"
                        />

                        <!-- Email Content -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-2 mb-1">
                                <div class="flex items-center gap-2 min-w-0 flex-1">
                                    <span 
                                        class="font-semibold text-gray-900 dark:text-gray-100 truncate"
                                        :class="{ 'font-bold': mail.unread }"
                                    >
                                        {{ mail.from.name }}
                                    </span>
                                    <UBadge
                                        v-if="mail.unread"
                                        color="primary"
                                        size="xs"
                                        class="shrink-0"
                                    >
                                        New
                                    </UBadge>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <UIcon
                                        v-if="mail.hasAttachment"
                                        name="i-lucide-paperclip"
                                        class="w-4 h-4 text-gray-400"
                                    />
                                    <span class="text-sm text-gray-500 dark:text-gray-400">
                                        {{ formatDate(mail.date) }}
                                    </span>
                                </div>
                            </div>
                            <div 
                                class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 truncate"
                                :class="{ 'font-semibold': mail.unread }"
                            >
                                {{ mail.subject }}
                            </div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {{ mail.isHTML ? stripHtml(mail.body) : mail.body }}
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>