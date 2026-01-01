// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	modules: ['@nuxt/ui', '@vite-pwa/nuxt'],

	colorMode: {
		preference: 'dark',
		fallback: 'dark',
		classSuffix: ''
	},

	ssr: true,

	css: [
		'~/assets/css/main.css',
	],

	nitro: {
		preset: 'bun',

		devProxy: process.env.USE_DEV_PROXY === "true" ? {
			"/api/proxy": {
				target: process.env.DEV_PROXY_TARGET || "https://api.delivr.is-on.net",
				changeOrigin: true
			}
		} : {}
	},

	runtimeConfig: {
		public: {
			apiUrl: process.env.DELIVR_API_URL || 'http://localhost:14123',
			appUrl: process.env.DELIVR_APP_URL || 'http://localhost:14128',
			isSignupEnabled: process.env.DELIVR_ENABLE_SIGNUP === 'true' ? true : false,
		}
	},

	vite: {
		server: {
			allowedHosts: [
				"delivr-website-test.tun.is-on.net"
			]

		}
	},

	routeRules: {
		"/**": { ssr: false }
	},

	pwa: {
        registerType: 'autoUpdate',
        manifest: {
            name: 'Delivr',
            short_name: 'Delivr',
            start_url: '/',
            description: 'Delivr - The Mail Client that actually delivers.',

            display: 'standalone',
            orientation: 'portrait',

            theme_color: '#ffffff',
            background_color: '#18181a',
        }
    }

});