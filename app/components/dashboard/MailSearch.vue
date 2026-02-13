<script setup lang="ts">
import type { PostMailAccountsByMailAccountIdSearchResponse, GetMailAccountsByMailAccountIdSearchResponse } from '~/api-client/types.gen';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import Gravatar from '~/components/Gravatar.vue';
import { useDebounceFn } from '@vueuse/core';
import { CalendarDate } from '@internationalized/date';

// ── Types ──

type SearchResultItem = NonNullable<
    (PostMailAccountsByMailAccountIdSearchResponse & { success: true })['data']['results'][number]
>;

// ── Props & State ──

const isOpen = defineModel<boolean>('open', { default: false });

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();

// ── Search State ──

const searchMode = ref<'quick' | 'advanced'>('quick');
const quickSearchQuery = ref('');
const isSearching = ref(false);

// Date picker popover states
const sinceDateOpen = ref(false);
const beforeDateOpen = ref(false);

// Advanced search filters
const filters = reactive({
    text: '',
    subject: '',
    from: '',
    to: '',
    body: '',
    since: null as Date | null,
    before: null as Date | null,
    hasAttachment: null as boolean | null,
    seen: null as boolean | null,
    flagged: null as boolean | null,
    answered: null as boolean | null,
    draft: null as boolean | null,
});

// Search results - flattened array of result items
const searchResults = ref<SearchResultItem[]>([]);
const totalResults = ref(0);

// Pagination
const currentPage = ref(1);
const PAGE_SIZE = 20;
const hasMoreResults = computed(() => searchResults.value.length < totalResults.value);

// ── Calendar value converters ──

const sinceCalendarValue = computed({
    get: () => filters.since ? new CalendarDate(filters.since.getFullYear(), filters.since.getMonth() + 1, filters.since.getDate()) : undefined,
    set: (val) => {
        if (val) {
            filters.since = new Date(val.year, val.month - 1, val.day);
            sinceDateOpen.value = false;
        } else {
            filters.since = null;
        }
    }
});

const beforeCalendarValue = computed({
    get: () => filters.before ? new CalendarDate(filters.before.getFullYear(), filters.before.getMonth() + 1, filters.before.getDate()) : undefined,
    set: (val) => {
        if (val) {
            filters.before = new Date(val.year, val.month - 1, val.day);
            beforeDateOpen.value = false;
        } else {
            filters.before = null;
        }
    }
});

// ── Quick Search Filter Parsing ──

const FILTER_PREFIXES = ['from:', 'to:', 'subject:', 'body:', 'has:', 'is:', 'after:', 'before:'] as const;

