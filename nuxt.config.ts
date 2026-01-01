// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	modules: ['@nuxt/ui'],

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
	}
});