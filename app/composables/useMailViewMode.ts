import { useLocalStorage } from '@vueuse/core'

export type MailViewMode = 'list' | 'split'

const STORAGE_KEY = 'delivr:mail-view-mode'

export function useMailViewMode() {
    return useLocalStorage<MailViewMode>(STORAGE_KEY, 'split')
}

export function useEffectiveMailViewMode() {
    const route = useRoute()
    const stored = useMailViewMode()
    return computed<MailViewMode>(() => {
        const q = route.query.view
        if (q === 'split' || q === 'list') return q
        return stored.value
    })
}
