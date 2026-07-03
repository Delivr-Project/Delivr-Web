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

export namespace MailPaginationUtils {

    export type PageSize = 25 | 50 | 100 | 'all';

    export interface DisplayRange {
        start: number;
        end: number;
    }

    /** 1-based "start–end" range currently shown, or `null` when the list is empty. */
    export function computeDisplayRange(currentPage: number, pageSize: PageSize, itemCount: number): DisplayRange | null {
        if (itemCount === 0) return null;
        if (pageSize === 'all') {
            return { start: 1, end: itemCount };
        }
        const start = (currentPage - 1) * pageSize + 1;
        return { start, end: start + itemCount - 1 };
    }

    export function hasNextPage(pageSize: PageSize, itemCount: number): boolean {
        return pageSize !== 'all' && itemCount === pageSize;
    }

    export function hasPrevPage(pageSize: PageSize, currentPage: number): boolean {
        return pageSize !== 'all' && currentPage > 1;
    }

    /**
     * Fetches every page in sequence via `fetchChunk(offset, limit)` and
     * concatenates the results, stopping once a chunk comes back shorter than
     * `chunkSize` (end of data) or `null` (fetch failed — returns what was
     * collected so far rather than throwing, matching this app's convention of
     * degrading gracefully with a toast rather than an unhandled rejection).
     */
    export async function fetchAllPages<T>(
        chunkSize: number,
        fetchChunk: (offset: number, limit: number) => Promise<T[] | null>
    ): Promise<T[]> {
        const collected: T[] = [];
        let offset = 0;

        while (true) {
            const chunk = await fetchChunk(offset, chunkSize);
            if (chunk === null) break;

            collected.push(...chunk);
            if (chunk.length < chunkSize) break;

            offset += chunkSize;
        }

        return collected;
    }

}
