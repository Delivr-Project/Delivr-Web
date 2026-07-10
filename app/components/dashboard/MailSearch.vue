<script setup lang="ts">
import type { PostMailAccountsByMailAccountIdSearchResponse } from '~/api-client/types.gen';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import { MailboxDisplayUtils } from '~/utils/mailboxDisplay';
import Gravatar from '~/components/Gravatar.vue';
import { useDebounceFn } from '@vueuse/core';
import { useRecentMailSearches } from '~/composables/useRecentSearches';

// ── Types ──

type SearchResultItem = NonNullable<
    (PostMailAccountsByMailAccountIdSearchResponse & { success: true })['data']['results'][number]
>;

type SortOrder = 'newest' | 'oldest';

// Structured filters parsed out of the unified query string
type ParsedFilters = {
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
    since?: Date;
    before?: Date;
    hasAttachment?: boolean;
    seen?: boolean;
    flagged?: boolean;
    answered?: boolean;
    draft?: boolean;
};

// ── Props & State ──

const isOpen = defineModel<boolean>('open', { default: false });

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();

// ── Search State ──

const searchQuery = ref('');
const isSearching = ref(false);
const sortOrder = ref<SortOrder>('newest');
const activeResultIndex = ref(-1);
const resultsContainer = ref<HTMLElement | null>(null);

// Search results - flattened array of result items
const searchResults = ref<SearchResultItem[]>([]);
const totalResults = ref(0);

// Pagination
const currentPage = ref(1);
const PAGE_SIZE = 20;
const hasMoreResults = computed(() => searchResults.value.length < totalResults.value);

// Recent searches (persisted)
const recentSearches = useRecentMailSearches();
const MAX_RECENT = 6;

// ── Search operator catalog (Discord-style tokens) ──

type OperatorDef = {
    /** operator keyword before the colon */
    key: string;
    /** human description shown in the autocomplete */
    description: string;
    icon: string;
    /** fixed set of accepted values (enables value autocomplete); omit for free-text */
    values?: string[];
};

const OPERATORS: OperatorDef[] = [
    { key: 'from', description: 'Sender address or name', icon: 'i-lucide-user' },
    { key: 'to', description: 'Recipient address', icon: 'i-lucide-users' },
    { key: 'subject', description: 'Words in the subject', icon: 'i-lucide-heading' },
    { key: 'body', description: 'Words in the body', icon: 'i-lucide-file-text' },
    { key: 'has', description: 'Message contains…', icon: 'i-lucide-paperclip', values: ['attachment'] },
    {
        key: 'is',
        description: 'Message state',
        icon: 'i-lucide-tag',
        values: ['unread', 'read', 'flagged', 'starred', 'draft', 'replied', 'unreplied'],
    },
    { key: 'after', description: 'On or after a date (e.g. 2025-01-31 or 31.01.2025)', icon: 'i-lucide-calendar' },
    { key: 'before', description: 'Before a date (e.g. 2025-01-31 or 31.01.2025)', icon: 'i-lucide-calendar-x' },
];

// ── Autocomplete state ──

type Suggestion = {
    /** text inserted into the query in place of the current token */
    insert: string;
    /** whether to append a trailing space after inserting */
    addSpace: boolean;
    title: string;
    hint: string;
    icon: string;
};

const inputEl = ref<HTMLInputElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
// The div layered under the (text-transparent) input that renders the query
// with recognised filter tokens highlighted.
const highlightOverlayRef = ref<HTMLElement | null>(null);
const caretPos = ref(0);
const isInputFocused = ref(false);
const suppressSuggestions = ref(false);
// Set when the user explicitly opens the dropdown with Tab, so it can show
// even while the current token is still empty.
const manualOpen = ref(false);
const activeSuggestionIndex = ref(0);

/** The whitespace-delimited token the caret currently sits in. */
const currentToken = computed(() => {
    const text = searchQuery.value;
    const pos = Math.min(caretPos.value, text.length);
    let start = pos;
    while (start > 0 && !/\s/.test(text[start - 1]!)) start--;
    let end = pos;
    while (end < text.length && !/\s/.test(text[end]!)) end++;
    // Only the part up to the caret is used to match a prefix.
    return { start, end, token: text.slice(start, pos) };
});

