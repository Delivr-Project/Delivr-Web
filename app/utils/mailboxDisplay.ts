import type { Mailbox } from '~/utils/types';

/**
 * Helpers for turning the flat mailbox list returned by the API into a nested
 * sidebar tree, plus lossless conversion between IMAP paths and URL segments.
 *
 * IMAP hierarchy delimiters vary per server ("/" for many, "." for Dovecot
 * style), so nothing here assumes "/". The real `mailbox.delimiter` is always
 * used, and folder names that themselves contain a "/" survive round-tripping
 * because each path segment is encoded individually.
 */

export interface MailboxTreeNode {
    /** Display label for this level (leaf name, never the full path). */
    name: string;
    /** The real mailbox at this node, or null for a synthetic parent level. */
    mailbox: Mailbox | null;
    delimiter: string;
    children: MailboxTreeNode[];
    /** Own unseen count plus all descendants (for collapsed-parent badges). */
    unseenTotal: number;
}

export function isInbox(mb: Mailbox): boolean {
    return mb.specialUse?.replace(/^\\/, '').toLowerCase() === 'inbox'
        || mb.path.toLowerCase() === 'inbox';
}

/** The leaf display name for a mailbox (last path segment). */
export function leafName(mb: Mailbox): string {
    if (mb.name) return mb.name;
    const parts = mb.path.split(mb.delimiter);
    return parts[parts.length - 1] || mb.path;
}

/**
 * Convert an IMAP path into a URL path fragment. Splits on the mailbox's own
 * delimiter and percent-encodes each segment, so a "/"-delimited path maps to
 * real URL segments (no fragile "%2F"), while names containing reserved chars
 * still survive. Reverse of {@link findMailboxByUrlSegments}.
 */
export function pathToUrlSegments(path: string, delimiter: string): string {
    if (!delimiter) return encodeURIComponent(path);
    return path.split(delimiter).map(encodeURIComponent).join('/');
}

/** Full router path for a mailbox folder. */
export function folderUrl(accountId: number, mb: Mailbox): string {
    return `/mail/${accountId}/folder/${pathToUrlSegments(mb.path, mb.delimiter)}`;
}

/** Normalize a catch-all route param (`string | string[]`) into decoded segments. */
export function normalizeFolderParam(param: unknown): string[] {
    const raw = Array.isArray(param) ? param : [param];
    return raw.map((s) => String(s)).filter((s) => s.length > 0);
}

/**
 * Resolve the mailbox a set of URL segments points at. Matches against each
 * mailbox's own delimiter-split path (so it works for any delimiter), with an
 * "inbox" alias and a case-insensitive fallback.
 */
export function findMailboxByUrlSegments(mailboxes: Mailbox[], segments: string[]): Mailbox | undefined {
    if (segments.length === 0) return undefined;

    const exact = mailboxes.find((mb) => {
        const mbSegs = mb.path.split(mb.delimiter);
        return mbSegs.length === segments.length && mbSegs.every((s, i) => s === segments[i]);
    });
    if (exact) return exact;

    if (segments.length === 1 && segments[0]!.toLowerCase() === 'inbox') {
        const inbox = mailboxes.find(isInbox);
        if (inbox) return inbox;
    }

    return mailboxes.find((mb) => {
        const mbSegs = mb.path.split(mb.delimiter);
        return mbSegs.length === segments.length && mbSegs.every((s, i) => s.toLowerCase() === segments[i]!.toLowerCase());
    });
}

export interface Crumb {
    label: string;
    /** Set only for ancestors that exist as real (navigable) mailboxes. */
    to?: string;
}

/**
 * Breadcrumb trail for a mailbox, built from its full real path. Each level
 * that corresponds to an existing mailbox gets a link; non-selectable
 * intermediate levels are shown as plain labels.
 */
export function crumbs(mb: Mailbox, mailboxes: Mailbox[], accountId: number): Crumb[] {
    const parts = mb.path.split(mb.delimiter);
    const items: Crumb[] = [];
    let accum = '';
    for (let i = 0; i < parts.length; i++) {
        accum = i === 0 ? parts[i]! : accum + mb.delimiter + parts[i];
        const found = mailboxes.find((m) => m.path === accum);
        items.push({
            label: found ? leafName(found) : parts[i]!,
            to: found ? folderUrl(accountId, found) : undefined,
        });
    }
    return items;
}

function rollupUnseen(node: MailboxTreeNode): number {
    let total = node.mailbox?.status.unseen ?? 0;
    for (const child of node.children) total += rollupUnseen(child);
    node.unseenTotal = total;
    return total;
}

/**
 * Build a nested folder tree from the flat mailbox list, preserving API order.
 *
 * The Inbox is excluded (it is pinned separately in the sidebar). Folders
 * nested under INBOX (e.g. "INBOX.Sent" on "."-delimited servers) have that
 * prefix stripped for display so they present as top-level siblings of Inbox,
 * matching how mail clients conventionally show them — while navigation still
 * uses each mailbox's real path. Intermediate levels with no selectable
 * mailbox become non-navigable group headers.
 */
export function buildMailboxTree(mailboxes: Mailbox[]): MailboxTreeNode[] {
    const inbox = mailboxes.find(isInbox);
    const defaultDelimiter = inbox?.delimiter || mailboxes[0]?.delimiter || '/';
    const inboxPrefix = inbox ? inbox.path + defaultDelimiter : null;

    const roots: MailboxTreeNode[] = [];
    const byKey = new Map<string, MailboxTreeNode>();

    for (const mb of mailboxes) {
        if (inbox && mb === inbox) continue;

        const delimiter = mb.delimiter || defaultDelimiter;

        let displayPath = mb.path;
        if (inboxPrefix && mb.path.startsWith(inboxPrefix)) {
            displayPath = mb.path.slice(inboxPrefix.length);
        }

        const segments = displayPath.split(delimiter).filter((s) => s.length > 0);
        if (segments.length === 0) continue;

        let level = roots;
        let accumKey = '';
        for (let i = 0; i < segments.length; i++) {
            // NUL can never appear in an IMAP mailbox name, so it is a
            // safe separator for keying hierarchy paths without collisions.
            accumKey += '\u0000' + segments[i];
            let node = byKey.get(accumKey);
            if (!node) {
                node = {
                    name: segments[i]!,
                    mailbox: null,
                    delimiter,
                    children: [],
                    unseenTotal: 0,
                };
                byKey.set(accumKey, node);
                level.push(node);
            }
            if (i === segments.length - 1) {
                node.mailbox = mb;
                node.name = leafName(mb);
            }
            level = node.children;
        }
    }

    roots.forEach(rollupUnseen);
    return roots;
}
