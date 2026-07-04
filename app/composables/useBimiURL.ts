import { useAPI } from '~/composables/useAPI';

/**
 * Per-process cache of resolved BIMI logo URLs keyed by `<selector>|<domain>`.
 * BIMI records are domain-public (not user-specific), so sharing the cache
 * across requests/users is safe and avoids repeated lookups for common senders.
 */
const bimiCache = new Map<string, string | null>();

/**
 * Resolve the BIMI (Brand Indicators for Message Identification) brand-logo URL
 * for a sender domain, or `null` when the domain publishes no usable record.
 *
 * The returned URL points directly at the brand's SVG logo and can be used as an
 * `<img>`/avatar `src`, mirroring {@link useGravatarURL}. The lookup itself is
 * performed by the Delivr API (a browser cannot query DNS TXT records).
 *
 * @param domain The sender domain, e.g. `example.com`.
 * @param selector The BIMI selector; defaults to `default`.
 */
export async function useBimiURL(domain: string, selector = 'default'): Promise<string | null> {

    const normalizedDomain = domain.trim().toLowerCase();
    if (!normalizedDomain) return null;

    const normalizedSelector = (selector || 'default').trim().toLowerCase();
    const cacheKey = `${normalizedSelector}|${normalizedDomain}`;

    if (bimiCache.has(cacheKey)) {
        return bimiCache.get(cacheKey) ?? null;
    }

    // A BIMI miss must never bounce the user to the login page, so disable the
    // auth redirect — an avatar lookup is not a page-level navigation.
    const response = await useAPI(api =>
        api.getBimiByDomain({
            path: { domain: normalizedDomain },
            query: { selector: normalizedSelector },
        }), true);

    const logoUrl = response.success === true && response.data?.logoUrl
        ? response.data.logoUrl
        : null;

    bimiCache.set(cacheKey, logoUrl);
    return logoUrl;
}