const suggestions = computed<Suggestion[]>(() => {
    const token = currentToken.value.token;
    const colon = token.indexOf(':');

    // Typing a value for an operator (e.g. "is:unr")
    if (colon >= 0) {
        const opKey = token.slice(0, colon).toLowerCase();
        const valuePrefix = token.slice(colon + 1).toLowerCase();
        const def = OPERATORS.find(o => o.key === opKey);
        if (!def?.values) return [];
        return def.values
            .filter(v => v.startsWith(valuePrefix))
            .map(v => ({
                insert: `${def.key}:${v}`,
                addSpace: true,
                title: `${def.key}:${v}`,
                hint: def.description,
                icon: def.icon,
            }));
    }

    // Typing an operator name (e.g. "fr")
    const prefix = token.toLowerCase();
    return OPERATORS
        .filter(o => o.key.startsWith(prefix))
        .map(o => ({
            insert: `${o.key}:`,
            addSpace: false,
            title: `${o.key}:`,
            hint: o.description,
            icon: o.icon,
        }));
});

const showSuggestions = computed(() =>
    isInputFocused.value
    && !suppressSuggestions.value
    && suggestions.value.length > 0
    // Only surface once the user has begun typing a token (an operator word),
    // or when they explicitly opened the menu with Tab.
    && (currentToken.value.token.length > 0 || manualOpen.value)
);

// Keep the highlighted suggestion in range as the list changes.
watch(() => suggestions.value.map(s => s.insert).join('|'), () => {
    activeSuggestionIndex.value = 0;
});

function syncCaret(e: Event) {
    const target = e.target as HTMLInputElement | null;
    if (!target) return;
    inputEl.value = target;
    caretPos.value = target.selectionStart ?? searchQuery.value.length;
    syncOverlayScroll();
}

/** Keep the highlight overlay scrolled in lockstep with the input. */
function syncOverlayScroll() {
    const input = searchInputRef.value;
    const overlay = highlightOverlayRef.value;
    if (input && overlay) overlay.scrollLeft = input.scrollLeft;
}

// ── Filter highlighting ──

