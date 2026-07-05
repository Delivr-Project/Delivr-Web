import { ModifiableAbstractStore } from "~/utils/abstractStore";

export interface FolderNestingData {
    /** Whether the sidebar nests INBOX sub-folders under the Inbox item. */
    nestUnderInbox: boolean;
}

/**
 * Global (per-user), backend-persisted preference controlling whether the
 * sidebar nests INBOX sub-folders under the Inbox item instead of lifting them
 * to top-level siblings. Backed by `/account/preferences/folder-nesting`.
 * Defaults to enabled.
 */
class FolderNestingStore extends ModifiableAbstractStore<FolderNestingData, Partial<FolderNestingData>> {

    private _nestUnderInbox?: ComputedRef<boolean>;

    constructor() {
        super("folderNesting", {
            enableAutoFetchIfEmpty: true
        });
    }

    protected override async fetchData() {
        try {
            if (!useAppCookies().sessionToken.get().value) {
                return null;
            }
            const response = await useAPI((api) => api.getAccountPreferencesFolderNesting({}));

            if (!response.success) {
                return null;
            }

            return { nestUnderInbox: response.data.nestUnderInbox ?? true } satisfies FolderNestingData;

        } catch (error) {
            console.error("Error fetching folder-nesting preference:", error);
            return null;
        }
    }

    /**
     * Reactive, synchronously-readable flag. Defaults to `true` until the
     * preference has loaded (and if it can't be loaded), matching the server
     * default so folders nest under Inbox unless the user has opted out.
     */
    public get nestUnderInbox(): ComputedRef<boolean> {
        return this._nestUnderInbox ??= computed(() => this.useRaw().value?.nestUnderInbox ?? true);
    }

    /** Persists the given nesting state. */
    override async update(updates: Partial<FolderNestingData>) {
        await this.refreshIfNeeded();
        const current = this.useRaw();

        const merged: FolderNestingData = {
            nestUnderInbox: updates.nestUnderInbox ?? current.value?.nestUnderInbox ?? true,
        };

        current.value = merged;
        await this.persist(merged);
    }

    private async persist(data: FolderNestingData) {
        const response = await useAPI((api) => api.putAccountPreferencesFolderNesting({ body: data }));
        if (!response.success) {
            console.error("Failed to persist folder-nesting preference:", response.message);
        }
    }

}

export function useFolderNestingStore() {
    return new FolderNestingStore();
}
