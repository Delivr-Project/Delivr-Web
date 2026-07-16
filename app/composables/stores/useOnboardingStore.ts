import { ModifiableAbstractStore } from "~/utils/abstractStore";

export interface OnboardingData {
    /** Whether the user has completed the one-time, platform-wide welcome onboarding. */
    completed: boolean;
}

/**
 * Global (per-user), backend-persisted flag tracking whether the user has
 * finished (or skipped) the one-time welcome onboarding. Backed by
 * `/account/preferences/onboarding`. Drives the first-login redirect in
 * `auth.global.ts`, so it defaults to `false` until explicitly completed.
 */
class OnboardingStore extends ModifiableAbstractStore<OnboardingData, Partial<OnboardingData>> {

    private _completed?: ComputedRef<boolean>;

    constructor() {
        super("onboarding", {
            enableAutoFetchIfEmpty: true
        });
    }

    protected override async fetchData() {
        try {
            if (!useAppCookies().sessionToken.get().value) {
                return null;
            }
            const response = await useAPI((api) => api.getAccountPreferencesOnboarding({}));

            if (!response.success) {
                return null;
            }

            return { completed: response.data.completed ?? false } satisfies OnboardingData;

        } catch (error) {
            console.error("Error fetching onboarding state:", error);
            return null;
        }
    }

    /**
     * Reactive, synchronously-readable flag. Defaults to `false` until the
     * state has loaded, matching the server default so the welcome onboarding
     * shows unless the user has already completed it.
     */
    public get completed(): ComputedRef<boolean> {
        return this._completed ??= computed(() => this.useRaw().value?.completed ?? false);
    }

    /** Persists the given completion state. */
    override async update(updates: Partial<OnboardingData>) {
        await this.refreshIfNeeded();
        const current = this.useRaw();

        const merged: OnboardingData = {
            completed: updates.completed ?? current.value?.completed ?? false,
        };

        current.value = merged;
        await this.persist(merged);
    }

    private async persist(data: OnboardingData) {
        const response = await useAPI((api) => api.putAccountPreferencesOnboarding({ body: data }));
        if (!response.success) {
            console.error("Failed to persist onboarding state:", response.message);
        }
    }

}

export function useOnboardingStore() {
    return new OnboardingStore();
}