/** Whether a `key:value` token is a complete, recognised filter (worth highlighting). */
function isValidFilterToken(token: string): boolean {
    const idx = token.indexOf(':');
    if (idx < 0) return false;
    const key = token.slice(0, idx).toLowerCase();
    const value = token.slice(idx + 1).replace(/^["']|["']$/g, '');
    switch (key) {
        case 'from':
        case 'to':
        case 'subject':
        case 'body':
            return value.length > 0;
        case 'has':
            return value.toLowerCase() === 'attachment';
        case 'is':
            return ['unread', 'read', 'flagged', 'starred', 'draft', 'replied', 'unreplied']
                .includes(value.toLowerCase());
        case 'after':
        case 'before':
            return parseSearchDate(value) !== null;
        default:
            return false;
    }
}

/**
 * Split the query into whitespace-preserving segments, flagging the ones that
 * are complete filter tokens so the overlay can highlight them. Whitespace is
 * kept verbatim so the overlay stays glyph-aligned with the input beneath it.
 */
const querySegments = computed(() => {
    const q = searchQuery.value;
    const segments: { text: string; highlight: boolean }[] = [];
    if (!q) return segments;

    const re = /(\s+)|((?:from|to|subject|body|has|is|after|before):(?:"[^"]*"|'[^']*'|\S*))|(\S+)/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(q)) !== null) {
        if (match[1] !== undefined) {
            segments.push({ text: match[1], highlight: false });
        } else if (match[2] !== undefined) {
            segments.push({ text: match[2], highlight: isValidFilterToken(match[2]) });
        } else {
            segments.push({ text: match[3]!, highlight: false });
        }
    }
    return segments;
});

function onInputInput(e: Event) {
    suppressSuggestions.value = false;
    syncCaret(e);
    // Overlay content updates on the next flush; re-sync scroll once it has.
    nextTick(syncOverlayScroll);
}

function onInputFocus(e: Event) {
    isInputFocused.value = true;
    suppressSuggestions.value = false;
    // Don't auto-open on focus — wait for typing or an explicit Tab.
    manualOpen.value = false;
    syncCaret(e);
}

function onInputBlur() {
    isInputFocused.value = false;
}

function applySuggestion(s: Suggestion) {
    const { start, end } = currentToken.value;
    const q = searchQuery.value;
    const insert = s.insert + (s.addSpace ? ' ' : '');
    searchQuery.value = q.slice(0, start) + insert + q.slice(end);

    const newPos = start + insert.length;
    suppressSuggestions.value = false;
    manualOpen.value = false;
    activeSuggestionIndex.value = 0;
    nextTick(() => {
        const el = inputEl.value;
        if (el) {
            el.focus();
            el.setSelectionRange(newPos, newPos);
        }
        caretPos.value = newPos;
    });
}

function onInputKeydown(e: KeyboardEvent) {
    if (showSuggestions.value) {
        const list = suggestions.value;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex.value = (activeSuggestionIndex.value + 1) % list.length;
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex.value = (activeSuggestionIndex.value - 1 + list.length) % list.length;
            return;
        }
        if (e.key === 'Tab') {
            const s = list[activeSuggestionIndex.value];
            if (s) {
                e.preventDefault();
                applySuggestion(s);
                return;
            }
        }
        if (e.key === 'Escape') {
            // Close only the dropdown, not the whole modal.
            e.preventDefault();
            e.stopPropagation();
            suppressSuggestions.value = true;
            manualOpen.value = false;
            return;
        }
    } else if (e.key === 'Tab') {
        // Dropdown is hidden — Tab opens the operator menu instead of leaving.
        e.preventDefault();
        suppressSuggestions.value = false;
        manualOpen.value = true;
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        suppressSuggestions.value = true;
        manualOpen.value = false;
        performSearch();
    }
}

// ── Suggested searches (presets) ──

type SuggestedSearch = {
    label: string;
    icon: string;
    query: () => string;
};

const suggestedSearches: SuggestedSearch[] = [
    { label: 'Unread emails', icon: 'i-lucide-mail', query: () => 'is:unread' },
    { label: 'With attachments', icon: 'i-lucide-paperclip', query: () => 'has:attachment' },
    { label: 'Flagged', icon: 'i-lucide-star', query: () => 'is:flagged' },
    { label: 'Last 7 days', icon: 'i-lucide-calendar-clock', query: () => `after:${fmtDate(daysAgo(7))}` },
    { label: 'Last 30 days', icon: 'i-lucide-calendar-days', query: () => `after:${fmtDate(daysAgo(30))}` },
    { label: 'Unreplied', icon: 'i-lucide-reply', query: () => 'is:unreplied' },
];

function applySuggested(s: SuggestedSearch) {
    searchQuery.value = s.query();
    performSearch();
}

function daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ── Query parsing (unified inline operators) ──

function parseQuickSearch(query: string): { filters: ParsedFilters; remainingText: string } {
    const parsedFilters: ParsedFilters = {};
    let remaining = query;

    const fromMatch = remaining.match(/\bfrom:(?:"([^"]+)"|'([^']+)'|(\S+))/i);
    if (fromMatch) {
        parsedFilters.from = fromMatch[1] || fromMatch[2] || fromMatch[3];
        remaining = remaining.replace(fromMatch[0], '').trim();
    }

    const toMatch = remaining.match(/\bto:(?:"([^"]+)"|'([^']+)'|(\S+))/i);
    if (toMatch) {
        parsedFilters.to = toMatch[1] || toMatch[2] || toMatch[3];
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

    if (/\bhas:attachment\b/i.test(remaining)) {
        parsedFilters.hasAttachment = true;
        remaining = remaining.replace(/\bhas:attachment\b/i, '').trim();
    }

    if (/\bis:unread\b/i.test(remaining)) {
        parsedFilters.seen = false;
        remaining = remaining.replace(/\bis:unread\b/i, '').trim();
    } else if (/\bis:read\b/i.test(remaining)) {
        parsedFilters.seen = true;
        remaining = remaining.replace(/\bis:read\b/i, '').trim();
    }

    if (/\bis:(flagged|starred)\b/i.test(remaining)) {
        parsedFilters.flagged = true;
        remaining = remaining.replace(/\bis:(flagged|starred)\b/i, '').trim();
    }

    if (/\bis:draft\b/i.test(remaining)) {
        parsedFilters.draft = true;
        remaining = remaining.replace(/\bis:draft\b/i, '').trim();
    }

    if (/\bis:replied\b/i.test(remaining)) {
        parsedFilters.answered = true;
        remaining = remaining.replace(/\bis:replied\b/i, '').trim();
    } else if (/\bis:unreplied\b/i.test(remaining)) {
        parsedFilters.answered = false;
        remaining = remaining.replace(/\bis:unreplied\b/i, '').trim();
    }

    const afterMatch = remaining.match(/\bafter:(\S+)/i);
    if (afterMatch?.[1]) {
        const date = parseSearchDate(afterMatch[1]);
        if (date) {
            parsedFilters.since = date;
            remaining = remaining.replace(afterMatch[0], '').trim();
        }
    }

    const beforeMatch = remaining.match(/\bbefore:(\S+)/i);
    if (beforeMatch?.[1]) {
        const date = parseSearchDate(beforeMatch[1]);
        if (date) {
            parsedFilters.before = date;
            remaining = remaining.replace(beforeMatch[0], '').trim();
        }
    }

    return { filters: parsedFilters, remainingText: remaining.trim() };
}

/** Serialize structured filters back into the canonical query string. */
function buildQuery(f: ParsedFilters, text: string): string {
    const parts: string[] = [];
    if (f.from) parts.push(`from:${quoteIfNeeded(f.from)}`);
    if (f.to) parts.push(`to:${quoteIfNeeded(f.to)}`);
    if (f.subject) parts.push(`subject:${quoteIfNeeded(f.subject)}`);
    if (f.body) parts.push(`body:${quoteIfNeeded(f.body)}`);
    if (f.hasAttachment) parts.push('has:attachment');
    if (f.seen === false) parts.push('is:unread');
    else if (f.seen === true) parts.push('is:read');
    if (f.flagged) parts.push('is:flagged');
    if (f.draft) parts.push('is:draft');
    if (f.answered === true) parts.push('is:replied');
    else if (f.answered === false) parts.push('is:unreplied');
    if (f.since) parts.push(`after:${fmtDate(f.since)}`);
    if (f.before) parts.push(`before:${fmtDate(f.before)}`);
    if (text) parts.push(text);
    return parts.join(' ');
}

function quoteIfNeeded(v: string): string {
    return /\s/.test(v) ? `"${v}"` : v;
}

function fmtDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Build a Date from Y/M/D parts, rejecting impossible dates (e.g. 31.02.). */
function makeSearchDate(year: number, month: number, day: number): Date | null {
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date;
}

/**
 * Parse a date token from search input, accepting the common formats people
 * actually type: ISO `YYYY-MM-DD`, European `DD.MM.YYYY` / `DD.MM.YY`,
 * `DD/MM/YYYY` or `MM/DD/YYYY`, and `DD-MM-YYYY`. Ambiguous day/month pairs are
 * resolved by separator (dots/dashes → day-first, slashes → month-first) unless
 * one component is > 12, which forces the interpretation. Falls back to the
 * native parser for anything else (e.g. `13 Sep 2025`).
 */
function parseSearchDate(input: string): Date | null {
    const s = input.trim();
    if (!s) return null;

    const parts = s.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})$/);
    if (parts) {
        const a = Number(parts[1]);
        const b = Number(parts[2]);
        const c = Number(parts[3]);

        // Year-first (ISO-like): YYYY-M-D
        if (parts[1]!.length === 4) return makeSearchDate(a, b, c);

        // Otherwise the last group is the year; decide which of a/b is the day.
        const year = parts[3]!.length <= 2 ? 2000 + c : c;
        let day: number;
        let month: number;
        if (a > 12 && b <= 12) {
            day = a; month = b;
        } else if (b > 12 && a <= 12) {
            month = a; day = b;
        } else {
            // Ambiguous: dots/dashes are day-first (European), slashes month-first (US).
            const monthFirst = s.includes('/');
            day = monthFirst ? b : a;
            month = monthFirst ? a : b;
        }
        return makeSearchDate(year, month, day);
    }

    const fallback = new Date(s);
    return isNaN(fallback.getTime()) ? null : fallback;
}

