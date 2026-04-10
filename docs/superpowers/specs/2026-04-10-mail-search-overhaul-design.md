# Mail Search Overhaul — Design

**Date:** 2026-04-10
**Status:** Approved, ready for implementation planning
**Scope:** Delivr-API + Delivr-Web — mail search only

## Goal

Rebuild the mail search system across backend and frontend so it is clean, visually consistent with the app's dark/sky/slate theme, and feature-rich without overwhelming new users. The headline improvements:

- A single **shared query grammar** (Gmail-style operators) understood identically by the API parser and the web UI tokenizer.
- **Syntax highlighting in the search input itself** — every recognized operator+value pair renders as a colored pill as the user types.
- **Unified UX** — no more Quick/Advanced mode switch; one input is the source of truth, with a compact "+" popover for discovery of rarely-used filters.
- **Stable modal layout** — fixed-height regions eliminate the current content-driven resize jank.
- **Better backend execution** — parallelized per-mailbox IMAP queries, attachment filter pushed into IMAP criteria, short-lived result cache for pagination.

## Non-goals

- No FTS5 / SQLite search index. No message persistence. No background sync. (Separate, larger project.)
- No thread/conversation grouping. (Depends on a threading subsystem that doesn't exist yet.)
- No relevance ranking or fuzzy/regex/wildcard matching.
- No saved searches. (User explicitly excluded.)
- No server-side search history or analytics.
- No light-mode theming — the app is dark-only.
- No feature flag — additive backend, branch-based frontend cutover.

## Architecture

### Shared query grammar

The central idea is one parser, one AST, one set of tests — consumed by both repos.

```
  User input (plain text, Gmail-style operators)
           │
           ▼
  ┌────────────────────────┐
  │ search-query module    │   parse(text) → AST + warnings
  │ (pure TypeScript)      │   toImapSearch(ast) → SearchObject
  │                        │   toChips(ast) → chip list
  │                        │   toHighlightTokens(ast) → spans
  └────────────────────────┘
       │            │
       ▼            ▼
   Frontend     Backend
  (highlight   (IMAP exec
   + chips)    + results)
```

**Distribution:** the module is vendored into both repos, not published as an npm package. Canonical location is `Delivr-API/src/utils/search-query/`. A small sync script `scripts/sync-search-query.sh` (in `Delivr-Web`) copies the directory from the API repo, and a CI check asserts the two directories are byte-identical. Upgrading to a proper workspace package is a future concern, not a gate for this project.

**Why vendored, not packaged:** publishing a real package (even privately) adds build/publish infrastructure for near-zero gain today. A byte-identity CI guard plus identical unit tests on both sides is sufficient drift prevention for a single small module.

### Query grammar specification

**Field operators** (substring match on a mail field):

| Operator | Meaning |
|---|---|
| `from:VALUE` | Sender address or display name substring |
| `to:VALUE` | Recipient address or name substring |
| `cc:VALUE` | CC recipient |
| `bcc:VALUE` | BCC recipient |
| `subject:VALUE` | Subject substring |
| `body:VALUE` | Message body substring |
| `in:MAILBOX` | Scope the search to one mailbox (absent = all folders) |

**Flag operators** (enum values):

| Operator | Values |
|---|---|
| `is:` | `unread`, `read`, `flagged` (alias `starred`), `answered` (alias `replied`), `draft` |
| `has:` | `attachment` |

**Date operators** (accept `YYYY-MM-DD` or relative `7d` / `30d` / `3m` / `1y` / `today`):

| Operator | Meaning |
|---|---|
| `after:VALUE` (alias `since:`) | Date on or after |
| `before:VALUE` (alias `until:`) | Date strictly before |

**Values:**

- Bare word: `from:github.com` — substring match.
- Quoted phrase: `subject:"weekly report"` — exact phrase match. Quotes escape spaces only; no backslash escaping needed at this stage.
- Everything outside any operator is free text, ANDed against subject+from+to+body (matches today's fallback behavior).

**Combinators:**

- Implicit **AND** between adjacent tokens.
- **OR** (uppercase only — lowercase `or` is free text): `from:alice OR from:bob`.
- Parentheses for grouping: `(from:alice OR from:bob) is:unread`.
- **Negation** with `-` prefix on any operator or literal: `-from:spam@x.com`, `-is:read`, `-"out of office"`.

**Operator precedence:** negation > AND > OR. Parentheses override.

**Error handling:** unknown operator (`foo:bar`), unclosed quote, malformed date → parser emits a warning and treats the token as free text. The response's `warnings[]` field surfaces these to the UI; the highlighted overlay leaves the unparseable token unstyled as an honesty signal.

**Out of scope:** `size:`, `filename:`, `list:`, `header:`, `older_than:`, `newer_than:`, regex/wildcards. Add later if asked.

## Backend changes (Delivr-API)

### 1. Shared query module

New directory `Delivr-API/src/utils/search-query/`:

- `tokenizer.ts` — lexer producing a flat token stream (operator tokens, value tokens, phrase tokens, paren tokens, `OR`, `-`, free text).
- `parser.ts` — token stream → AST. AST node types: `And`, `Or`, `Not`, `Field` (field operators), `Flag` (is/has), `Date` (before/after), `FreeText`. Top-level is always an `And` of children for simplicity.
- `to-imap.ts` — AST → `imapflow` `SearchObject`. Handles recursive `or:` and `not:` construction. Extracts `in:` nodes separately as the mailbox list (they're not criteria, they're scope).
- `to-chips.ts` — AST → flat chip list for UI consumption. Each chip has `{ id, kind, label, value, negated }`.
- `to-highlight.ts` — AST → a list of `{ start, end, kind, negated }` spans mapped back to the original input string, for overlay rendering.
- `index.ts` — public entry: `parse(input: string): { ast: Node, warnings: string[], chips: Chip[], highlight: Span[] }`.

Pure TypeScript, zero runtime dependencies, 100% unit-testable.

### 2. Search route refactor

File: `Delivr-API/src/api/routes/mail-accounts/search/index.ts` (sibling repo).

- `POST /search` body schema gains a new optional `query: string` field. When present, the server parses it and uses the resulting AST as the primary search criteria.
- Existing structured fields (`subject`, `from`, `to`, `body`, `since`, `before`, `hasAttachment`, `seen`, `flagged`, `answered`, `draft`) remain accepted for backward compatibility and are merged with the parsed AST as additional AND constraints.
- `GET /search?q=...` becomes a thin wrapper that constructs `{ query: q }` and delegates to the same handler. Two code paths collapse to one.
- Response shape gains:
  - `warnings: string[]` — parser warnings surfaced to the UI.
  - Each result in `results[]` gains `snippet: string | null` and `matches: Array<{ start: number, end: number }>` for snippet highlighting.
- OpenAPI documentation updated via `hono-openapi` so the generated frontend client picks up the new field automatically.

### 3. IMAP execution improvements

File: `Delivr-API/src/utils/mails/backends/imap.ts` (sibling repo), method `searchMailsAcrossFolders`.

- **Parallelized per-mailbox search** with a bounded concurrency pool (default 4, configurable via env `SEARCH_MAILBOX_CONCURRENCY`). Each mailbox still acquires its own lock; the pool runs N lock acquisitions concurrently. Expect approximately N× speedup on multi-folder accounts.
- **Attachment pre-filter pushed into IMAP** where possible. When `has:attachment` is part of the criteria, include `HEADER Content-Type multipart` as a pre-filter in the IMAP SEARCH command. This cuts the UID set before any fetch. Post-fetch confirmation is still used to eliminate false positives (multipart/alternative messages without real attachments).
- **Short-lived in-memory result cache.** Key: `hash(userId + accountId + astCanonicalForm + sortOrder + includeTrash + includeSpam + includeDrafts)`. Value: the full merged+sorted result list for that query. TTL: 60 seconds. LRU with a reasonable cap (e.g., 256 entries per process). Implementation: a simple Map + timestamp check, no new dependencies. Cache is invalidated on any write operation to that account (move, delete, flag change, send).
- Pagination operates on the cached list, so "load more" and repeated scrolls never re-hit IMAP within the TTL window.

**Cache persistence:** in-memory only for this pass. Dies on restart. Redis/SQLite-backed cache is a future concern.

### 4. Snippet generation

In the mail parser path (where `postal-mime` produces the decoded bodies):

- Walk the free-text and field-value literals from the AST.
- For each result, find the first case-insensitive match of any literal in the decoded plain-text body.
- Extract ~150 characters centered on the first match, trimmed to word boundaries where practical.
- Return `{ snippet, matches: [{ start, end }] }` where offsets are relative to the returned snippet string, not the full body.
- If no text literals exist in the query (pure flag/date query), fall back to the first 150 characters of the body with `matches: []`.

### 5. Backend tests

New file `Delivr-API/tests/search-query.test.ts` — pure parser, no IMAP:

- Every operator with valid values.
- Quoted phrases, escape handling, unclosed quotes (warning).
- Negation on every operator type.
- `OR` precedence vs implicit `AND`.
- Parenthesized groups, nested groups.
- Date parsing: absolute, relative (`7d`, `3m`), invalid.
- Free text interleaved with operators.
- Unknown operator → warning, treated as free text.
- Empty input, whitespace-only, single-character, pathological long input.
- Round-trip stability: `parse(serialize(parse(x)))` produces the same AST as `parse(x)` for a corpus of fixtures.

New file `Delivr-API/tests/search-query-imap.test.ts` — AST → IMAP translation:

- Each AST node type translates correctly.
- `Not` nodes produce IMAP `not:` criteria.
- `Or` nodes produce IMAP `or:` arrays.
- `has:attachment` produces the `HEADER Content-Type multipart` pre-filter.
- `in:` nodes are extracted as the mailbox list, not as criteria.

Extend `Delivr-API/tests/mail-clients.test.ts`:

- Parallel multi-mailbox search against fixtures; concurrency cap is respected.
- Attachment pre-filter path hits the header criteria before full fetch.
- Snippet extraction returns correct offsets against a known body.

Extend `Delivr-API/tests/api.routes.test.ts`:

- `POST /search` with new `query` field.
- `POST /search` with both `query` and legacy structured fields (AND merge).
- Warnings surface correctly in the response.
- Cache hit on identical consecutive requests (mock clock for TTL).

## Frontend changes (Delivr-Web)

All changes land in [app/components/dashboard/MailSearch.vue](../../../app/components/dashboard/MailSearch.vue) plus a few new helper modules.

### 1. Vendor the shared grammar module

Copy `Delivr-API/src/utils/search-query/` into `Delivr-Web/app/utils/search-query/`. Add `scripts/sync-search-query.sh` that copies and compares. Add a CI step that runs the script with `--check` and fails if the two directories diverge.

### 2. Fixed-height modal shell

Replace the content-driven sizing with three stable regions:

```
┌────────────────────────────────────────────┐
│  HEADER (fixed height, ~110px)             │
│  ├─ highlighted input + clear button       │
│  └─ chip row (scrolls horizontally if >1)  │
├────────────────────────────────────────────┤
│  BODY (flex-1, scrollable, fixed max-h)    │
│  ├─ idle: recent + suggested + pro-tip     │
│  ├─ loading: skeleton rows                 │
│  ├─ results: result cards                  │
│  └─ empty: "no matches" state              │
├────────────────────────────────────────────┤
│  FOOTER (fixed height, ~36px)              │
│  └─ status + keyboard legend               │
└────────────────────────────────────────────┘
```

Modal dimensions: `w-[min(900px,90vw)] h-[min(640px,85vh)]`. Regions never shift. Body transitions between its four states with a short opacity fade, never a height change. This single change eliminates the "constant resizing" complaint from the brief.

### 3. Highlighted input overlay

The mechanism:

- A normal `<textarea>` with `color: transparent; caret-color: <fg-color>`. The text is still present in the DOM for selection, IME, accessibility, and clipboard.
- An absolutely-positioned `<div>` directly behind it, with identical font family, size, weight, line-height, and padding. Renders the parsed tokens as colored spans with rounded pill backgrounds.
- Scroll position and dimensions synced via a small composable `useInputOverlay(inputRef, overlayRef)`.
- Tokens come from the live parser output, recomputed on each input change (parser is cheap, no debounce needed for highlighting).
- Every operator+value pair renders as **one** pill-shaped span (rounded background, slight horizontal padding, matching color family). Free text is neutral. Unparseable tokens are left unstyled — the "honesty signal."

**Chip color mapping** (sky primary, slate neutral, no `color="error"` anywhere):

| Token kind | Class |
|---|---|
| `from:`, `to:`, `cc:`, `bcc:` | `bg-primary/15 text-primary ring-1 ring-primary/30` |
| `subject:`, `body:` | `bg-neutral-500/15 text-neutral-200 ring-1 ring-neutral-500/30` |
| `is:` / `has:` positive | `bg-success/15 text-success ring-1 ring-success/30` |
| `is:` / `has:` negated | Same as positive, with `line-through decoration-2` on the value |
| `before:`, `after:` | `bg-warning/15 text-warning ring-1 ring-warning/30` |
| `in:` | `bg-info/15 text-info ring-1 ring-info/30` |
| `OR`, parens, leading `-` | `text-neutral-500 font-mono` |
| Free text | default, no decoration |

### 4. Chip row

Derived from the AST, not stored in parallel state. Rendered below the input. Each chip uses the same color mapping as the overlay. Clicking a chip's `×`:

1. Removes the corresponding node from the AST.
2. Re-serializes the AST back into the input string.
3. Input and chip row update together (both driven by the AST).

This guarantees the input is always the source of truth.

### 5. "+" more-filters popover

A single compact `+` button next to the input, opening a `UPopover`. Contents:

- Date pickers for `after:` and `before:` (using the existing `UCalendar`).
- Relative-date quick picks: "Today", "Last 7 days", "Last 30 days", "Last 3 months", "This year".
- Toggle filters: read/unread, flagged, answered, draft, has attachment.
- `in:` scope picker: a list of the user's mailboxes from the existing store.

**Every widget writes back into the input string** as the corresponding token. The popover closes automatically on selection. No duplicated state, no mode fork. The existing Advanced tab and its filter state are deleted.

### 6. Autocomplete

A floating dropdown anchored to the input caret, implemented with `UListbox`-style primitives. Triggered by the parser detecting an incomplete operator:

| Trigger | Suggestions source |
|---|---|
| `from:`, `to:`, `cc:`, `bcc:` | Recent senders/recipients from the last ~N fetched messages, client-side only |
| `is:` | `unread`, `read`, `flagged`, `answered`, `draft` |
| `has:` | `attachment` |
| `in:` | User's mailboxes from the existing store |
| `after:`, `before:` | Relative values (`7d`, `30d`, `3m`, `1y`, `today`) + a "pick a date…" option that opens the calendar |

Keyboard:

- `Tab` or `Enter` — accept the highlighted suggestion.
- `↑` / `↓` — navigate suggestions.
- `Esc` — dismiss the dropdown first, modal second.

**Scope for this pass:** `from:`/`to:` suggestions are drawn from client-side recently-fetched messages only. Server-backed sender indexing is a future follow-up.

### 7. Keyboard shortcuts — consistent and documented

Single keymap, shown in the footer legend exactly as it behaves:

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+K` | Open search (global) |
| `/` | Focus the input when modal is open |
| `↑` / `↓` | Navigate results (or autocomplete when open) |
| `Enter` | Open selected result |
| `Cmd/Ctrl+Enter` | Open in background (no modal close) |
| `Tab` | Accept autocomplete suggestion |
| `Esc` | Dismiss autocomplete → dismiss modal |
| `Cmd/Ctrl+Backspace` | Delete last chip/token |

### 8. Result snippet with match highlighting

Each result card renders the `snippet` field from the API. Matches (from the API's `matches` array) are wrapped in `<mark class="bg-primary/20 text-primary rounded-sm px-0.5">`. The frontend does not re-scan the snippet — it trusts the server's match offsets. A small `useSnippetHighlight(snippet, matches)` composable does the span building.

### 9. Deletions

- Quick/Advanced tab bar — gone.
- Duplicated advanced filter state — gone.
- Tri-state toggle buttons in their current form — replaced by the `+` popover.
- Every hardcoded `color="error"` usage in the search surface — gone. The only colors used come from the app's primary/neutral/info/success/warning tokens.

### 10. Frontend tests

[tests/](../../../tests/) currently has only `tests/utils.test.ts`. We add coverage for the new search surface only.

New file `tests/search-query.test.ts` — **identical test corpus to the backend parser**, importing the vendored module. The CI byte-identity guard is the first line of defense against drift; identical passing tests are the second.

New file `tests/MailSearch.test.ts` — component test using `@nuxt/test-utils` + `@vue/test-utils`:

- Typing `from:github.com` renders one highlighted pill span in the overlay.
- Typing an unknown operator leaves the token unstyled.
- Clicking a chip's `×` removes the AST node and updates the input string.
- `+` popover date picker writes `after:YYYY-MM-DD` into the input.
- Autocomplete opens for `from:`, accepts on `Tab`.
- `↑` / `↓` moves the selected result; `Enter` navigates.
- Modal computed height is stable across idle / loading / results / empty body states (assert against the computed style).

Extend `tests/utils.test.ts` with any new pure helpers (snippet highlighter, chip serializer) if they end up outside the search-query module.

**What we do not test:** visual regression. Manual QA covers pixel-level styling.

## Rollout plan

1. **Backend ships first.** The new `query` body field is additive; old clients continue to work. Merge to main and deploy. No feature flag.
2. **Frontend ships second**, targeting the deployed or locally-running new API.
3. **Manual QA checklist** before the frontend merge:
   - Every operator produces correct results against a real IMAP test account.
   - Every token kind renders with the correct highlighted color in the input overlay.
   - Chip row stays in sync with the input when chips are removed or the input is edited.
   - `+` popover writes tokens back into the input correctly for every widget type.
   - Autocomplete triggers and accepts on every supported operator.
   - Modal dimensions do not change across idle / loading / results / empty states (resize with DevTools, observe stability).
   - No `color="error"` visible anywhere in the search surface.
   - Every keyboard shortcut in the footer legend behaves as documented.
4. **No feature flag.** This is a UX-refinement project on a dedicated branch, not a risky platform change. Branch → review → merge is the cutover.

## Open questions

None. All design questions were resolved during the brainstorming session. Proceeding to implementation planning.
