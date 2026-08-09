import { useMailAccountsStore } from "~/composables/stores/useMailAccountsStore";
import { useUserInfoStore } from "~/composables/stores/useUserStore";
import { useRemoteContentPolicyStore } from "~/composables/stores/useRemoteContentPolicyStore";
import { useOnboardingStore } from "~/composables/stores/useOnboardingStore";

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
    await useRemoteContentPolicyStore().refreshIfNeeded();

    // First-login gate: users who haven't completed the one-time, platform-wide
    // welcome onboarding are sent there first. Excludes /welcome itself so it
    // never redirect-loops; the welcome page clears the flag when finished.
    const onboardingStore = useOnboardingStore();
    await onboardingStore.refreshIfNeeded();
    if (!onboardingStore.completed.value && to.path !== '/welcome') {
        return navigateTo('/welcome');
    }

    if (to.path.startsWith('/admin')) {
        // Check admin access
        if (!user.value || user.value.role !== 'admin') {
            return navigateTo('/');
        }
    }
});