// ── Parsed query & active filter chips ──

const parsed = computed(() => parseQuickSearch(searchQuery.value));

const hasAnyQuery = computed(() => !!searchQuery.value.trim());

const activeFilterChips = computed(() => {
    const { filters: f, remainingText } = parsed.value;
    const chips: { key: keyof ParsedFilters | 'text'; label: string; icon?: string }[] = [];

    if (remainingText) chips.push({ key: 'text', label: `"${remainingText}"`, icon: 'i-lucide-search' });
    if (f.from) chips.push({ key: 'from', label: `From: ${f.from}`, icon: 'i-lucide-user' });
    if (f.to) chips.push({ key: 'to', label: `To: ${f.to}`, icon: 'i-lucide-users' });
    if (f.subject) chips.push({ key: 'subject', label: `Subject: ${f.subject}`, icon: 'i-lucide-heading' });
    if (f.body) chips.push({ key: 'body', label: `Body: ${f.body}`, icon: 'i-lucide-file-text' });
    if (f.since) chips.push({ key: 'since', label: `After: ${formatDateShort(f.since)}`, icon: 'i-lucide-calendar' });
    if (f.before) chips.push({ key: 'before', label: `Before: ${formatDateShort(f.before)}`, icon: 'i-lucide-calendar' });
    if (f.hasAttachment) chips.push({ key: 'hasAttachment', label: 'Has attachments', icon: 'i-lucide-paperclip' });
    if (f.seen !== undefined) chips.push({
        key: 'seen',
        label: f.seen ? 'Read' : 'Unread',
        icon: f.seen ? 'i-lucide-mail-open' : 'i-lucide-mail',
    });
    if (f.flagged) chips.push({ key: 'flagged', label: 'Flagged', icon: 'i-lucide-star' });
    if (f.answered !== undefined) chips.push({
        key: 'answered',
        label: f.answered ? 'Replied' : 'Unreplied',
        icon: 'i-lucide-reply',
    });
    if (f.draft) chips.push({ key: 'draft', label: 'Drafts', icon: 'i-lucide-file-edit' });

    return chips;
});

