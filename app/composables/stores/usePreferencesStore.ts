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
     */
    override async update(updates: Partial<PreferencesData>) {
        await this.refreshIfNeeded();
        const current = this.useRaw();
        const previous = current.value ?? DEFAULTS;

        const merged: PreferencesData = { ...previous, ...updates };
        current.value = merged;

        const writes: Promise<void>[] = [];
        if (updates.remoteContentPolicy !== undefined) {
            writes.push((async () => this.report("remote content policy",
                await useAPI((api) => api.putAccountPreferencesRemoteContentPolicy({ body: merged.remoteContentPolicy }))
            ))());
        }
        if (merged.autoMarkSeen !== previous.autoMarkSeen) {
            writes.push((async () => this.report("auto-mark-seen preference",
                await useAPI((api) => api.putAccountPreferencesAutoMarkSeen({ body: { enabled: merged.autoMarkSeen } }))
            ))());
        }
        if (merged.nestUnderInbox !== previous.nestUnderInbox) {
            writes.push((async () => this.report("folder-nesting preference",
                await useAPI((api) => api.putAccountPreferencesFolderNesting({ body: { nestUnderInbox: merged.nestUnderInbox } }))
            ))());
        }
        if (merged.folderDragDrop !== previous.folderDragDrop) {
            writes.push((async () => this.report("folder drag-and-drop preference",
                await useAPI((api) => api.putAccountPreferencesFolderDnd({ body: { enabled: merged.folderDragDrop } }))
            ))());
        }
        if (merged.onboardingCompleted !== previous.onboardingCompleted) {
            writes.push((async () => this.report("onboarding state",
                await useAPI((api) => api.putAccountPreferencesOnboarding({ body: { completed: merged.onboardingCompleted } }))
            ))());
        }

        await Promise.all(writes);
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
        await this.refreshIfNeeded();
        const policy = this.useRaw().value?.remoteContentPolicy ?? DEFAULTS.remoteContentPolicy;

        await this.update({
            remoteContentPolicy: {
                addresses: { ...policy.addresses, ...updates.addresses },
                domains: { ...policy.domains, ...updates.domains },
            },
        });
    }

    private report(label: string, response: { success: boolean; message?: string }) {
        if (!response.success) {
            console.error(`Failed to persist ${label}:`, response.message);
        }
    }

}

export function usePreferencesStore() {
    return new PreferencesStore();
}
