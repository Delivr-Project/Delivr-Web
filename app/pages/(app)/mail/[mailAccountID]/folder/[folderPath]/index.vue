<script setup lang="ts">
import type { MailAccountWithMailboxes, MailListItem } from '~/utils/types';
import { Utils } from '~/utils';

const route = useRoute();
const toast = useToast();
const { isMailSearchOpen } = useDashboard();

const folderPath = decodeURIComponent(route.params.folderPath as string);
const systemFolderPath = folderPath.toLowerCase() === 'inbox' ? 'INBOX' : folderPath;
const uiFolderPath = folderPath.charAt(0).toUpperCase() + folderPath.slice(1).toLowerCase();

const folderIcon = computed(() => {
    const lower = folderPath.toLowerCase();
    if (lower === 'inbox') return 'i-lucide-inbox';
    if (lower === 'sent' || lower === 'sent mail' || lower === 'sent messages') return 'i-lucide-send';
    if (lower === 'drafts') return 'i-lucide-file-edit';
    if (lower === 'trash' || lower === 'deleted' || lower === 'deleted messages') return 'i-lucide-trash-2';
    if (lower === 'spam' || lower === 'junk') return 'i-lucide-shield-alert';
    if (lower === 'archive') return 'i-lucide-archive';
    return 'i-lucide-folder';
});

useSeoMeta({
    title: `${uiFolderPath} | Delivr`,
    description: `Manage your ${uiFolderPath} emails`
});

const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const accountId = mailAccount.data.value.id;

// Strip HTML for text preview
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

// Build preview text from mail body
function getPreview(mail: MailListItem): string {
    if (mail.body?.text) return Utils.truncate(stripHtml(mail.body.text), 120);
    if (mail.body?.html) return Utils.truncate(stripHtml(mail.body.html), 120);
    return 'No preview available';
}

// Format dates relative to now
function formatRelativeDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

// Check mail flag helpers
function isUnread(mail: MailListItem): boolean {
    return !mail.flags?.seen;
}

function isFlagged(mail: MailListItem): boolean {
    return !!mail.flags?.flagged;
}

function hasAttachments(mail: MailListItem): boolean {
    return mail.attachments.length > 0;
}

// ── Pagination ──

const PAGE_SIZE = 25;
const currentPage = ref(1);

// ── Search ──

const searchQuery = ref('');
const searchDebounced = ref('');

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (val) => {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
        searchDebounced.value = val;
        currentPage.value = 1; // Reset to first page on search
    }, 400);
});

// ── Data fetching ──

const mails = await useAPIAsyncData<MailListItem[]>(
    `/mail-accounts/${accountId}/mailboxes/${systemFolderPath}/mails`,
    async () => {
        const response = await useAPI(api => api.getMailAccountsByMailAccountIdMailboxesByMailboxPathMails({
            path: {
                mailAccountID: accountId,
                mailboxPath: systemFolderPath,
            },
            query: {
                order: 'newest',
                limit: PAGE_SIZE,
                offset: (currentPage.value - 1) * PAGE_SIZE,
                ...(searchDebounced.value ? { searchString: searchDebounced.value } : {}),
            }
        }));
        if (!response.success) {
            toast.add({
                title: 'Error loading emails',
                description: response.message || 'An unknown error occurred while fetching emails.',
                color: 'error'
            });
            return [] as MailListItem[];
        }
        return response.data;
    }
);

// Re-fetch when search or page changes
watch([searchDebounced, currentPage], () => {
    mails.refresh();
});

const mailList = mails.data;

// ── Pagination controls ──

const hasNextPage = computed(() => mailList.value.length === PAGE_SIZE);
const hasPrevPage = computed(() => currentPage.value > 1);

function nextPage() {
    if (hasNextPage.value) {
        currentPage.value++;
    }
}

function prevPage() {
    if (hasPrevPage.value) {
        currentPage.value--;
    }
}

// ── Selection state ──

const selectedUids = ref<Set<number>>(new Set());

function isSelected(uid: number): boolean {
    return selectedUids.value.has(uid);
}