function removeFilter(key: keyof ParsedFilters | 'text') {
    const { filters: f, remainingText } = parseQuickSearch(searchQuery.value);
    if (key === 'text') {
        searchQuery.value = buildQuery(f, '');
    } else {
        delete f[key];
        searchQuery.value = buildQuery(f, remainingText);
    }

    if (hasAnyQuery.value) {
        performSearch();
    } else {
        searchResults.value = [];
        totalResults.value = 0;
    }
}

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

function pushRecentSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    const without = recentSearches.value.filter(q => q !== trimmed);
    recentSearches.value = [trimmed, ...without].slice(0, MAX_RECENT);
}

function useRecentSearch(query: string) {
    searchQuery.value = query;
    performSearch();
}

function clearRecentSearches() {
    recentSearches.value = [];
}

// ── Search Actions ──

// Monotonic request token: a search only applies its response if it is still
// the most recent one, so slow/out-of-order responses can't paint stale
// results for a query the user has already moved past.
let searchSeq = 0;
// The in-flight request, so a newer search can abort it (freeing the backend's
// pooled IMAP connection instead of letting a superseded search run to the end).
let searchController: AbortController | null = null;

/** Abort any pending search and invalidate its response. */
function cancelInFlightSearch() {
    searchSeq++;
    searchController?.abort();
    searchController = null;
    isSearching.value = false;
}

