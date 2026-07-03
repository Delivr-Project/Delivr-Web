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
 * Account-scoped, backend-persisted policy for loading remote content (images,
 * background resources) in HTML emails. Backed by `/account/preferences/remote-content-policy`.
 */
class RemoteContentPolicyStore extends ModifiableAbstractStore<RemoteContentPolicyData, Partial<RemoteContentPolicyData>> {

    constructor() {
        super("remoteContentPolicy", {
            enableAutoFetchIfEmpty: true
        });
    }

    protected override async fetchData() {
        try {
            if (!useAppCookies().sessionToken.get().value) {
                return null;
            }
            const response = await useAPI((api) => api.getAccountPreferencesRemoteContentPolicy({}));

            if (!response.success) {
                return null;
            }

            return {
                addresses: response.data.addresses ?? {},
                domains: response.data.domains ?? {}
            } satisfies RemoteContentPolicyData;

        } catch (error) {
            console.error("Error fetching remote content policy:", error);
            return null;
        }
    }

    /**
     * Synchronously accessible, reactive handle to the (possibly not-yet-loaded)
     * policy state. Safe to read before `use()`/`refreshIfNeeded()` resolves —
     * callers should treat `null` the same as "no rules yet".
     */
    public get current(): Readonly<Ref<RemoteContentPolicyData | null>> {
        return this.useRaw();
    }

    /** Merges the given partial rule maps into the current policy and persists it. */
    override async update(updates: Partial<RemoteContentPolicyData>) {
        await this.refreshIfNeeded();
        const current = this.useRaw();

        const merged: RemoteContentPolicyData = {
            addresses: { ...(current.value?.addresses ?? {}), ...(updates.addresses ?? {}) },
            domains: { ...(current.value?.domains ?? {}), ...(updates.domains ?? {}) },
        };

        current.value = merged;
        await this.persist(merged);
    }

    resolve(address?: string | null): ResolvedRemotePolicy {
        const rules = this.useRaw().value;
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

    async setAddressPolicy(address: string, decision: RemoteContentDecision) {
        const addr = address.trim().toLowerCase();
        if (!addr) return;
        await this.update({ addresses: { [addr]: decision } });
    }

    async setDomainPolicy(domain: string, decision: RemoteContentDecision) {
        const d = domain.trim().toLowerCase();
        if (!d) return;
        await this.update({ domains: { [d]: decision } });
    }

    async clearAddress(address: string) {
        await this.refreshIfNeeded();
        const current = this.useRaw();
        const addr = address.trim().toLowerCase();
        if (!current.value || !(addr in current.value.addresses)) return;

        const { [addr]: _removed, ...rest } = current.value.addresses;
        const updated = { ...current.value, addresses: rest };
        current.value = updated;
        await this.persist(updated);
    }

    async clearDomain(domain: string) {
        await this.refreshIfNeeded();
        const current = this.useRaw();
        const d = domain.trim().toLowerCase();
        if (!current.value || !(d in current.value.domains)) return;

        const { [d]: _removed, ...rest } = current.value.domains;
        const updated = { ...current.value, domains: rest };
        current.value = updated;
        await this.persist(updated);
    }

    private async persist(data: RemoteContentPolicyData) {
        const response = await useAPI((api) => api.putAccountPreferencesRemoteContentPolicy({ body: data }));
        if (!response.success) {
            console.error("Failed to persist remote content policy:", response.message);
        }
    }

}

export function useRemoteContentPolicyStore() {
    return new RemoteContentPolicyStore();
}
