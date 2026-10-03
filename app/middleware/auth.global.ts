import { useMailAccountsStore } from "~/composables/stores/useMailAccountsStore";
import { useUserInfoStore } from "~/composables/stores/useUserStore";
import { usePreferencesStore } from "~/composables/stores/usePreferencesStore";

export default defineNuxtRouteMiddleware(async (to) => {

    const token = useAppCookies().sessionToken.get().value;

    if (to.path.startsWith('/auth') || to.path.startsWith('/static') || to.path.startsWith('/.well-known') || to.path.startsWith('/favicon.ico') || to.path.startsWith('/robots.txt')) {
        if (!token) {
            return;
        }

        await useUserInfoStore().refreshIfNeeded();
        await useMailAccountsStore().refreshIfNeeded();

        return navigateTo('/');
    }

    if (!token) {
        return navigateTo('/auth/login?url=' + encodeURIComponent(to.fullPath));
    }

    const user = await useUserInfoStore().use();
    // Loads every preference in one request, so pages and the mail view read
    // them from the store without fetching again.
    const preferencesStore = usePreferencesStore();
    await preferencesStore.refreshIfNeeded();

    // First-login gate: users who haven't completed the one-time, platform-wide
    // welcome onboarding are sent there first. Excludes /welcome itself so it
    // never redirect-loops; the welcome page clears the flag when finished.
    if (!preferencesStore.onboardingCompleted.value && to.path !== '/welcome') {
        return navigateTo('/welcome');
    }

    if (to.path.startsWith('/admin')) {
        // Check admin access
        if (!user.value || user.value.role !== 'admin') {
            return navigateTo('/');
        }
    }
});