function parseQuickSearch(query: string): { filters: Partial<typeof filters>; remainingText: string } {
    const parsedFilters: Partial<typeof filters> = {};
    let remaining = query;
    
    // Parse from:
    const fromMatch = remaining.match(/\bfrom:(\S+)/i);
    if (fromMatch?.[1]) {
        parsedFilters.from = fromMatch[1].replace(/^["']|["']$/g, '');
        remaining = remaining.replace(fromMatch[0], '').trim();
    }
    
    // Parse to:
    const toMatch = remaining.match(/\bto:(\S+)/i);
    if (toMatch?.[1]) {
        parsedFilters.to = toMatch[1].replace(/^["']|["']$/g, '');
        remaining = remaining.replace(toMatch[0], '').trim();
    }
    
    // Parse subject: (supports quoted strings)
    const subjectMatch = remaining.match(/\bsubject:(?:"([^"]+)"|'([^']+)'|(\S+))/i);
    if (subjectMatch) {
        parsedFilters.subject = subjectMatch[1] || subjectMatch[2] || subjectMatch[3];
        remaining = remaining.replace(subjectMatch[0], '').trim();
    }
    
    // Parse body:
    const bodyMatch = remaining.match(/\bbody:(?:"([^"]+)"|'([^']+)'|(\S+))/i);
    if (bodyMatch) {
        parsedFilters.body = bodyMatch[1] || bodyMatch[2] || bodyMatch[3];
        remaining = remaining.replace(bodyMatch[0], '').trim();
    }
    
    // Parse has:attachment
    if (/\bhas:attachment/i.test(remaining)) {
        parsedFilters.hasAttachment = true;
        remaining = remaining.replace(/\bhas:attachment/i, '').trim();
    }
    
    // Parse is:unread / is:read
    if (/\bis:unread/i.test(remaining)) {
        parsedFilters.seen = false;
        remaining = remaining.replace(/\bis:unread/i, '').trim();
    } else if (/\bis:read/i.test(remaining)) {
        parsedFilters.seen = true;
        remaining = remaining.replace(/\bis:read/i, '').trim();
    }
    
    // Parse is:flagged / is:starred
    if (/\bis:(flagged|starred)/i.test(remaining)) {
        parsedFilters.flagged = true;
        remaining = remaining.replace(/\bis:(flagged|starred)/i, '').trim();
    }
    
    // Parse is:draft
    if (/\bis:draft/i.test(remaining)) {
        parsedFilters.draft = true;
        remaining = remaining.replace(/\bis:draft/i, '').trim();
    }
    
    // Parse after:date (YYYY-MM-DD or natural language)
    const afterMatch = remaining.match(/\bafter:(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (afterMatch?.[1]) {
        const date = new Date(afterMatch[1]);
        if (!isNaN(date.getTime())) {
            parsedFilters.since = date;
        }
        remaining = remaining.replace(afterMatch[0], '').trim();
    }
    
    // Parse before:date
    const beforeMatch = remaining.match(/\bbefore:(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (beforeMatch?.[1]) {
        const date = new Date(beforeMatch[1]);
        if (!isNaN(date.getTime())) {
            parsedFilters.before = date;
        }
        remaining = remaining.replace(beforeMatch[0], '').trim();
    }
    
    return { filters: parsedFilters, remainingText: remaining.trim() };
}

// Quick search filter hints shown below input
const quickSearchHints = computed(() => {
    const hints: string[] = [];
    const query = quickSearchQuery.value.toLowerCase();
    
    // Show relevant hints based on what user is typing
    if (query.endsWith('from:') || query.includes('from:')) return [];
    if (query.endsWith('to:') || query.includes('to:')) return [];
    
    if (!query.includes('from:')) hints.push('from:');
    if (!query.includes('to:')) hints.push('to:');
    if (!query.includes('subject:')) hints.push('subject:');
    if (!query.includes('has:')) hints.push('has:attachment');
    if (!query.includes('is:')) hints.push('is:unread');
    if (!query.includes('after:')) hints.push('after:');
    if (!query.includes('before:')) hints.push('before:');
    
    return hints.slice(0, 5);
});

// ── Computed ──

const hasActiveFilters = computed(() => {
    return filters.text || filters.subject || filters.from || filters.to || 
           filters.body || filters.since || filters.before ||
           filters.hasAttachment !== null || filters.seen !== null ||
           filters.flagged !== null || filters.answered !== null || filters.draft !== null;
});

const activeFilterChips = computed(() => {
    const chips: { key: string; label: string; icon?: string }[] = [];
    
    if (searchMode.value === 'quick' && quickSearchQuery.value) {
        chips.push({ key: 'quick', label: `"${quickSearchQuery.value}"`, icon: 'i-lucide-search' });
    }
    
    if (filters.text) chips.push({ key: 'text', label: `Text: ${filters.text}`, icon: 'i-lucide-text' });
    if (filters.subject) chips.push({ key: 'subject', label: `Subject: ${filters.subject}`, icon: 'i-lucide-heading' });
    if (filters.from) chips.push({ key: 'from', label: `From: ${filters.from}`, icon: 'i-lucide-user' });
    if (filters.to) chips.push({ key: 'to', label: `To: ${filters.to}`, icon: 'i-lucide-users' });
    if (filters.body) chips.push({ key: 'body', label: `Body: ${filters.body}`, icon: 'i-lucide-file-text' });
    if (filters.since) chips.push({ key: 'since', label: `After: ${formatDateShort(filters.since)}`, icon: 'i-lucide-calendar' });
    if (filters.before) chips.push({ key: 'before', label: `Before: ${formatDateShort(filters.before)}`, icon: 'i-lucide-calendar' });
    if (filters.hasAttachment !== null) chips.push({ 
        key: 'hasAttachment', 
        label: filters.hasAttachment ? 'Has attachments' : 'No attachments', 
        icon: 'i-lucide-paperclip' 
    });
    if (filters.seen !== null) chips.push({ 
        key: 'seen', 
        label: filters.seen ? 'Read' : 'Unread', 
        icon: filters.seen ? 'i-lucide-mail-open' : 'i-lucide-mail' 
    });
    if (filters.flagged !== null) chips.push({ 
        key: 'flagged', 
        label: filters.flagged ? 'Flagged' : 'Not flagged', 
        icon: 'i-lucide-star' 
    });
    if (filters.answered !== null) chips.push({ 
        key: 'answered', 
        label: filters.answered ? 'Replied' : 'Not replied', 
        icon: 'i-lucide-reply' 
    });
    if (filters.draft !== null) chips.push({ 
        key: 'draft', 
        label: filters.draft ? 'Drafts' : 'Not drafts', 
        icon: 'i-lucide-file-edit' 
    });
    
    return chips;
});

// ── Helpers ──

function formatDateShort(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelativeDate(dateNum: number): string {
    const date = new Date(dateNum);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function getPreview(item: SearchResultItem): string {
    const content = item.mail.body?.text || (item.mail.body?.html ? stripHtml(item.mail.body.html) : '');
    return content.substring(0, 150).trim() || '(No content)';
}

function isUnread(item: SearchResultItem): boolean {
    return !item.mail.flags?.seen;
}

function isFlagged(item: SearchResultItem): boolean {
    return item.mail.flags?.flagged ?? false;
}

function hasAttachments(item: SearchResultItem): boolean {
    return item.mail.attachments && item.mail.attachments.length > 0;
}

function addFilterHint(hint: string) {
    quickSearchQuery.value = (quickSearchQuery.value.trim() + ' ' + hint).trim();
}

// ── Search Actions ──

async function performSearch(append = false) {
    if (!currentMailAccount.value) return;
    
    isSearching.value = true;
    if (!append) {
        searchResults.value = [];
        currentPage.value = 1;
    }
    
    try {
        const offset = (currentPage.value - 1) * PAGE_SIZE;
        
        if (searchMode.value === 'quick' && quickSearchQuery.value.trim()) {
            // Parse quick search for filters
            const { filters: parsedFilters, remainingText } = parseQuickSearch(quickSearchQuery.value);
            
            // If we have parsed filters, use advanced search
            if (Object.keys(parsedFilters).length > 0) {
                const body: Record<string, unknown> = { ...parsedFilters };
                if (remainingText) body.text = remainingText;
                
                // Convert dates to ISO strings
                if (body.since instanceof Date) body.since = (body.since as Date).toISOString();
                if (body.before instanceof Date) body.before = (body.before as Date).toISOString();
                
                const result = await useAPI((api) => api.postMailAccountsByMailAccountIdSearch({
                    composable: '$fetch',
                    path: { mailAccountID: currentMailAccount.value!.id },
                    query: {
                        limit: PAGE_SIZE,
                        offset,
                        order: 'newest',
                    },
                    body
                }));
                
                if (result.success && result.data) {
                    if (append) {
                        searchResults.value = [...searchResults.value, ...result.data.results];
                    } else {
                        searchResults.value = result.data.results;
                    }
                    totalResults.value = result.data.total;
                }
            } else {
                // Simple quick search
                const result = await useAPI((api) => api.getMailAccountsByMailAccountIdSearch({
                    composable: '$fetch',
                    path: { mailAccountID: currentMailAccount.value!.id },
                    query: {
                        q: quickSearchQuery.value.trim(),
                        limit: PAGE_SIZE,
                        offset,
                        order: 'newest',
                    }
                }));
                
                if (result.success && result.data) {
                    if (append) {
                        searchResults.value = [...searchResults.value, ...result.data.results];
                    } else {
                        searchResults.value = result.data.results;
                    }
                    totalResults.value = result.data.total;
                }
            }
        } else if (searchMode.value === 'advanced' && hasActiveFilters.value) {
            // Advanced search
            const body: Record<string, unknown> = {};
            
            if (filters.text) body.text = filters.text;
            if (filters.subject) body.subject = filters.subject;
            if (filters.from) body.from = filters.from;
            if (filters.to) body.to = filters.to;
            if (filters.body) body.body = filters.body;
            if (filters.since) body.since = filters.since.toISOString();
            if (filters.before) body.before = filters.before.toISOString();
            if (filters.hasAttachment !== null) body.hasAttachment = filters.hasAttachment;
            if (filters.seen !== null) body.seen = filters.seen;
            if (filters.flagged !== null) body.flagged = filters.flagged;
            if (filters.answered !== null) body.answered = filters.answered;
            if (filters.draft !== null) body.draft = filters.draft;
            
            const result = await useAPI((api) => api.postMailAccountsByMailAccountIdSearch({
                composable: '$fetch',
                path: { mailAccountID: currentMailAccount.value!.id },
                query: {
                    limit: PAGE_SIZE,
                    offset,
                    order: 'newest',
                },
                body
            }));
            
            if (result.success && result.data) {
                if (append) {
                    searchResults.value = [...searchResults.value, ...result.data.results];
                } else {
                    searchResults.value = result.data.results;
                }
                totalResults.value = result.data.total;
            }
        }
    } catch (error) {
        console.error('Search failed:', error);
    } finally {
        isSearching.value = false;
    }
}

function loadMore() {
    currentPage.value++;
    performSearch(true);
}

function removeFilter(key: string) {
    if (key === 'quick') {
        quickSearchQuery.value = '';
    } else if (key in filters) {
        (filters as Record<string, unknown>)[key] = 
            key === 'hasAttachment' || key === 'seen' || key === 'flagged' || key === 'answered' || key === 'draft' 
                ? null 
                : key === 'since' || key === 'before' ? null : '';
    }
    if (searchResults.value.length > 0 || hasActiveFilters.value || quickSearchQuery.value) {
        performSearch();
    }
}

function clearAllFilters() {
    quickSearchQuery.value = '';
    filters.text = '';
    filters.subject = '';
    filters.from = '';
    filters.to = '';
    filters.body = '';
    filters.since = null;
    filters.before = null;
    filters.hasAttachment = null;
    filters.seen = null;
    filters.flagged = null;
    filters.answered = null;
    filters.draft = null;
    searchResults.value = [];
    totalResults.value = 0;
    currentPage.value = 1;
}

function openMail(item: SearchResultItem) {
    const mailboxPath = item.mailboxPath || 'INBOX';
    navigateTo(`/mail/${currentMailAccount.value?.id}/folder/${encodeURIComponent(mailboxPath)}/${item.mail.uid}`);
    isOpen.value = false;
}

// ── Debounced search ──

const debouncedSearch = useDebounceFn(() => {
    performSearch();
}, 400);

// Watch for quick search changes
watch(quickSearchQuery, () => {
    if (searchMode.value === 'quick' && quickSearchQuery.value.trim()) {
        debouncedSearch();
    }
});

// ── Keyboard shortcut ──

defineShortcuts({
    'meta_k': () => {
        isOpen.value = !isOpen.value;
    },
    'escape': () => {
        if (isOpen.value) {
            isOpen.value = false;
        }
    }
});

// ── Reset on open ──

watch(isOpen, (open) => {
    if (open) {
        currentPage.value = 1;
    }
});
</script>

<template>
    <UModal
        v-model:open="isOpen"
        :ui="{
            content: 'sm:max-w-3xl sm:max-h-[85vh]',
        }"
    >
        <template #content>
            <div class="flex flex-col h-full max-h-[85vh]">
                <!-- Header -->
                <div class="px-4 py-3 border-b border-default">
                    <div class="flex items-center gap-3">
                        <UIcon name="i-lucide-search" class="size-5 text-muted shrink-0" />
                        <UInput
                            v-if="searchMode === 'quick'"
                            v-model="quickSearchQuery"
                            placeholder="Search emails..."
                            variant="none"
                            size="lg"
                            class="flex-1"
                            autofocus
                            @keydown.enter="performSearch"
                        />
                        <UInput
                            v-else
                            v-model="filters.text"
                            placeholder="Search all fields..."
                            variant="none"
                            size="lg"
                            class="flex-1"
                            autofocus
                        />
                        <div class="flex items-center gap-1">
                            <UTooltip :text="searchMode === 'quick' ? 'Switch to advanced search' : 'Switch to quick search'">
                                <UButton
                                    :icon="searchMode === 'quick' ? 'i-lucide-sliders-horizontal' : 'i-lucide-search'"
                                    color="neutral"
                                    variant="ghost"
                                    size="sm"
                                    @click="searchMode = searchMode === 'quick' ? 'advanced' : 'quick'"
                                />
                            </UTooltip>
                            <UButton
                                icon="i-lucide-x"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                @click="isOpen = false"
                            />
                        </div>
                    </div>
                    
                    <!-- Mode indicator + Filter hints -->
                    <div class="flex items-center gap-2 mt-2 text-xs text-muted">
                        <UKbd value="meta" />
                        <UKbd value="K" />
                        <span class="mx-1">to toggle</span>
                        <span class="text-primary font-medium">{{ searchMode === 'quick' ? 'Quick Search' : 'Advanced Search' }}</span>
                    </div>
                    
                    <!-- Quick search filter hints -->
                    <Transition
                        enter-active-class="transition-all duration-150"
                        enter-from-class="opacity-0"
                        enter-to-class="opacity-100"
                        leave-active-class="transition-all duration-100"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                    >
                        <div v-if="searchMode === 'quick' && quickSearchHints.length > 0" class="flex flex-wrap items-center gap-1.5 mt-2">
                            <span class="text-xs text-dimmed">Filters:</span>
                            <button
                                v-for="hint in quickSearchHints"
                                :key="hint"
                                class="px-1.5 py-0.5 text-xs rounded border border-dashed border-muted text-muted hover:border-primary hover:text-primary transition-colors"
                                @click="addFilterHint(hint)"
                            >
                                {{ hint }}
                            </button>
                        </div>
                    </Transition>
                </div>

                <!-- Advanced Filters Panel -->
                <Transition
                    enter-active-class="transition-all duration-200 ease-out"
                    enter-from-class="opacity-0 -translate-y-2"
                    enter-to-class="opacity-100 translate-y-0"
                    leave-active-class="transition-all duration-150 ease-in"
                    leave-from-class="opacity-100 translate-y-0"
                    leave-to-class="opacity-0 -translate-y-2"
                >
                    <div v-if="searchMode === 'advanced'" class="px-4 py-3 border-b border-default bg-elevated/50">
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <!-- Subject -->
                            <UInput
                                v-model="filters.subject"
                                placeholder="Subject contains..."
                                icon="i-lucide-heading"
                                size="sm"
                            />
                            
                            <!-- From -->
                            <UInput
                                v-model="filters.from"
                                placeholder="From..."
                                icon="i-lucide-user"
                                size="sm"
                            />
                            
                            <!-- To -->
                            <UInput
                                v-model="filters.to"
                                placeholder="To..."
                                icon="i-lucide-users"
                                size="sm"
                            />
                            
                            <!-- Body -->
                            <UInput
                                v-model="filters.body"
                                placeholder="Body contains..."
                                icon="i-lucide-file-text"
                                size="sm"
                            />
                            
                            <!-- Date Since -->
                            <UPopover v-model:open="sinceDateOpen">
                                <UButton
                                    variant="outline"
                                    color="neutral"
                                    icon="i-lucide-calendar"
                                    size="sm"
                                    class="w-full justify-start font-normal"
                                    :class="{ 'text-muted': !filters.since }"
                                >
                                    {{ filters.since ? filters.since.toLocaleDateString() : 'After date...' }}
                                </UButton>
                                
                                <template #content>
                                    <div class="p-2">
                                        <UCalendar
                                            v-model="sinceCalendarValue"
                                            @update:model-value="sinceDateOpen = false"
                                        />
                                        <UButton
                                            v-if="filters.since"
                                            variant="ghost"
                                            color="neutral"
                                            size="xs"
                                            block
                                            class="mt-2"
                                            @click="filters.since = null; sinceDateOpen = false"
                                        >
                                            Clear
                                        </UButton>
                                    </div>
                                </template>
                            </UPopover>
                            
                            <!-- Date Before -->
                            <UPopover v-model:open="beforeDateOpen">
                                <UButton
                                    variant="outline"
                                    color="neutral"
                                    icon="i-lucide-calendar-x"
                                    size="sm"
                                    class="w-full justify-start font-normal"
                                    :class="{ 'text-muted': !filters.before }"
                                >
                                    {{ filters.before ? filters.before.toLocaleDateString() : 'Before date...' }}
                                </UButton>
                                
                                <template #content>
                                    <div class="p-2">
                                        <UCalendar
                                            v-model="beforeCalendarValue"
                                            @update:model-value="beforeDateOpen = false"
                                        />
                                        <UButton
                                            v-if="filters.before"
                                            variant="ghost"
                                            color="neutral"
                                            size="xs"
                                            block
                                            class="mt-2"
                                            @click="filters.before = null; beforeDateOpen = false"
                                        >
                                            Clear
                                        </UButton>
                                    </div>
                                </template>
                            </UPopover>
                        </div>
                        
                        <!-- Toggle Filters -->
                        <div class="flex flex-wrap items-center gap-2 mt-3">
                            <span class="text-xs text-muted mr-1">Filters:</span>
                            
                            <UButton
                                :color="filters.hasAttachment === true ? 'primary' : filters.hasAttachment === false ? 'error' : 'neutral'"
                                :variant="filters.hasAttachment !== null ? 'solid' : 'outline'"
                                size="xs"
                                icon="i-lucide-paperclip"
                                @click="filters.hasAttachment = filters.hasAttachment === null ? true : filters.hasAttachment === true ? false : null"
                            >
                                {{ filters.hasAttachment === true ? 'Has attachments' : filters.hasAttachment === false ? 'No attachments' : 'Attachments' }}
                            </UButton>
                            
                            <UButton
                                :color="filters.seen === true ? 'primary' : filters.seen === false ? 'info' : 'neutral'"
                                :variant="filters.seen !== null ? 'solid' : 'outline'"
                                size="xs"
                                :icon="filters.seen === false ? 'i-lucide-mail' : 'i-lucide-mail-open'"
                                @click="filters.seen = filters.seen === null ? false : filters.seen === false ? true : null"
                            >
                                {{ filters.seen === true ? 'Read' : filters.seen === false ? 'Unread' : 'Read status' }}
                            </UButton>
                            
                            <UButton
                                :color="filters.flagged === true ? 'warning' : filters.flagged === false ? 'neutral' : 'neutral'"
                                :variant="filters.flagged !== null ? 'solid' : 'outline'"
                                size="xs"
                                icon="i-lucide-star"
                                @click="filters.flagged = filters.flagged === null ? true : filters.flagged === true ? false : null"
                            >
                                {{ filters.flagged === true ? 'Flagged' : filters.flagged === false ? 'Not flagged' : 'Flagged' }}
                            </UButton>
                            
                            <UButton
                                :color="filters.answered === true ? 'success' : filters.answered === false ? 'neutral' : 'neutral'"
                                :variant="filters.answered !== null ? 'solid' : 'outline'"
                                size="xs"
                                icon="i-lucide-reply"
                                @click="filters.answered = filters.answered === null ? true : filters.answered === true ? false : null"
                            >
                                {{ filters.answered === true ? 'Replied' : filters.answered === false ? 'Not replied' : 'Replied' }}
                            </UButton>
                            
                            <UButton
                                :color="filters.draft === true ? 'secondary' : filters.draft === false ? 'neutral' : 'neutral'"
                                :variant="filters.draft !== null ? 'solid' : 'outline'"
                                size="xs"
                                icon="i-lucide-file-edit"
                                @click="filters.draft = filters.draft === null ? true : filters.draft === true ? false : null"
                            >
                                {{ filters.draft === true ? 'Drafts' : filters.draft === false ? 'Not drafts' : 'Drafts' }}
                            </UButton>
                        </div>

                        <!-- Search Button -->
                        <div class="flex items-center justify-between mt-3 pt-3 border-t border-default">
                            <UButton
                                v-if="hasActiveFilters"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                icon="i-lucide-x"
                                @click="clearAllFilters"
                            >
                                Clear all filters
                            </UButton>
                            <div v-else></div>
                            
                            <UButton
                                color="primary"
                                size="sm"
                                icon="i-lucide-search"
                                :loading="isSearching"
                                :disabled="!hasActiveFilters"
                                @click="() => performSearch()"
                            >
                                Search
                            </UButton>
                        </div>
                    </div>
                </Transition>

                <!-- Active Filter Chips -->
                <Transition
                    enter-active-class="transition-all duration-200"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition-all duration-150"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                >
                    <div 
                        v-if="activeFilterChips.length > 0 && (searchResults.length > 0 || isSearching)"
                        class="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-default bg-primary/5"
                    >
                        <span class="text-xs text-muted mr-1">Active filters:</span>
                        <UBadge
                            v-for="chip in activeFilterChips"
                            :key="chip.key"
                            color="primary"
                            variant="soft"
                            size="sm"
                            class="cursor-pointer hover:bg-primary/20 transition-colors"
                            @click="removeFilter(chip.key)"
                        >
                            <UIcon v-if="chip.icon" :name="chip.icon" class="size-3 mr-1" />
                            {{ chip.label }}
                            <UIcon name="i-lucide-x" class="size-3 ml-1" />
                        </UBadge>
                    </div>
                </Transition>

                <!-- Results -->
                <div class="flex-1 overflow-y-auto">
                    <!-- Loading state -->
                    <div v-if="isSearching" class="divide-y divide-default">
                        <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-4 py-3.5">
                            <USkeleton class="size-9 rounded-full" />
                            <div class="flex-1 space-y-2">
                                <USkeleton class="h-4 w-1/3" />
                                <USkeleton class="h-3.5 w-2/3" />
                                <USkeleton class="h-3 w-1/2" />
                            </div>
                            <USkeleton class="h-3 w-12" />
                        </div>
                    </div>

                    <!-- Empty state - No search yet -->
                    <div v-else-if="searchResults.length === 0 && !hasActiveFilters && !quickSearchQuery" class="flex flex-col items-center justify-center py-16 px-4">
                        <UIcon name="i-lucide-search" class="size-12 mb-4 text-dimmed" />
                        <p class="text-muted text-sm mb-2">Search across all your emails</p>
                        <p class="text-xs text-dimmed text-center max-w-xs">
                            Use quick search for simple queries, or switch to advanced mode for powerful filtering options
                        </p>
                    </div>

                    <!-- Empty state - No results -->
                    <div v-else-if="searchResults.length === 0 && (hasActiveFilters || quickSearchQuery)" class="flex flex-col items-center justify-center py-16 px-4">
                        <UIcon name="i-lucide-inbox" class="size-12 mb-4 text-dimmed" />
                        <p class="text-muted text-sm mb-2">No emails found</p>
                        <p class="text-xs text-dimmed text-center max-w-xs">
                            Try adjusting your search criteria or removing some filters
                        </p>
                        <UButton
                            class="mt-4"
                            color="neutral"
                            variant="outline"
                            size="sm"
                            icon="i-lucide-x"
                            @click="clearAllFilters"
                        >
                            Clear all filters
                        </UButton>
                    </div>

                    <!-- Results list -->
                    <div v-else class="divide-y divide-default">
                        <div
                            v-for="item in searchResults"
                            :key="`${item.mailboxPath || 'unknown'}-${item.mail.uid}`"
                            class="group flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-elevated"
                            @click="openMail(item)"
                        >
                            <!-- Avatar -->
                            <Gravatar
                                :email="item.mail.from?.address"
                                size="md"
                                class="shrink-0 mt-0.5"
                            />

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between gap-2 mb-0.5">
                                    <div class="flex items-center gap-2 min-w-0">
                                        <span
                                            class="truncate text-sm"
                                            :class="isUnread(item) ? 'font-semibold text-default' : 'text-muted'"
                                        >
                                            {{ item.mail.from?.name || item.mail.from?.address || 'Unknown' }}
                                        </span>
                                        <UBadge v-if="isUnread(item)" color="primary" size="xs" class="shrink-0">
                                            New
                                        </UBadge>
                                        <UIcon
                                            v-if="isFlagged(item)"
                                            name="i-lucide-star"
                                            class="size-3.5 shrink-0 text-amber-500"
                                        />
                                    </div>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <UBadge 
                                            v-if="item.mailboxPath"
                                            color="neutral" 
                                            variant="subtle" 
                                            size="xs"
                                        >
                                            {{ item.mailboxPath }}
                                        </UBadge>
                                        <UIcon
                                            v-if="hasAttachments(item)"
                                            name="i-lucide-paperclip"
                                            class="size-3.5 text-dimmed"
                                        />
                                        <span class="text-xs text-muted">
                                            {{ item.mail.date ? formatRelativeDate(item.mail.date) : '' }}
                                        </span>
                                    </div>
                                </div>
                                <div
                                    class="text-sm truncate mb-0.5"
                                    :class="isUnread(item) ? 'font-medium text-default' : 'text-muted'"
                                >
                                    {{ item.mail.subject || '(No subject)' }}
                                </div>
                                <div class="text-xs text-dimmed truncate">
                                    {{ getPreview(item) }}
                                </div>
                            </div>

                            <!-- Arrow indicator -->
                            <UIcon 
                                name="i-lucide-chevron-right" 
                                class="size-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-2"
                            />
                        </div>
                    </div>

                    <!-- Load more -->
                    <div v-if="hasMoreResults && searchResults.length > 0" class="p-4 border-t border-default">
                        <UButton
                            block
                            color="neutral"
                            variant="outline"
                            size="sm"
                            :loading="isSearching"
                            @click="loadMore"
                        >
                            Load more results
                        </UButton>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-4 py-2 border-t border-default bg-elevated/50 text-xs text-muted flex items-center justify-between">
                    <span v-if="searchResults.length > 0">
                        {{ searchResults.length }}{{ totalResults > searchResults.length ? ` of ${totalResults}` : '' }} result{{ totalResults !== 1 ? 's' : '' }}
                    </span>
                    <span v-else>
                        {{ currentMailAccount ? `Searching in ${currentMailAccount.display_name}` : 'Select a mail account to search' }}
                    </span>
                    <div class="flex items-center gap-2">
                        <UKbd value="↵" />
                        <span>to search</span>
                        <UKbd value="esc" />
                        <span>to close</span>
                    </div>
                </div>
            </div>
        </template>
    </UModal>
</template>
