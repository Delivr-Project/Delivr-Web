import { ModifiableAbstractStore } from "~/utils/abstractStore";

export type RemoteContentDecision = "allow" | "block";

/**
 * Resolved policy for a given sender:
 * - `allow`  → explicitly allowed (load remote content)
 * - `block`  → explicitly blocked (never load, no banner)
 * - `unset`  → no rule yet → default to blocking and show the banner
 */
export type ResolvedRemotePolicy = RemoteContentDecision | "unset";

export interface RemoteContentPolicyData {
    /** Full sender address (lowercase) → decision. Takes precedence over domain. */
    addresses: Record<string, RemoteContentDecision>;
    /** Sender domain (lowercase, e.g. "example.com") → decision. */
    domains: Record<string, RemoteContentDecision>;
}

export interface PreferencesData {
    /** Per-address / per-domain policy for loading remote content in HTML emails. */
    remoteContentPolicy: RemoteContentPolicyData;
    /** Whether opening/viewing a mail automatically marks it as seen. */
    autoMarkSeen: boolean;
    /** Whether the sidebar nests INBOX sub-folders under the Inbox item. */
    nestUnderInbox: boolean;
    /** Whether folders can be reorganised by drag-and-drop in the sidebar. */
    folderDragDrop: boolean;
    /** Whether the user has completed the one-time, platform-wide welcome onboarding. */
    onboardingCompleted: boolean;
}

/**
 * Defaults, matching the server's. Used until the preferences have loaded (and
 * if they can't be loaded).
 */
const DEFAULTS: PreferencesData = {
    remoteContentPolicy: { addresses: {}, domains: {} },
    autoMarkSeen: true,
    nestUnderInbox: true,
    folderDragDrop: false,
    onboardingCompleted: false,
};

type PersistResponse = { success: boolean; message?: string };

/**
 * How each preference is saved: through its own `/account/preferences/<key>`
 * route. `label` names it in error messages.
 */
const WRITERS: { [K in keyof PreferencesData]: { label: string; write: (value: PreferencesData[K]) => Promise<PersistResponse> } } = {
    remoteContentPolicy: {
        label: "remote content rules",
        write: async (policy) => await useAPI((api) => api.putAccountPreferencesRemoteContentPolicy({ body: policy })),
    },
    autoMarkSeen: {
        label: "mark as read",
        write: async (enabled) => await useAPI((api) => api.putAccountPreferencesAutoMarkSeen({ body: { enabled } })),
    },
    nestUnderInbox: {
        label: "folder nesting",
        write: async (nestUnderInbox) => await useAPI((api) => api.putAccountPreferencesFolderNesting({ body: { nestUnderInbox } })),
    },
    folderDragDrop: {
        label: "folder drag-and-drop",
        write: async (enabled) => await useAPI((api) => api.putAccountPreferencesFolderDnd({ body: { enabled } })),
    },
    onboardingCompleted: {
        label: "onboarding",
        write: async (completed) => await useAPI((api) => api.putAccountPreferencesOnboarding({ body: { completed } })),
    },
};

function persist<K extends keyof PreferencesData>(key: K, value: PreferencesData[K]) {
    return WRITERS[key].write(value);
}

/**
 * Extracts the lowercase domain part of an email address, or `null` if none.
 */
export function extractDomain(address?: string | null): string | null {
    if (!address) return null;
    const at = address.lastIndexOf('@');
    if (at === -1) return null;
    const domain = address.slice(at + 1).trim().toLowerCase();
    return domain || null;
}

/**
 * All of the user's global (per-user), backend-persisted preferences. Loaded in
 * one request from `/account/preferences`; each preference is still saved
 * through its own `/account/preferences/<key>` route, so only the ones that
 * changed are written.
 */
class PreferencesStore extends ModifiableAbstractStore<PreferencesData, Partial<PreferencesData>> {

    private _autoMarkSeen?: ComputedRef<boolean>;
    private _nestUnderInbox?: ComputedRef<boolean>;
    private _folderDragDrop?: ComputedRef<boolean>;
    private _onboardingCompleted?: ComputedRef<boolean>;
    private _remoteContentPolicy?: ComputedRef<RemoteContentPolicyData | null>;

    constructor() {
        super("preferences", {
            enableAutoFetchIfEmpty: true
        });
    }

    protected override async fetchData() {
        try {
            if (!useAppCookies().sessionToken.get().value) {
                return null;
            }
            const response = await useAPI((api) => api.getAccountPreferences({}));

            if (!response.success) {
                return null;
            }

            const data = response.data;
            return {
                remoteContentPolicy: {
                    addresses: data["remote-content-policy"].addresses ?? {},
                    domains: data["remote-content-policy"].domains ?? {},
                },
                autoMarkSeen: data["auto-mark-seen"].enabled ?? DEFAULTS.autoMarkSeen,
                nestUnderInbox: data["folder-nesting"].nestUnderInbox ?? DEFAULTS.nestUnderInbox,
                folderDragDrop: data["folder-dnd"].enabled ?? DEFAULTS.folderDragDrop,
                onboardingCompleted: data.onboarding.completed ?? DEFAULTS.onboardingCompleted,
            } satisfies PreferencesData;

        } catch (error) {
            console.error("Error fetching preferences:", error);
            return null;
        }
    }

