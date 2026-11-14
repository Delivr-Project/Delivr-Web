// The first API call can only start once the app's JS has loaded. When the API
// is on another origin, open the connection to it in the meantime, so that call
// doesn't have to wait for DNS, TCP and TLS first.
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook("render:html", (html, { event }) => {
        const { apiUrl, appUrl } = useRuntimeConfig(event).public;

        let apiOrigin: string;
        try {
            apiOrigin = new URL(apiUrl).origin;
            if (apiOrigin === new URL(appUrl).origin) return;
        } catch {
            return;
        }

        // `crossorigin`: API requests carry no cookies, and such requests use a connection of their own
        html.head.push(`<link rel="preconnect" href="${apiOrigin.replace(/"/g, "&quot;")}" crossorigin>`);
    });
});
