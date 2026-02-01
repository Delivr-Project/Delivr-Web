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
	
	app: {
		head: {
			// 1. Manually add the manifest link
			link: [
				{ rel: 'manifest', href: '/manifest.webmanifest' }, 
			],
			script: [
				{
				// We use innerHTML to insert raw JS
				innerHTML: `
					if ('serviceWorker' in navigator) {
					window.addEventListener('load', () => {
						navigator.serviceWorker.register('/sw.js', { scope: '/' })
						.then(registration => {
							console.log('SW registered: ', registration);
						})
						.catch(registrationError => {
							console.log('SW registration failed: ', registrationError);
						});
					});
					}
				`,
				type: 'text/javascript'
				}
			]
		}
	},

	pwa: {
        registerType: 'autoUpdate',
		injectRegister: false,
        manifest: {
            name: 'Delivr',
            short_name: 'Delivr',
            start_url: '/',
            description: 'Delivr - The Mail Client that actually delivers.',

			id: "dev.delivr.app",

			icons: [
				{
					src: "/static/logo/icon.png",
					sizes: "1024x1024",
					type: "image/png"
				},
			],

            display: 'standalone',
            orientation: 'portrait',

			lang: 'en',

            theme_color: '#ffffff',
            background_color: '#000000',
        }
    }

});