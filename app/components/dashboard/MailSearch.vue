<script setup lang="ts">
import type { PostMailAccountsByMailAccountIdSearchResponse } from '~/api-client/types.gen';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import { MailboxDisplayUtils } from '~/utils/mailboxDisplay';
import Gravatar from '~/components/Gravatar.vue';
import { useDebounceFn, useLocalStorage } from '@vueuse/core';
import { CalendarDate } from '@internationalized/date';

// ── Types ──

type SearchResultItem = NonNullable<
    (PostMailAccountsByMailAccountIdSearchResponse & { success: true })['data']['results'][number]
>;

type SortOrder = 'newest' | 'oldest';

// ── Props & State ──

const isOpen = defineModel<boolean>('open', { default: false });

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();

// ── Search State ──

const searchMode = ref<'quick' | 'advanced'>('quick');
const quickSearchQuery = ref('');
const isSearching = ref(false);
const sortOrder = ref<SortOrder>('newest');
const activeResultIndex = ref(-1);
const resultsContainer = ref<HTMLElement | null>(null);

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

// Recent searches (persisted)
const recentSearches = useLocalStorage<string[]>('delivr:mail-search:recent', []);
const MAX_RECENT = 6;

// ── Suggested searches (presets) ──

type SuggestedSearch = {
    label: string;
    icon: string;
    apply: () => void;
};

const suggestedSearches: SuggestedSearch[] = [
    {
        label: 'Unread emails',
        icon: 'i-lucide-mail',
        apply: () => {
            clearAllFilters();
            searchMode.value = 'advanced';
            filters.seen = false;
            performSearch();
        },
    },
    {
        label: 'With attachments',
        icon: 'i-lucide-paperclip',
        apply: () => {
            clearAllFilters();
            searchMode.value = 'advanced';
            filters.hasAttachment = true;
            performSearch();
        },
    },
    {
        label: 'Flagged',
        icon: 'i-lucide-star',
        apply: () => {
            clearAllFilters();
            searchMode.value = 'advanced';
            filters.flagged = true;
            performSearch();
        },
    },
    {
        label: 'Last 7 days',
        icon: 'i-lucide-calendar-clock',
        apply: () => {
            clearAllFilters();
            searchMode.value = 'advanced';
            filters.since = daysAgo(7);
            performSearch();
        },
    },
    {
        label: 'Last 30 days',
        icon: 'i-lucide-calendar-days',
        apply: () => {
            clearAllFilters();
            searchMode.value = 'advanced';
            filters.since = daysAgo(30);
            performSearch();
        },
    },
    {
        label: 'Unreplied',
        icon: 'i-lucide-reply',
        apply: () => {
            clearAllFilters();
            searchMode.value = 'advanced';
            filters.answered = false;
            performSearch();
        },
    },
];

// ── Date presets (for advanced panel) ──

type DatePreset = {
    label: string;
    since: () => Date;
    before?: () => Date | null;
};

const datePresets: DatePreset[] = [
    { label: 'Today', since: () => startOfToday() },
    { label: 'Last 7 days', since: () => daysAgo(7) },
    { label: 'Last 30 days', since: () => daysAgo(30) },
    { label: 'Last 3 months', since: () => daysAgo(90) },
    { label: 'This year', since: () => new Date(new Date().getFullYear(), 0, 1) },
];

function applyDatePreset(preset: DatePreset) {
    filters.since = preset.since();
    filters.before = preset.before?.() ?? null;
}

function daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
}

function startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

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

