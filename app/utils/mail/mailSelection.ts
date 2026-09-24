/**
 * Selection rules for the mail list, shared by mouse and keyboard.
 *
 * They follow the usual desktop conventions: a plain click or arrow key moves
 * the anchor, Ctrl/Cmd toggles a single mail, and Shift selects everything
 * between the anchor and the target — replacing the selection, or adding to it
 * when Ctrl/Cmd is held as well. All functions are pure: they take the list's
 * current order and return a new selection.
 */
export namespace MailSelectionUtils {

    /**
     * The UIDs from `anchor` to `target` in list order, both included. Falls
     * back to just `target` when the anchor is not (or no longer) in the list.
     */
    export function range(order: readonly number[], anchor: number | null, target: number): number[] {
        const to = order.indexOf(target);
        if (to === -1) return [];
        const from = anchor === null ? -1 : order.indexOf(anchor);
        if (from === -1) return [target];
        const [start, end] = from <= to ? [from, to] : [to, from];
        return order.slice(start, end + 1);
    }

    /** Shift (+ Ctrl/Cmd to keep the current selection) from the anchor to `target`. */
    export function selectRange(
        order: readonly number[],
        selection: ReadonlySet<number>,
        anchor: number | null,
        target: number,
        additive: boolean,
    ): Set<number> {
        const next = additive ? new Set(selection) : new Set<number>();
        for (const uid of range(order, anchor, target)) next.add(uid);
        return next;
    }

    export function toggle(selection: ReadonlySet<number>, uid: number): Set<number> {
        const next = new Set(selection);
        if (next.has(uid)) next.delete(uid);
        else next.add(uid);
        return next;
    }

    /**
     * The UID `step` rows away from `current`, clamped to the list. Starts at
     * the first (or, going up, the last) row when there is no current one.
     */
    export function move(order: readonly number[], current: number | null, step: number): number | null {
        if (order.length === 0) return null;
        const index = current === null ? -1 : order.indexOf(current);
        if (index === -1) return step >= 0 ? order[0]! : order[order.length - 1]!;
        return order[Math.min(order.length - 1, Math.max(0, index + step))]!;
    }

}