function toggleSelection(uid: number) {
    const newSet = new Set(selectedUids.value);
    if (newSet.has(uid)) {
        newSet.delete(uid);
    } else {
        newSet.add(uid);
    }
    selectedUids.value = newSet;
}

function toggleSelectAll() {
    if (selectedUids.value.size === mailList.value.length) {
        selectedUids.value = new Set();
    } else {
        selectedUids.value = new Set(mailList.value.map(m => m.uid));
    }
}

function clearSelection() {
    selectedUids.value = new Set();
}

const hasSelection = computed(() => selectedUids.value.size > 0);
const allSelected = computed(() => mailList.value.length > 0 && selectedUids.value.size === mailList.value.length);
const someSelected = computed(() => selectedUids.value.size > 0 && selectedUids.value.size < mailList.value.length);

// ── Bulk actions ──

function handleBulkArchive() {
    toast.add({
        title: 'Archive not available',
        description: 'Bulk archive will be available soon.',
        color: 'warning'
    });
}

function handleBulkDelete() {
    toast.add({
        title: 'Delete not available',
        description: 'Bulk delete will be available soon.',
        color: 'warning'
    });
}

function handleBulkMarkRead() {
    toast.add({
        title: 'Mark as read not available',
        description: 'This feature will be available soon.',
        color: 'warning'
    });
}

function handleBulkMarkUnread() {
    toast.add({
        title: 'Mark as unread not available',
        description: 'This feature will be available soon.',
        color: 'warning'
    });
}

function handleBulkSpam() {
    toast.add({
        title: 'Mark as spam not available',
        description: 'This feature will be available soon.',
        color: 'warning'
    });
}

// ── Unread count ──

const unreadCount = computed(() => mailList.value.filter(m => isUnread(m)).length);

// ── Navigation ──

