import { UserStore } from "~/utils/stores/userStore";

export default defineNuxtRouteMiddleware(async(to) => {

    const session_token = useAppCookies().sessionToken.get().value;

    if (to.path.startsWith('/auth')) {
        if (!session_token) {
            return;
        }

        await UserStore.fetchAndSetIfNeeded();

        return navigateTo('/');
    }

    if (!session_token) {
        return navigateTo('/auth/login?url=' + encodeURIComponent(to.fullPath));
    }

    const user = await UserStore.use();

    if (to.path.startsWith('/admin')) {
        // Check admin access
        if (!user.value || user.value.role !== 'admin') {
            navigateTo('/')
        }
    }
});