import { useLocalStorage } from '@vueuse/core'

export type MailViewMode = 'list' | 'split'

const STORAGE_KEY = 'delivr:mail-view-mode'

export function useMailViewMode() {
    return useLocalStorage<MailViewMode>(STORAGE_KEY, 'split')
}