function openMail(uid: number) {
    navigateTo(`/mail/${accountId}/folder/${encodeURIComponent(folderPath)}/${uid}`);
}

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <!-- <UDashboardNavbar :ui='{
                center: "w-full",
            }'>
            
                <div class="grid grid-cols-[1fr_minmax(4rem,auto)_1fr] items-center w-full">

                    <div class="justify-self-start flex items-center gap-1.5 min-w-0">

                        <UIcon
                            :name="folderIcon"
                            class="iconify i-lucide:settings shrink-0 size-5 self-center me-1.5"
                            data-slot="icon"
                        />

                        <h1
                            class="flex items-center gap-1.5 font-semibold text-highlighted truncate"
                            data-slot="title"
                        >
                            {{ uiFolderPath }}
                        </h1>
                    </div>

                    <div class="justify-self-center">

                        <UDashboardSearchButton
                            class="bg-transparent ring-default"
                            label="Search..."
                        />
                        
                    </div>

                    <div class="justify-self-end">
                        <div class="px-2 mb-2">
                            <UButton
                                label="Compose"
                                icon="i-lucide-pen-square"
                                color="primary"
                                variant="solid"
                                size="md"
                                class="w-full justify-start"
                                :to="`/mail/${accountId}/compose`"
                            />
                        </div>
                    </div>
                </div>

            </UDashboardNavbar> -->
            <UDashboardNavbar
                :title="uiFolderPath"
                :icon="folderIcon"
                :ui='{
                    root: "grid grid-cols-[1fr_50%_1fr] sm:grid-cols-[1fr_20%_1fr] items-center",
                    left: "justify-self-start",
                    center: "justify-self-center w-full",
                    right: "justify-self-end",

                }'
                
            >
                <template #default>
                    <UButton
                        class="bg-transparent ring-default w-full justify-start text-muted"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-search"
                        @click="isMailSearchOpen = true"
                    >
                        <span class="flex-1 text-left">Search emails...</span>
                        <span class="flex items-center gap-1 text-xs">
                            <UKbd value="meta" size="sm" />
                            <UKbd value="K" size="sm" />
                        </span>
                    </UButton>
                </template>

                <template #right>
                    <div class="block md:hidden">
                        <UButton
                            icon="i-lucide-pen-square"
                            color="primary"
                            variant="solid"
                            size="md"
                            class="w-full justify-start"
                            :to="`/mail/${accountId}/compose`"
                        />
                    </div>
                    <div class="hidden md:block">
                        <UButton
                            label="Compose"
                            icon="i-lucide-pen-square"
                            color="primary"
                            variant="solid"
                            size="md"
                            class="w-full justify-start"
                            :to="`/mail/${accountId}/compose`"
                        />
                    </div>
                </template>

            </UDashboardNavbar>
        </template>

        <template #body>
            <DashboardPageBody>
                <!-- Toolbar: Search + Actions -->
                <div class="flex items-center gap-3 mb-4">
                    <UInput
                        v-model="searchQuery"
                        icon="i-lucide-search"
                        placeholder="Search emails..."
                        class="flex-1"
                        size="md"
                    />
                    <UTooltip text="Refresh">
                        <UButton
                            icon="i-lucide-refresh-cw"
                            color="neutral"
                            variant="outline"
                            size="md"
                            :loading="mails.loading.value"
                            @click="mails.refresh()"
                        />
                    </UTooltip>
                </div>

                <!-- Bulk Actions Bar -->
                <div
                    v-if="hasSelection"
                    class="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/5"
                >
                    <UCheckbox
                        :model-value="allSelected"
                        :indeterminate="someSelected"
                        @update:model-value="toggleSelectAll"
                    />
                    <span class="text-sm font-medium text-default">
                        {{ selectedUids.size }} selected
                    </span>
                    <div class="flex-1" />
                    
                    <!-- Bulk action buttons -->
                    <div class="flex items-center gap-1">
                        <UTooltip text="Archive">
                            <UButton
                                icon="i-lucide-archive"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="handleBulkArchive"
                            />
                        </UTooltip>
                        <UTooltip text="Mark as read">
                            <UButton
                                icon="i-lucide-mail-open"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="handleBulkMarkRead"
                            />
                        </UTooltip>
                        <UTooltip text="Mark as unread">
                            <UButton
                                icon="i-lucide-mail"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="handleBulkMarkUnread"
                            />
                        </UTooltip>
                        <UTooltip text="Report spam">
                            <UButton
                                icon="i-lucide-shield-alert"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="handleBulkSpam"
                            />
                        </UTooltip>
                        <UTooltip text="Delete">
                            <UButton
                                icon="i-lucide-trash-2"
                                color="error"
                                variant="ghost"
                                size="xs"
                                @click="handleBulkDelete"
                            />
                        </UTooltip>
                    </div>

                    <div class="w-px h-5 bg-default mx-1" />
                    
                    <UButton
                        icon="i-lucide-x"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        @click="clearSelection"
                    >
                        Clear
                    </UButton>
                </div>

                <!-- Mail List -->
                <div class="rounded-lg border border-default overflow-hidden">
                    <!-- Select All row -->
                    <div
                        v-if="mailList.length > 0 && !hasSelection"
                        class="flex items-center justify-between gap-3 px-4 py-2 border-b border-default bg-elevated"
                    >
                        <div class="flex items-center gap-3">
                            <UCheckbox
                                :model-value="false"
                                @update:model-value="toggleSelectAll"
                            />
                            <span class="text-xs text-muted">Select all</span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-muted">
                            <span>Page {{ currentPage }}</span>
                            <span>·</span>
                            <span>{{ PAGE_SIZE }} per page</span>
                        </div>
                    </div>

                    <!-- Empty state -->
                    <div v-if="mailList.length === 0 && !mails.loading.value" class="flex flex-col items-center justify-center py-16 px-4">
                        <UIcon :name="folderIcon" class="size-12 mb-4 text-dimmed" />
                        <p class="text-muted text-sm mb-2">
                            {{ searchQuery ? 'No emails match your search' : `No emails in ${uiFolderPath}` }}
                        </p>
                        <p v-if="searchQuery" class="text-xs text-dimmed">
                            Try adjusting your search terms
                        </p>
                    </div>

                    <!-- Loading skeleton -->
                    <div v-else-if="mails.loading.value && mailList.length === 0" class="divide-y divide-default">
                        <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-4 py-3.5">
                            <USkeleton class="size-5 rounded" />
                            <USkeleton class="size-9 rounded-full" />
                            <div class="flex-1 space-y-2">
                                <USkeleton class="h-4 w-1/3" />
                                <USkeleton class="h-3.5 w-2/3" />
                                <USkeleton class="h-3 w-1/2" />
                            </div>
                            <USkeleton class="h-3 w-10" />
                        </div>
                    </div>

                    <!-- Mail rows -->
                    <div
                        v-for="mail in mailList"
                        :key="mail.uid"
                        class="group flex items-start gap-3 px-4 py-3.5 border-b border-default last:border-b-0 cursor-pointer transition-all duration-150"
                        :class="[
                            isSelected(mail.uid)
                                ? 'bg-primary/10 border-l-2 border-l-primary'
                                : isUnread(mail)
                                    ? 'bg-primary/5 hover:bg-primary/10'
                                    : 'hover:bg-elevated'
                        ]"
                        @click="openMail(mail.uid)"
                    >
                        <!-- Checkbox -->
                        <div class="pt-0.5" @click.stop>
                            <UCheckbox
                                :model-value="isSelected(mail.uid)"
                                @update:model-value="toggleSelection(mail.uid)"
                            />
                        </div>

                        <!-- Avatar -->
                        <Gravatar
                            :email="mail.from?.address"
                            size="md"
                            class="shrink-0 mt-0.5"
                        />

                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2 mb-0.5">
                                <div class="flex items-center gap-2 min-w-0">
                                    <span
                                        class="truncate text-sm"
                                        :class="isUnread(mail) ? 'font-semibold text-default' : 'text-muted'"
                                    >
                                        {{ mail.from?.name || mail.from?.address || 'Unknown' }}
                                    </span>
                                    <UBadge v-if="isUnread(mail)" color="primary" size="xs" class="shrink-0">
                                        New
                                    </UBadge>
                                    <UIcon
                                        v-if="isFlagged(mail)"
                                        name="i-lucide-star"
                                        class="size-3.5 shrink-0 text-amber-500"
                                    />
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0">
                                    <UIcon
                                        v-if="hasAttachments(mail)"
                                        name="i-lucide-paperclip"
                                        class="size-3.5 text-dimmed"
                                    />
                                    <span class="text-xs text-muted">
                                        {{ mail.date ? formatRelativeDate(mail.date) : '' }}
                                    </span>
                                </div>
                            </div>
                            <div
                                class="text-sm truncate mb-0.5"
                                :class="isUnread(mail) ? 'font-medium text-default' : 'text-muted'"
                            >
                                {{ mail.subject || '(No subject)' }}
                            </div>
                            <div class="text-xs text-dimmed truncate">
                                {{ getPreview(mail) }}
                            </div>
                        </div>

                        <!-- Quick actions on hover -->
                        <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                            <UTooltip text="Archive">
                                <UButton
                                    icon="i-lucide-archive"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                />
                            </UTooltip>
                            <UTooltip text="Delete">
                                <UButton
                                    icon="i-lucide-trash-2"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                />
                            </UTooltip>
                            <UTooltip :text="isUnread(mail) ? 'Mark as read' : 'Mark as unread'">
                                <UButton
                                    :icon="isUnread(mail) ? 'i-lucide-mail-open' : 'i-lucide-mail'"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                />
                            </UTooltip>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div class="flex items-center justify-between mt-4 pt-4 border-t border-default">
                    <div class="text-sm text-muted">
                        <span v-if="mailList.length > 0">
                            Showing {{ (currentPage - 1) * PAGE_SIZE + 1 }} - {{ (currentPage - 1) * PAGE_SIZE + mailList.length }}
                        </span>
                        <span v-else>No results</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <UButton
                            icon="i-lucide-chevron-left"
                            color="neutral"
                            variant="outline"
                            size="sm"
                            :disabled="!hasPrevPage"
                            @click="prevPage"
                        >
                            Previous
                        </UButton>
                        <span class="text-sm text-muted px-2">
                            Page {{ currentPage }}
                        </span>
                        <UButton
                            icon="i-lucide-chevron-right"
                            trailing
                            color="neutral"
                            variant="outline"
                            size="sm"
                            :disabled="!hasNextPage"
                            @click="nextPage"
                        >
                            Next
                        </UButton>
                    </div>
                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>
