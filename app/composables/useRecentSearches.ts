import { useLocalStorage } from '@vueuse/core'

const STORAGE_KEY = 'delivr:mail-search:recent'

export function useRecentMailSearches() {
    return useLocalStorage<string[]>(STORAGE_KEY, [])
}