    /**
     * Reactive, synchronously-readable flags. Each falls back to its server
     * default until the preferences have loaded, so e.g. drag-and-drop stays
     * off and auto-mark-as-seen stays on unless the user has changed them.
     */
    public get autoMarkSeen(): ComputedRef<boolean> {
        return this._autoMarkSeen ??= computed(() => this.useRaw().value?.autoMarkSeen ?? DEFAULTS.autoMarkSeen);
    }

    public get nestUnderInbox(): ComputedRef<boolean> {
        return this._nestUnderInbox ??= computed(() => this.useRaw().value?.nestUnderInbox ?? DEFAULTS.nestUnderInbox);
    }

    public get folderDragDrop(): ComputedRef<boolean> {
        return this._folderDragDrop ??= computed(() => this.useRaw().value?.folderDragDrop ?? DEFAULTS.folderDragDrop);
    }

    public get onboardingCompleted(): ComputedRef<boolean> {
        return this._onboardingCompleted ??= computed(() => this.useRaw().value?.onboardingCompleted ?? DEFAULTS.onboardingCompleted);
    }

    /**
     * Synchronously accessible, reactive handle to the (possibly not-yet-loaded)
     * remote content policy. Callers should treat `null` as "no rules yet".
     */
    public get remoteContentPolicy(): ComputedRef<RemoteContentPolicyData | null> {
        return this._remoteContentPolicy ??= computed(() => this.useRaw().value?.remoteContentPolicy ?? null);
    }

    /**
     * Applies the given preferences locally and persists the ones that differ
     * from the current value. The remote content policy is replaced as a whole.
     *
     * Throws if the preferences can't be loaded (diffing or merging against the
     * defaults would overwrite what the server has), and if a write fails —
     * after rolling back the values that weren't saved.
     */
    override async update(updates: Partial<PreferencesData>) {
        await this.apply(() => updates);
    }

    /**
     * Shared by every write. `getUpdates` runs against the loaded preferences
     * with no `await` before they're replaced, so concurrent calls build on
     * each other's changes instead of overwriting them.
     */
    private async apply(getUpdates: (current: PreferencesData) => Partial<PreferencesData>) {
        await this.refreshIfNeeded();
        const state = this.useRaw();
        const previous = state.value;
        if (!previous) {
            throw new Error("Your preferences couldn't be loaded, so nothing was saved. Please try again.");
        }

        // An explicit `undefined` would otherwise replace the current value.
        const updates = Object.fromEntries(
            Object.entries(getUpdates(previous)).filter(([, value]) => value !== undefined)
        ) as Partial<PreferencesData>;

        const merged: PreferencesData = { ...previous, ...updates };
        state.value = merged;

        const changed = (Object.keys(updates) as (keyof PreferencesData)[])
            .filter(key => merged[key] !== previous[key]);

        const failed = (await Promise.all(changed.map(async (key) => {
            const response = await persist(key, merged[key]);
            if (response.success) return null;
            console.error(`Failed to persist ${WRITERS[key].label}:`, response.message);
            return key;
        }))).filter(key => key !== null);

        if (failed.length === 0) return;

        // Undo what wasn't saved, unless a later update has replaced it since.
        const current = state.value;
        if (current) {
            state.value = {
                ...current,
                ...Object.fromEntries(
                    failed.filter(key => current[key] === merged[key]).map(key => [key, previous[key]])
                ),
            };
        }
        throw new Error(`Couldn't save ${failed.map(key => WRITERS[key].label).join(", ")}. Please try again.`);
    }

    // ── Remote content policy ──

    resolveRemoteContent(address?: string | null): ResolvedRemotePolicy {
        const rules = this.useRaw().value?.remoteContentPolicy;
        if (!rules) return 'unset';

        const addr = address?.trim().toLowerCase();
        if (addr && rules.addresses[addr]) {
            return rules.addresses[addr];
        }

        const domain = extractDomain(addr);
        if (domain && rules.domains[domain]) {
            return rules.domains[domain];
        }

        return 'unset';
    }

    /**
     * Replaces the entire remote content policy in one shot (handles adds,
     * edits, and removals together) and persists it.
     */
    async replaceRemoteContentPolicy(data: RemoteContentPolicyData) {
        await this.update({
            remoteContentPolicy: {
                addresses: { ...data.addresses },
                domains: { ...data.domains },
            },
        });
    }

    async setRemoteContentAddressPolicy(address: string, decision: RemoteContentDecision) {
        const addr = address.trim().toLowerCase();
        if (!addr) return;
        await this.mergeRemoteContentPolicy({ addresses: { [addr]: decision } });
    }

    async setRemoteContentDomainPolicy(domain: string, decision: RemoteContentDecision) {
        const d = domain.trim().toLowerCase();
        if (!d) return;
        await this.mergeRemoteContentPolicy({ domains: { [d]: decision } });
    }

    /** Merges the given partial rule maps into the current policy and persists it. */
    private async mergeRemoteContentPolicy(updates: Partial<RemoteContentPolicyData>) {
        await this.apply(({ remoteContentPolicy: policy }) => ({
            remoteContentPolicy: {
                addresses: { ...policy.addresses, ...updates.addresses },
                domains: { ...policy.domains, ...updates.domains },
            },
        }));
    }

}

export function usePreferencesStore() {
    return new PreferencesStore();
}
