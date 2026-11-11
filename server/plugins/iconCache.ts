// @nuxt/icon's cached handler only sends `s-maxage` (for proxies), so browsers
// re-check runtime-loaded icons on every reload. Let them keep them for a day.
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook("beforeResponse", (event) => {
        if (event.path.startsWith("/api/_nuxt_icon/")) {
            setResponseHeader(event, "cache-control", "public, max-age=86400, stale-while-revalidate=604800");
        }
    });
});
