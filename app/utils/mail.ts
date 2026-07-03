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
