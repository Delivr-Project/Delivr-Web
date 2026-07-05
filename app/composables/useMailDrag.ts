import { createSharedComposable } from '@vueuse/core';
import type { Mailbox } from '~/utils/types';

/**
 * Shared drag-and-drop state for moving mails between folders.
 *
 * The drag *source* (the mail list in `MailFolderView`) and the drop *targets*
 * (the folder tree in the sidebar layout) live in separate components, so the
 * payload and the "perform the move" logic have to be shared here.
 *
 * The folder view registers a move handler (it owns the optimistic list update,
 * toast and refresh); the sidebar resolves which mailbox was dropped on and
 * calls {@link dropOnMailbox}, which forwards the dragged UIDs to that handler.
 */

export interface MailDragPayload {
    accountId: number;
    /** Real IMAP path of the folder the mails are being dragged out of. */
    sourceFolderPath: string;
    uids: number[];
}

type MoveHandler = (target: Mailbox, uids: number[]) => void | Promise<void>;

const _useMailDrag = () => {
    // Non-null only while a drag is in progress.
    const dragging = ref<MailDragPayload | null>(null);

    // Registered by whichever folder view is currently mounted.
    let moveHandler: MoveHandler | null = null;

    function startDrag(payload: MailDragPayload) {
        dragging.value = payload;
    }

    function endDrag() {
        dragging.value = null;
    }

    // Returns an unregister fn that only clears if this handler is still active,
    // so an outgoing folder view unmounting after the next one mounted (route
    // transitions can overlap) doesn't wipe the newcomer's handler.
    function registerMoveHandler(fn: MoveHandler): () => void {
        moveHandler = fn;
        return () => { if (moveHandler === fn) moveHandler = null; };
    }

    /** Called by the sidebar when mails are dropped onto a folder. */
    async function dropOnMailbox(target: Mailbox) {
        const payload = dragging.value;
        endDrag();
        if (!payload || !moveHandler) return;
        if (target.path === payload.sourceFolderPath) return;
        await moveHandler(target, payload.uids);
    }

    return { dragging, startDrag, endDrag, registerMoveHandler, dropOnMailbox };
};

export const useMailDrag = createSharedComposable(_useMailDrag);