async function performSearch(append = false) {
    if (!currentMailAccount.value) return;

    const query = searchQuery.value.trim();
    if (!query) {
        cancelInFlightSearch();
        searchResults.value = [];
        totalResults.value = 0;
        return;
    }

    // Supersede whatever is in flight, then track this request.
    searchController?.abort();
    const controller = new AbortController();
    searchController = controller;
    const seq = ++searchSeq;
    isSearching.value = true;
    if (!append) {
        searchResults.value = [];
        currentPage.value = 1;
        activeResultIndex.value = -1;
    }

    try {
        const offset = (currentPage.value - 1) * PAGE_SIZE;

        if (!append) pushRecentSearch(query);

        const { filters: pf, remainingText } = parseQuickSearch(query);
        const hasStructured = Object.keys(pf).length > 0;

        if (hasStructured) {
            const body: Record<string, unknown> = {};

            if (pf.from) body.from = pf.from;
            if (pf.to) body.to = pf.to;
            if (pf.subject) body.subject = pf.subject;
            if (pf.body) body.body = pf.body;
            if (pf.since) body.since = pf.since.getTime();
            if (pf.before) body.before = pf.before.getTime();
            if (pf.hasAttachment !== undefined) body.hasAttachment = pf.hasAttachment;
            if (pf.seen !== undefined) body.seen = pf.seen;
            if (pf.flagged !== undefined) body.flagged = pf.flagged;
            if (pf.answered !== undefined) body.answered = pf.answered;
            if (pf.draft !== undefined) body.draft = pf.draft;
            if (remainingText) body.text = remainingText;

            const result = await useAPI((api) => api.postMailAccountsByMailAccountIdSearch({
                path: {
                    mailAccountID: currentMailAccount.value!.id
                },
                query: {
                    limit: PAGE_SIZE,
                    offset,
                    order: sortOrder.value,
                },
                body,
                signal: controller.signal
            }));

            if (seq === searchSeq && result.success && result.data) {
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
                    q: query,
                    limit: PAGE_SIZE,
                    offset,
                    order: sortOrder.value,
                },
                signal: controller.signal
            }));

            if (seq === searchSeq && result.success && result.data) {
                searchResults.value = append
                    ? [...searchResults.value, ...result.data.results]
                    : result.data.results;
                totalResults.value = result.data.total;
            }
        }
    } catch (error) {
        // An aborted request rejects here; ignore it — a newer search owns the UI.
        if (seq === searchSeq) console.error('Search failed:', error);
    } finally {
        // Only the latest in-flight search clears the loading state, so the
        // spinner stays up until the query the user actually wants resolves.
        if (seq === searchSeq) {
            isSearching.value = false;
            searchController = null;
        }
    }
}

function loadMore() {
    currentPage.value++;
    performSearch(true);
}

