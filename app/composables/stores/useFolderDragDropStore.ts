import { ModifiableAbstractStore } from "~/utils/abstractStore";

export interface FolderDragDropData {
    /** Whether folders can be reorganised by drag-and-drop in the sidebar. */
    enabled: boolean;
}

/**
 * Global (per-user), backend-persisted preference controlling whether folders
 * can be moved by drag-and-drop in the sidebar. Backed by
 * `/account/preferences/folder-dnd`. Opt-in, so it defaults to disabled.
 */
class FolderDragDropStore extends ModifiableAbstractStore<FolderDragDropData, Partial<FolderDragDropData>> {

    private _enabled?: ComputedRef<boolean>;

    constructor() {
        super("folderDragDrop", {
            enableAutoFetchIfEmpty: true
        });
    }

    protected override async fetchData() {
        try {
            if (!useAppCookies().sessionToken.get().value) {
                return null;
            }
            const response = await useAPI((api) => api.getAccountPreferencesFolderDnd({}));

            if (!response.success) {
                return null;
            }

            return { enabled: response.data.enabled ?? false } satisfies FolderDragDropData;

        } catch (error) {
            console.error("Error fetching folder drag-and-drop preference:", error);
            return null;
        }
    }

    /**
     * Reactive, synchronously-readable flag. Defaults to `false` until the
     * preference has loaded (and if it can't be loaded), matching the server
     * default so drag-and-drop stays off unless the user has opted in.
     */
    public get enabled(): ComputedRef<boolean> {
        return this._enabled ??= computed(() => this.useRaw().value?.enabled ?? false);
    }

    /** Persists the given enabled state. */
    override async update(updates: Partial<FolderDragDropData>) {
        await this.refreshIfNeeded();
        const current = this.useRaw();

        const merged: FolderDragDropData = {
            enabled: updates.enabled ?? current.value?.enabled ?? false,
        };

        current.value = merged;
        await this.persist(merged);
    }

    private async persist(data: FolderDragDropData) {
        const response = await useAPI((api) => api.putAccountPreferencesFolderDnd({ body: data }));
        if (!response.success) {
            console.error("Failed to persist folder drag-and-drop preference:", response.message);
        }
    }

}

export function useFolderDragDropStore() {
    return new FolderDragDropStore();
}
