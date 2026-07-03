export namespace MailUtils {

    const TRASH_NAMES = ['trash', 'deleted', 'deleted messages', 'deleted items', '[gmail]/trash'];

    /**
     * Name-based heuristic for "is this the Trash folder" — matches the same
     * common naming conventions already used for icon selection across the app.
     */
    export function isTrashFolder(path: string): boolean {
        return TRASH_NAMES.includes(path.toLowerCase());
    }

}

/**
 * Pure decision logic for Outlook/Gmail-style modifier-click selection on a
 * mail row, shared by both the dense list view and the split (reading pane)
 * view — either template just forwards its native click event here instead
 * of duplicating the modifier handling.
 */
export namespace MailSelectionUtils {

    export interface ClickModifiers {
        ctrlKey: boolean;
        metaKey: boolean;
        shiftKey: boolean;
    }

    export interface ClickResult {
        /** The selection (checkbox / highlight state) after this click. */
        selection: Set<number>;
        /** The anchor to use for the next Shift+Click range. */
        anchor: number | null;
        /** Whether the row's normal "open this mail" action should still fire. */
        openMail: boolean;
    }

    /**
     * Decides the new selection/anchor for a click on `clickedUid`, given the
     * row order currently on screen (needed to resolve a Shift+Click range).
     *
     * - Shift+Click: replaces the selection with the range from `anchor` (or
     *   `clickedUid` itself if there is no anchor yet) to `clickedUid`,
     *   inclusive. Does not move the anchor and does not open the mail.
     * - Ctrl/Cmd+Click: toggles `clickedUid` in the existing selection, moves
     *   the anchor to it, and does not open the mail.
     * - No modifier: clears any existing multi-selection (existing behavior —
     *   a plain click always acts on just the one row it lands on), moves the
     *   anchor to `clickedUid`, and opens the mail.
     */
    export function resolveClick(
        currentSelection: ReadonlySet<number>,
        orderedUids: readonly number[],
        anchor: number | null,
        clickedUid: number,
        modifiers: ClickModifiers
    ): ClickResult {

        if (modifiers.shiftKey) {
            const from = anchor ?? clickedUid;
            return {
                selection: new Set(computeRange(orderedUids, from, clickedUid)),
                anchor: from,
                openMail: false
            };
        }

        if (modifiers.ctrlKey || modifiers.metaKey) {
            const next = new Set(currentSelection);
            if (next.has(clickedUid)) next.delete(clickedUid);
            else next.add(clickedUid);
            return { selection: next, anchor: clickedUid, openMail: false };
        }

        return { selection: new Set(), anchor: clickedUid, openMail: true };
    }

    /**
     * The inclusive range of UIDs between `fromUid` and `toUid` in on-screen
     * order. Falls back to just `[toUid]` if either endpoint isn't currently
     * on screen (e.g. the anchor scrolled out after a refresh).
     */
    export function computeRange(orderedUids: readonly number[], fromUid: number, toUid: number): number[] {
        const fromIdx = orderedUids.indexOf(fromUid);
        const toIdx = orderedUids.indexOf(toUid);
        if (fromIdx === -1 || toIdx === -1) return [toUid];

        const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        return orderedUids.slice(start, end + 1);
    }

}
