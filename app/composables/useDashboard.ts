import { createSharedComposable } from '@vueuse/core'

const _useDashboard = () => {
    const route = useRoute()
    const router = useRouter()
    const isNotificationsSlideoverOpen = ref(false)
    const isMailSearchOpen = ref(false)

    defineShortcuts({
        'g-h': () => navigateTo('/'),
        'g-i': () => navigateTo('/inbox'),
        'g-s': () => navigateTo('/settings'),
        'n': () => isNotificationsSlideoverOpen.value = !isNotificationsSlideoverOpen.value
    })

    watch(() => route.fullPath, () => {
        isNotificationsSlideoverOpen.value = false
        isMailSearchOpen.value = false
    })

    return {
        isNotificationsSlideoverOpen,
        isMailSearchOpen
    }
}

export const useDashboard = createSharedComposable(_useDashboard)
