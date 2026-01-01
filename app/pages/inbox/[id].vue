<script setup lang="ts">
import type { Mail } from '~/utils/types';
import DOMPurify from 'isomorphic-dompurify';

const route = useRoute();
const router = useRouter();
const mailId = computed(() => parseInt(route.params.id as string));

// Sanitize HTML content
const sanitizeHtml = (html: string) => {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'div', 'span', 'blockquote', 'pre', 'code'],
        ALLOWED_ATTR: ['href', 'target', 'style', 'class'],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    });
};

// Mock data - should match the data from inbox.vue
// In a real app, this would be fetched from an API
const allMails: Mail[] = [
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
            <p>We're <strong>excited</strong> to have you on board with Delivr. Our platform is designed to help you manage your emails more efficiently and effectively.</p>
            
            <h3 style="color: #1e40af; margin-top: 20px;">Here are some tips to get started:</h3>
            <ul style="line-height: 1.8;">
                <li><strong>Organize your inbox:</strong> Use labels and filters to keep your emails organized</li>
                <li><strong>Set up notifications:</strong> Stay on top of important emails with custom notifications</li>
                <li><strong>Use keyboard shortcuts:</strong> Speed up your workflow with our built-in shortcuts</li>
                <li><strong>Connect multiple accounts:</strong> Manage all your email accounts from one place</li>
            </ul>
            
            <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                <p style="margin: 0;"><strong>💡 Pro Tip:</strong> Press <code>?</code> anywhere to see all available keyboard shortcuts!</p>
            </div>
            
            <p>If you have any questions or need assistance, don't hesitate to reach out to our support team. We're here to help!</p>
            
            <p style="color: #666; margin-top: 30px;">
                Best regards,<br>
                <strong>Sarah Johnson</strong><br>
                Delivr Team
            </p>
        </div>`,
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
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
            
            <div style="background: #f0f9ff; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1e40af;">📊 Key Highlights:</h3>
                <ul style="margin-bottom: 0; line-height: 1.8;">
                    <li>Email campaign performance increased by <strong style="color: #059669;">45%</strong></li>
                    <li>Social media engagement up by <strong style="color: #059669;">67%</strong></li>
                    <li>Overall ROI improved by <strong style="color: #059669;">32%</strong></li>
                </ul>
            </div>
            
            <p><strong>The detailed breakdown includes:</strong></p>
            <ul>
                <li>Channel-wise performance metrics</li>
                <li>Audience demographics and behavior</li>
                <li>Conversion funnel analysis</li>
                <li>Recommendations for Q2</li>
            </ul>
            
            <p>Please review the attachment and come prepared for our strategy meeting on <strong>Friday</strong>.</p>
            
            <p style="color: #666; margin-top: 30px;">
                Best regards,<br>
                <strong>Marketing Team</strong>
            </p>
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
        body: `Hi everyone,

Here are the notes from today's product review meeting:

Attendees:
- John Doe (Product Manager)
- Jane Smith (Designer)
- Mike Wilson (Developer)

Key Points Discussed:
1. New feature implementation timeline
2. User feedback on recent updates
3. Bug fixes prioritization
4. Q2 roadmap review

Action Items:
- Jane to finalize the design mockups by EOW
- Mike to provide technical feasibility assessment
- Schedule follow-up meeting for next week

Let me know if I missed anything!

Best,
John`,
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
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
        body: `Hello,

Good news! Your support ticket #12345 has been successfully resolved.

Issue: Email sync problems with IMAP account
Resolution: Updated server configuration and reset authentication tokens

Your account should now be syncing properly. If you continue to experience any issues, please don't hesitate to reach out to us.

Thank you for your patience!

Best regards,
Delivr Support Team`,
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
        body: `Welcome to this week's Tech Weekly!

This Week's Highlights:

🚀 Nuxt 4 Features
The latest version of Nuxt brings enhanced performance and new developer tools. Check out the migration guide to get started.

📝 TypeScript 5.3 Released
New features include improved type inference and better IDE support.

🎨 CSS Container Queries
Finally gaining widespread browser support. Time to rethink responsive design!

🔧 Tool of the Week
Vite 5.0 - Lightning-fast build tool that's changing the game.

That's all for this week! Stay tuned for more updates.

Happy coding!
Tech Weekly Team`,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        hasAttachment: false,
        isHTML: false
    }
];

const mail = computed(() => allMails.find(m => m.id === mailId.value));

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
    console.log('Reply to:', mail.value?.id);
};

const forward = () => {
    // TODO: Implement forward functionality
    console.log('Forward:', mail.value?.id);
};

const deleteMail = () => {
    // TODO: Implement delete functionality
    console.log('Delete:', mail.value?.id);
    goBack();
};

const markAsUnread = () => {
    // TODO: Implement mark as unread
    console.log('Mark as unread:', mail.value?.id);
    goBack();
};

if (!mail.value) {
    // Email not found, redirect to inbox
    navigateTo('/inbox');
}

useSeoMeta({
    title: mail.value?.subject ? `${mail.value.subject} | Delivr` : 'Email | Delivr',
    description: 'View email details'
});

</script>

<template>
    <UDashboardPanel v-if="mail">
        <template #header>
            <DashboardPageHeader
                title="Email"
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
                                {{ mail.subject }}
                            </h1>
                            <div class="flex items-center gap-2 shrink-0">
                                <UBadge v-if="mail.unread" color="primary" size="sm">
                                    Unread
                                </UBadge>
                                <UBadge v-if="mail.hasAttachment" color="neutral" variant="outline" size="sm">
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
.html-email-content {
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
}
</style>