function clearSearch() {
    cancelInFlightSearch();
    searchQuery.value = '';
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

watch(searchQuery, () => {
    if (searchQuery.value.trim()) {
        debouncedSearch();
    } else {
        cancelInFlightSearch();
        searchResults.value = [];
        totalResults.value = 0;
    }
});

watch(sortOrder, () => {
    if (hasAnyQuery.value) performSearch();
});

// ── Keyboard navigation within results ──

function handleArrowKey(e: KeyboardEvent) {
    // The autocomplete dropdown owns arrow/enter keys while it is open.
    if (showSuggestions.value) return;
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
        nextTick(() => searchInputRef.value?.focus());
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
                    <div class="relative flex items-center gap-3">
                        <UIcon name="i-lucide-search" class="size-5 text-muted shrink-0" />

                        <!-- Highlight overlay + caret-only input (input text is
                             transparent; the overlay renders the coloured tokens). -->
                        <div class="relative flex-1 min-w-0">
                            <div
                                ref="highlightOverlayRef"
                                aria-hidden="true"
                                class="pointer-events-none absolute inset-0 flex items-center overflow-hidden"
                            >
                                <span class="whitespace-pre text-base leading-normal">
                                    <span
                                        v-for="(seg, i) in querySegments"
                                        :key="i"
                                        :class="seg.highlight ? 'text-primary bg-primary/15 rounded-[3px]' : 'text-default'"
                                    >{{ seg.text }}</span>
                                </span>
                            </div>

                            <input
                                ref="searchInputRef"
                                v-model="searchQuery"
                                type="text"
                                placeholder="Search your emails — try from:, to:, is:unread…"
                                class="relative w-full border-0 p-0 py-1.5 bg-transparent outline-none text-base leading-normal text-transparent placeholder:text-dimmed"
                                style="caret-color: var(--ui-text-highlighted);"
                                autofocus
                                autocomplete="off"
                                spellcheck="false"
                                @focus="onInputFocus"
                                @blur="onInputBlur"
                                @input="onInputInput"
                                @keyup="syncCaret"
                                @click="syncCaret"
                                @keydown="onInputKeydown"
                                @scroll="syncOverlayScroll"
                            >
                        </div>

                        <UButton
                            v-if="searchQuery"
                            icon="i-lucide-eraser"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            @click="clearSearch"
                        />
                        <UButton
                            icon="i-lucide-x"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            @click="isOpen = false;"
                        />

                        <!-- ── Operator autocomplete dropdown ── -->
                        <div
                            v-if="showSuggestions"
                            class="absolute left-0 right-0 top-full mt-2 z-50 rounded-lg border border-default bg-default shadow-lg overflow-hidden"
                        >
                            <ul class="max-h-64 overflow-y-auto py-1">
                                <li v-for="(s, i) in suggestions" :key="s.insert">
                                    <button
                                        type="button"
                                        class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
                                        :class="i === activeSuggestionIndex ? 'bg-elevated' : 'hover:bg-elevated/60'"
                                        @mousedown.prevent="applySuggestion(s)"
                                        @mouseenter="activeSuggestionIndex = i"
                                    >
                                        <UIcon :name="s.icon" class="size-4 text-muted shrink-0" />
                                        <span class="font-mono text-sm text-default">{{ s.title }}</span>
                                        <span class="text-xs text-dimmed truncate ml-auto pl-3">{{ s.hint }}</span>
                                    </button>
                                </li>
                            </ul>
                            <div class="px-3 py-1.5 border-t border-default text-[11px] text-dimmed flex items-center gap-3">
                                <span class="flex items-center gap-1"><UKbd value="tab" size="sm" /> complete</span>
                                <span class="flex items-center gap-1"><UKbd value="↵" size="sm" /> search</span>
                            </div>
                        </div>
                    </div>

                    <!-- Sort control -->
                    <div class="flex items-center gap-2 mt-3">
                        <div class="flex-1" />

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
                </div>

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
                                    @click="applySuggested(suggestion)"
                                >
                                    <div class="flex items-center justify-center shrink-0 size-8 rounded-md bg-elevated group-hover:bg-accented transition-colors">
                                        <UIcon
                                            :name="suggestion.icon"
                                            class="size-4 text-muted group-hover:text-default transition-colors"
                                        />
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="text-sm font-medium text-default">{{ suggestion.label }}</div>
                                        <div class="text-xs font-mono text-primary truncate">{{ suggestion.query() }}</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <!-- Syntax hint -->
                        <div class="rounded-lg border border-dashed border-default p-3 bg-elevated/30">
                            <div class="text-xs text-muted mb-1.5 flex items-center gap-1.5">
                                <UIcon name="i-lucide-info" class="size-3.5" />
                                <span class="font-medium">Pro tip:</span>
                                <span>Combine filters right in the search bar</span>
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
                            Try adjusting your search terms or removing some filters
                        </p>
                        <UButton
                            color="neutral"
                            variant="outline"
                            size="sm"
                            icon="i-lucide-x"
                            @click="clearSearch"
                        >
                            Clear search
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
