import { useLocalStorage } from '@vueuse/core'
import { toValue, type MaybeRefOrGetter } from 'vue'

const KEY_PREFIX = 'delivr:mail-search:recent'

/** Before searches were kept per user, everyone on a browser shared this key. */
const LEGACY_KEY = KEY_PREFIX

function storage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}

/**
 * The recent mail searches of one user. They are stored per user, so whoever logs
 * in next on the same browser doesn't see them, and dropped on logout
 * ({@link clearRecentMailSearches}).
 */
export function useRecentMailSearches(userId: MaybeRefOrGetter<number | null | undefined>) {
    storage()?.removeItem(LEGACY_KEY)
    return useLocalStorage<string[]>(() => `${KEY_PREFIX}:${toValue(userId) ?? 'none'}`, [])
}

/** Forget every user's recent searches on this browser (on logout). */
export function clearRecentMailSearches() {
    const store = storage()
    if (!store) return
    const keys = Array.from({ length: store.length }, (_, i) => store.key(i))
        .filter((key): key is string => key !== null && (key === LEGACY_KEY || key.startsWith(`${KEY_PREFIX}:`)))
    for (const key of keys) store.removeItem(key)
}
