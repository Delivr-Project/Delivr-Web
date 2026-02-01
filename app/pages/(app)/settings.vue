<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

useSeoMeta({
    title: 'Settings | Delivr',
    description: 'Manage your account settings'
})

const links = [[{
	label: 'General',
	icon: 'i-lucide-user',
	to: '/settings',
	exact: true
}, {
	label: 'Security',
	icon: 'i-lucide-shield',
	to: '/settings/security'
}]] satisfies NavigationMenuItem[][]

</script>

<template>
	<UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
		<template #header>
			<UDashboardNavbar title="Settings" icon="i-lucide-settings">
            </UDashboardNavbar>

			<UDashboardToolbar>
				<!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
				<UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
			</UDashboardToolbar>
		</template>

		<template #body>
			<div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-3xl mx-auto">
				<NuxtPage />
			</div>
		</template>
	</UDashboardPanel>
</template>