function parseQuickSearch(query: string): { filters: Partial<typeof filters>; remainingText: string } {
    const parsedFilters: Partial<typeof filters> = {};
    let remaining = query;

    const fromMatch = remaining.match(/\bfrom:(\S+)/i);
    if (fromMatch?.[1]) {
        parsedFilters.from = fromMatch[1].replace(/^["']|["']$/g, '');
        remaining = remaining.replace(fromMatch[0], '').trim();
    }

    const toMatch = remaining.match(/\bto:(\S+)/i);
    if (toMatch?.[1]) {
        parsedFilters.to = toMatch[1].replace(/^["']|["']$/g, '');
        remaining = remaining.replace(toMatch[0], '').trim();
    }

    const subjectMatch = remaining.match(/\bsubject:(?:"([^"]+)"|'([^']+)'|(\S+))/i);
    if (subjectMatch) {
        parsedFilters.subject = subjectMatch[1] || subjectMatch[2] || subjectMatch[3];
        remaining = remaining.replace(subjectMatch[0], '').trim();
    }

    const bodyMatch = remaining.match(/\bbody:(?:"([^"]+)"|'([^']+)'|(\S+))/i);
    if (bodyMatch) {
        parsedFilters.body = bodyMatch[1] || bodyMatch[2] || bodyMatch[3];
        remaining = remaining.replace(bodyMatch[0], '').trim();
    }

    if (/\bhas:attachment/i.test(remaining)) {
        parsedFilters.hasAttachment = true;
        remaining = remaining.replace(/\bhas:attachment/i, '').trim();
    }

    if (/\bis:unread/i.test(remaining)) {
        parsedFilters.seen = false;
        remaining = remaining.replace(/\bis:unread/i, '').trim();
    } else if (/\bis:read/i.test(remaining)) {
        parsedFilters.seen = true;
        remaining = remaining.replace(/\bis:read/i, '').trim();
    }

    if (/\bis:(flagged|starred)/i.test(remaining)) {
        parsedFilters.flagged = true;
        remaining = remaining.replace(/\bis:(flagged|starred)/i, '').trim();
    }

    if (/\bis:draft/i.test(remaining)) {
        parsedFilters.draft = true;
        remaining = remaining.replace(/\bis:draft/i, '').trim();
    }

    const afterMatch = remaining.match(/\bafter:(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (afterMatch?.[1]) {
        const date = new Date(afterMatch[1]);
        if (!isNaN(date.getTime())) {
            parsedFilters.since = date;
        }
        remaining = remaining.replace(afterMatch[0], '').trim();
    }

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
    return !!(filters.text || filters.subject || filters.from || filters.to ||
           filters.body || filters.since || filters.before ||
           filters.hasAttachment !== null || filters.seen !== null ||
           filters.flagged !== null || filters.answered !== null || filters.draft !== null);
});

const hasAnyQuery = computed(() =>
    hasActiveFilters.value || !!quickSearchQuery.value.trim()
);

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
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelativeDate(dateNum: number): string {
    const date = new Date(dateNum);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString(undefined, { weekday: 'short' });
    } else {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
    return !!(item.mail.attachments && item.mail.attachments.length > 0);
}

function addFilterHint(hint: string) {
    quickSearchQuery.value = (quickSearchQuery.value.trim() + ' ' + hint).trim();
}

function pushRecentSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    const without = recentSearches.value.filter(q => q !== trimmed);
    recentSearches.value = [trimmed, ...without].slice(0, MAX_RECENT);
}

function useRecentSearch(query: string) {
    searchMode.value = 'quick';
    quickSearchQuery.value = query;
    performSearch();
}

function clearRecentSearches() {
    recentSearches.value = [];
}

// ── Search Actions ──

async function performSearch(append = false) {
    if (!currentMailAccount.value) return;

    isSearching.value = true;
    if (!append) {
        searchResults.value = [];
        currentPage.value = 1;
        activeResultIndex.value = -1;
    }

    try {
        const offset = (currentPage.value - 1) * PAGE_SIZE;

        if (searchMode.value === 'quick' && quickSearchQuery.value.trim()) {
            if (!append) pushRecentSearch(quickSearchQuery.value);

            const { filters: parsedFilters, remainingText } = parseQuickSearch(quickSearchQuery.value);

            if (Object.keys(parsedFilters).length > 0) {
                const body: Record<string, unknown> = { ...parsedFilters };
                if (remainingText) body.text = remainingText;

                if (body.since instanceof Date) body.since = (body.since as Date).toISOString();
                if (body.before instanceof Date) body.before = (body.before as Date).toISOString();

                const result = await useAPI((api) => api.postMailAccountsByMailAccountIdSearch({
                    path: {
                        mailAccountID: currentMailAccount.value!.id
                    },
                    query: {
                        limit: PAGE_SIZE,
                        offset,
                        order: sortOrder.value,
                    },
                    body
                }));

                if (result.success && result.data) {
                    searchResults.value = append
                        ? [...searchResults.value, ...result.data.results]
                        : result.data.results;
                    totalResults.value = result.data.total;
                }
            } else {
                const result = await useAPI((api) => api.getMailAccountsByMailAccountIdSearch({
                    path: {
                        mailAccountID: currentMailAccount.value!.id
                    },
                    query: {
                        q: quickSearchQuery.value.trim(),
                        limit: PAGE_SIZE,
                        offset,
                        order: sortOrder.value,
                    }
                }));

                if (result.success && result.data) {
                    searchResults.value = append
                        ? [...searchResults.value, ...result.data.results]
                        : result.data.results;
                    totalResults.value = result.data.total;
                }
            }
        } else if (searchMode.value === 'advanced' && hasActiveFilters.value) {
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
                path: {
                    mailAccountID: currentMailAccount.value!.id
                },
                query: {
                    limit: PAGE_SIZE,
                    offset,
                    order: sortOrder.value,
                },
                body
            }));

            if (result.success && result.data) {
                searchResults.value = append
                    ? [...searchResults.value, ...result.data.results]
                    : result.data.results;
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
    if (hasAnyQuery.value) {
        performSearch();
    } else {
        searchResults.value = [];
        totalResults.value = 0;
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
    activeResultIndex.value = -1;
}

function openMail(item: SearchResultItem) {
    const accountId = currentMailAccount.value?.id;
    if (accountId === undefined) return;

    const mailboxPath = item.mailboxPath || 'INBOX';
    // Resolve the mailbox so we split on its real delimiter; the selected mail
    // is now part of the route path.
    const mailbox = currentMailAccount.value?.mailboxes?.find(mb => mb.path === mailboxPath);
    const folderSegment = mailbox
        ? MailboxDisplayUtils.pathToUrlSegment(mailbox.path, mailbox.delimiter)
        : encodeURIComponent(encodeURIComponent(mailboxPath));

    navigateTo(`/mail/${accountId}/folder/${folderSegment}/${item.mail.uid}`);
    isOpen.value = false;
}

// ── Debounced search ──

const debouncedSearch = useDebounceFn(() => {
    performSearch();
}, 400);

watch(quickSearchQuery, () => {
    if (searchMode.value === 'quick' && quickSearchQuery.value.trim()) {
        debouncedSearch();
    } else if (searchMode.value === 'quick' && !quickSearchQuery.value.trim()) {
        searchResults.value = [];
        totalResults.value = 0;
    }
});

watch(sortOrder, () => {
    if (hasAnyQuery.value) performSearch();
});

// ── Keyboard navigation within results ──

function handleArrowKey(e: KeyboardEvent) {
    if (!isOpen.value || searchResults.value.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeResultIndex.value = Math.min(activeResultIndex.value + 1, searchResults.value.length - 1);
        scrollActiveResultIntoView();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeResultIndex.value = Math.max(activeResultIndex.value - 1, 0);
        scrollActiveResultIntoView();
    } else if (e.key === 'Enter' && activeResultIndex.value >= 0) {
        const item = searchResults.value[activeResultIndex.value];
        if (item) {
            e.preventDefault();
            openMail(item);
        }
    }
}

function scrollActiveResultIntoView() {
    nextTick(() => {
        const el = resultsContainer.value?.querySelector<HTMLElement>(
            `[data-result-index="${activeResultIndex.value}"]`
        );
        el?.scrollIntoView({ block: 'nearest' });
    });
}

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
        activeResultIndex.value = -1;
    }
});
</script>

<template>
    <UModal
        v-model:open="isOpen"
        :ui="{
            content: 'sm:max-w-4xl sm:max-h-[88vh] main-bg-color',
        }"
    >
        <template #content>
            <div
                class="flex flex-col h-full max-h-[88vh]"
                @keydown="handleArrowKey"
            >
                <!-- ── Header ── -->
                <div class="px-5 pt-4 pb-3 border-b border-default">
                    <div class="flex items-center gap-3">
                        <UIcon name="i-lucide-search" class="size-5 text-muted shrink-0" />
                        <UInput
                            v-if="searchMode === 'quick'"
                            v-model="quickSearchQuery"
                            placeholder="Search your emails…"
                            variant="none"
                            size="xl"
                            class="flex-1"
                            :ui="{ base: 'text-base' }"
                            autofocus
                            @keydown.enter="performSearch()"
                        />
                        <UInput
                            v-else
                            v-model="filters.text"
                            placeholder="Search across all fields…"
                            variant="none"
                            size="xl"
                            class="flex-1"
                            :ui="{ base: 'text-base' }"
                            autofocus
                            @keydown.enter="performSearch()"
                        />

                        <UButton
                            icon="i-lucide-x"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            @click="isOpen = false;"
                        />
                    </div>

                    <!-- Tabs + sort -->
                    <div class="flex items-center gap-2 mt-3">
                        <!-- Segmented mode switcher -->
                        <div class="inline-flex rounded-md bg-elevated p-0.5">
                            <button
                                type="button"
                                class="px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5"
                                :class="searchMode === 'quick'
                                    ? 'bg-default text-default shadow-sm'
                                    : 'text-muted hover:text-default'"
                                @click="searchMode = 'quick'"
                            >
                                <UIcon name="i-lucide-zap" class="size-3.5" />
                                Quick
                            </button>
                            <button
                                type="button"
                                class="px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5"
                                :class="searchMode === 'advanced'
                                    ? 'bg-default text-default shadow-sm'
                                    : 'text-muted hover:text-default'"
                                @click="searchMode = 'advanced'"
                            >
                                <UIcon name="i-lucide-sliders-horizontal" class="size-3.5" />
                                Advanced
                            </button>
                        </div>

                        <div class="flex-1" />

                        <!-- Sort dropdown -->
                        <UTooltip :text="`Sort: ${sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}`">
                            <UButton
                                :icon="sortOrder === 'newest' ? 'i-lucide-arrow-down-wide-narrow' : 'i-lucide-arrow-up-wide-narrow'"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="sortOrder = sortOrder === 'newest' ? 'oldest' : 'newest';"
                            >
                                {{ sortOrder === 'newest' ? 'Newest' : 'Oldest' }}
                            </UButton>
                        </UTooltip>
                    </div>

                    <!-- Quick search filter hint chips -->
                    <Transition
                        enter-active-class="transition-all duration-150"
                        enter-from-class="opacity-0"
                        enter-to-class="opacity-100"
                        leave-active-class="transition-all duration-100"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                    >
                        <div
                            v-if="searchMode === 'quick' && quickSearchHints.length > 0"
                            class="flex flex-wrap items-center gap-1.5 mt-3"
                        >
                            <span class="text-xs text-dimmed">Try:</span>
                            <button
                                v-for="hint in quickSearchHints"
                                :key="hint"
                                class="px-1.5 py-0.5 text-xs rounded border border-dashed border-muted text-muted hover:border-default hover:text-default hover:bg-elevated transition-colors"
                                @click="addFilterHint(hint)"
                            >
                                {{ hint }}
                            </button>
                        </div>
                    </Transition>
                </div>

                <!-- ── Advanced Filters Panel ── -->
                <Transition
                    enter-active-class="transition-all duration-200 ease-out"
                    enter-from-class="opacity-0 -translate-y-2"
                    enter-to-class="opacity-100 translate-y-0"
                    leave-active-class="transition-all duration-150 ease-in"
                    leave-from-class="opacity-100 translate-y-0"
                    leave-to-class="opacity-0 -translate-y-2"
                >
                    <div v-if="searchMode === 'advanced'" class="px-5 py-4 border-b border-default bg-elevated/40">
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <UInput
                                v-model="filters.subject"
                                placeholder="Subject contains…"
                                icon="i-lucide-heading"
                                size="sm"
                            />
                            <UInput
                                v-model="filters.from"
                                placeholder="From…"
                                icon="i-lucide-user"
                                size="sm"
                            />
                            <UInput
                                v-model="filters.to"
                                placeholder="To…"
                                icon="i-lucide-users"
                                size="sm"
                            />
                            <UInput
                                v-model="filters.body"
                                placeholder="Body contains…"
                                icon="i-lucide-file-text"
                                size="sm"
                            />

                            <UPopover v-model:open="sinceDateOpen">
                                <UButton
                                    variant="outline"
                                    color="neutral"
                                    icon="i-lucide-calendar"
                                    size="sm"
                                    class="w-full justify-start font-normal"
                                    :class="{ 'text-muted': !filters.since }"
                                >
                                    {{ filters.since ? `From: ${formatDateShort(filters.since)}` : 'After date…' }}
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

                            <UPopover v-model:open="beforeDateOpen">
                                <UButton
                                    variant="outline"
                                    color="neutral"
                                    icon="i-lucide-calendar-x"
                                    size="sm"
                                    class="w-full justify-start font-normal"
                                    :class="{ 'text-muted': !filters.before }"
                                >
                                    {{ filters.before ? `To: ${formatDateShort(filters.before)}` : 'Before date…' }}
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

                        <!-- Date presets -->
                        <div class="flex flex-wrap items-center gap-1.5 mt-3">
                            <span class="text-xs text-dimmed mr-1">Quick dates:</span>
                            <UButton
                                v-for="preset in datePresets"
                                :key="preset.label"
                                color="neutral"
                                variant="subtle"
                                size="xs"
                                @click="applyDatePreset(preset)"
                            >
                                {{ preset.label }}
                            </UButton>
                        </div>

                        <!-- Toggle filters -->
                        <div class="flex flex-wrap items-center gap-2 mt-3">
                            <span class="text-xs text-dimmed mr-1">Flags:</span>

                            <UButton
                                :color="filters.hasAttachment === true ? 'primary' : filters.hasAttachment === false ? 'error' : 'neutral'"
                                :variant="filters.hasAttachment !== null ? 'solid' : 'outline'"
                                size="xs"
                                icon="i-lucide-paperclip"
                                @click="filters.hasAttachment = filters.hasAttachment === null ? true : filters.hasAttachment === true ? false : null;"
                            >
                                {{ filters.hasAttachment === true ? 'Has attachments' : filters.hasAttachment === false ? 'No attachments' : 'Attachments' }}
                            </UButton>

                            <UButton
                                :color="filters.seen === true ? 'primary' : filters.seen === false ? 'info' : 'neutral'"
                                :variant="filters.seen !== null ? 'solid' : 'outline'"
                                size="xs"
                                :icon="filters.seen === false ? 'i-lucide-mail' : 'i-lucide-mail-open'"
                                @click="filters.seen = filters.seen === null ? false : filters.seen === false ? true : null;"
                            >
                                {{ filters.seen === true ? 'Read' : filters.seen === false ? 'Unread' : 'Read status' }}
                            </UButton>

                            <UButton
                                :color="filters.flagged === true ? 'warning' : 'neutral'"
                                :variant="filters.flagged !== null ? 'solid' : 'outline'"
                                size="xs"
                                icon="i-lucide-star"
                                @click="filters.flagged = filters.flagged === null ? true : filters.flagged === true ? false : null;"
                            >
                                {{ filters.flagged === true ? 'Flagged' : filters.flagged === false ? 'Not flagged' : 'Flagged' }}
                            </UButton>

                            <UButton
                                :color="filters.answered === true ? 'success' : 'neutral'"
                                :variant="filters.answered !== null ? 'solid' : 'outline'"
                                size="xs"
                                icon="i-lucide-reply"
                                @click="filters.answered = filters.answered === null ? true : filters.answered === true ? false : null;"
                            >
                                {{ filters.answered === true ? 'Replied' : filters.answered === false ? 'Not replied' : 'Replied' }}
                            </UButton>

                            <UButton
                                :color="filters.draft === true ? 'secondary' : 'neutral'"
                                :variant="filters.draft !== null ? 'solid' : 'outline'"
                                size="xs"
                                icon="i-lucide-file-edit"
                                @click="filters.draft = filters.draft === null ? true : filters.draft === true ? false : null;"
                            >
                                {{ filters.draft === true ? 'Drafts' : filters.draft === false ? 'Not drafts' : 'Drafts' }}
                            </UButton>
                        </div>

                        <!-- Action row -->
                        <div class="flex items-center justify-between mt-4 pt-3 border-t border-default">
                            <UButton
                                v-if="hasActiveFilters"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                icon="i-lucide-x"
                                @click="clearAllFilters"
                            >
                                Clear all
                            </UButton>
                            <div v-else />

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

                <!-- ── Active Filter Chips ── -->
                <Transition
                    enter-active-class="transition-all duration-200"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition-all duration-150"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                >
                    <div
                        v-if="activeFilterChips.length > 0"
                        class="flex flex-wrap items-center gap-1.5 px-5 py-2.5 border-b border-default bg-elevated/50"
                    >
                        <span class="text-xs text-muted mr-1">Filters:</span>
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

                <!-- ── Results / Empty state ── -->
                <div
                    ref="resultsContainer"
                    class="flex-1 overflow-y-auto"
                >
                    <!-- Loading state -->
                    <div v-if="isSearching && searchResults.length === 0" class="divide-y divide-default">
                        <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-5 py-3.5">
                            <USkeleton class="size-9 rounded-full" />
                            <div class="flex-1 space-y-2">
                                <USkeleton class="h-4 w-1/3" />
                                <USkeleton class="h-3.5 w-2/3" />
                                <USkeleton class="h-3 w-1/2" />
                            </div>
                            <USkeleton class="h-3 w-12" />
                        </div>
                    </div>

                    <!-- Idle / empty state: suggestions + recent -->
                    <div
                        v-else-if="searchResults.length === 0 && !hasAnyQuery"
                        class="px-5 py-6 space-y-6"
                    >
                        <!-- Recent searches -->
                        <div v-if="recentSearches.length > 0">
                            <div class="flex items-center justify-between mb-2">
                                <h3 class="text-xs font-semibold uppercase tracking-wider text-dimmed flex items-center gap-1.5">
                                    <UIcon name="i-lucide-history" class="size-3.5" />
                                    Recent searches
                                </h3>
                                <UButton
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    @click="clearRecentSearches"
                                >
                                    Clear
                                </UButton>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                                <UBadge
                                    v-for="query in recentSearches"
                                    :key="query"
                                    color="neutral"
                                    variant="soft"
                                    size="md"
                                    class="cursor-pointer hover:bg-elevated transition-colors"
                                    @click="useRecentSearch(query)"
                                >
                                    <UIcon name="i-lucide-corner-down-left" class="size-3 mr-1" />
                                    {{ query }}
                                </UBadge>
                            </div>
                        </div>

                        <!-- Suggested searches -->
                        <div>
                            <h3 class="text-xs font-semibold uppercase tracking-wider text-dimmed mb-2 flex items-center gap-1.5">
                                <UIcon name="i-lucide-sparkles" class="size-3.5" />
                                Suggested
                            </h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    v-for="suggestion in suggestedSearches"
                                    :key="suggestion.label"
                                    class="group flex items-center gap-3 p-3 rounded-lg border border-default hover:bg-elevated transition-all text-left"
                                    @click="suggestion.apply()"
                                >
                                    <div class="flex items-center justify-center shrink-0 size-8 rounded-md bg-elevated group-hover:bg-accented transition-colors">
                                        <UIcon
                                            :name="suggestion.icon"
                                            class="size-4 text-muted group-hover:text-default transition-colors"
                                        />
                                    </div>
                                    <span class="text-sm font-medium text-default">{{ suggestion.label }}</span>
                                </button>
                            </div>
                        </div>

                        <!-- Syntax hint -->
                        <div class="rounded-lg border border-dashed border-default p-3 bg-elevated/30">
                            <div class="text-xs text-muted mb-1.5 flex items-center gap-1.5">
                                <UIcon name="i-lucide-info" class="size-3.5" />
                                <span class="font-medium">Pro tip:</span>
                                <span>Use filter syntax in quick search</span>
                            </div>
                            <div class="flex flex-wrap gap-1.5 text-xs font-mono">
                                <span class="px-1.5 py-0.5 rounded bg-default text-dimmed">from:alice@…</span>
                                <span class="px-1.5 py-0.5 rounded bg-default text-dimmed">subject:"hello"</span>
                                <span class="px-1.5 py-0.5 rounded bg-default text-dimmed">has:attachment</span>
                                <span class="px-1.5 py-0.5 rounded bg-default text-dimmed">is:unread</span>
                                <span class="px-1.5 py-0.5 rounded bg-default text-dimmed">after:2025-01-01</span>
                            </div>
                        </div>
                    </div>

                    <!-- No results -->
                    <div
                        v-else-if="searchResults.length === 0 && hasAnyQuery && !isSearching"
                        class="flex flex-col items-center justify-center py-16 px-4"
                    >
                        <UIcon name="i-lucide-inbox" class="size-12 mb-4 text-dimmed" />
                        <p class="text-muted text-sm mb-2">No emails found</p>
                        <p class="text-xs text-dimmed text-center max-w-xs mb-4">
                            Try adjusting your search criteria or removing some filters
                        </p>
                        <UButton
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
                            v-for="(item, idx) in searchResults"
                            :key="`${item.mailboxPath || 'unknown'}-${item.mail.uid}`"
                            :data-result-index="idx"
                            class="group flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors"
                            :class="activeResultIndex === idx ? 'bg-accented' : 'hover:bg-elevated'"
                            @click="openMail(item)"
                            @mouseenter="activeResultIndex = idx"
                        >
                            <Gravatar
                                :email="item.mail.from?.address"
                                size="md"
                                class="shrink-0 mt-0.5"
                            />

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
                                            class="size-3.5 shrink-0 text-primary"
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
                            Load {{ Math.min(PAGE_SIZE, totalResults - searchResults.length) }} more
                        </UButton>
                    </div>
                </div>

                <!-- ── Footer ── -->
                <div class="px-5 py-2 border-t border-default bg-elevated/40 text-xs text-muted flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <UIcon name="i-lucide-at-sign" class="size-3.5 shrink-0" />
                        <span v-if="searchResults.length > 0" class="truncate">
                            {{ searchResults.length }}{{ totalResults > searchResults.length ? ` of ${totalResults}` : '' }} result{{ totalResults !== 1 ? 's' : '' }}
                            <span v-if="currentMailAccount">· {{ currentMailAccount.display_name }}</span>
                        </span>
                        <span v-else-if="currentMailAccount" class="truncate">
                            Searching all folders in {{ currentMailAccount.display_name }}
                        </span>
                        <span v-else class="truncate">Select a mail account to search</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <div class="hidden sm:flex items-center gap-1">
                            <UKbd value="↑" size="sm" />
                            <UKbd value="↓" size="sm" />
                            <span>navigate</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <UKbd value="↵" size="sm" />
                            <span>open</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <UKbd value="esc" size="sm" />
                            <span>close</span>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </UModal>
</template>
