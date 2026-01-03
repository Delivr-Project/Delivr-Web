import type { FormErrorEvent } from "@nuxt/ui"

export async function useDefaultOnFormError() {
    return async function onError(event: FormErrorEvent) {
        if (event?.errors?.[0]?.id) {
            const element = document.getElementById(event.errors[0].id)
            element?.focus()
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }
}
