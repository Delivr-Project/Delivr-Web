import { ModifiableAbstractStore } from "~/utils/abstractStore";

export interface AutoMarkSeenData {
    /** Whether opening/viewing a mail automatically marks it as seen. */
    enabled: boolean;
}

/**
 * Global (per-user), backend-persisted preference controlling whether opening a
 * mail automatically marks it as seen after a short dwell. Backed by
 * `/account/preferences/auto-mark-seen`. Defaults to enabled.
 */
class AutoMarkSeenStore extends ModifiableAbstractStore<AutoMarkSeenData, Partial<AutoMarkSeenData>> {

    private _enabled?: ComputedRef<boolean>;

    constructor() {
        super("autoMarkSeen", {
            enableAutoFetchIfEmpty: true
        });
    }

    protected override async fetchData() {
        try {
            if (!useAppCookies().sessionToken.get().value) {
                return null;
            }
            const response = await useAPI((api) => api.getAccountPreferencesAutoMarkSeen({}));

            if (!response.success) {
                return null;
            }

            return { enabled: response.data.enabled ?? true } satisfies AutoMarkSeenData;

        } catch (error) {
            console.error("Error fetching auto-mark-seen preference:", error);
            return null;
        }
    }

    /**
     * Reactive, synchronously-readable flag. Defaults to `true` until the
     * preference has loaded (and if it can't be loaded), matching the server
     * default so the behaviour is on unless the user has explicitly opted out.
     */
    public get enabled(): ComputedRef<boolean> {
        return this._enabled ??= computed(() => this.useRaw().value?.enabled ?? true);
    }

    /** Persists the given enabled state. */
    override async update(updates: Partial<AutoMarkSeenData>) {
        await this.refreshIfNeeded();
        const current = this.useRaw();

        const merged: AutoMarkSeenData = {
            enabled: updates.enabled ?? current.value?.enabled ?? true,
        };

        current.value = merged;
        await this.persist(merged);
    }

    private async persist(data: AutoMarkSeenData) {
        const response = await useAPI((api) => api.putAccountPreferencesAutoMarkSeen({ body: data }));
        if (!response.success) {
            console.error("Failed to persist auto-mark-seen preference:", response.message);
        }
    }

}

export function useAutoMarkSeenStore() {
    return new AutoMarkSeenStore();
}
