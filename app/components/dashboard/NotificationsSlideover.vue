<script setup lang="ts">
import { formatTimeAgo } from '@vueuse/core'
import type { Notification } from '~/utils/types'

const { isNotificationsSlideoverOpen } = useDashboard()

// const { data: notifications } = await useFetch<Notification[]>('/api/notifications')
const notifications: Notification[] = [
	{
		id: 1,
		sender: {
			id: 1,
			name: 'Lukas Pohl',
			email: 'l.pohl@crossover.info',

		},
		body: 'Kannst du mir noch den Input für Tag 2 schicken?',
		date: new Date().toISOString(),
		unread: true,
	},
	{
		id: 2,
		sender: {
			id: 2,
			name: 'Raphael Below',
			email: 'r.below@crossover.info'
		},
		body: 'Linus Fischer hat leider für die Freizeit abgesagt.',
		date: new Date(Date.now() - 3600 * 1000).toISOString(),
		unread: false,
	},
	{
		id: 3,
		sender: {
			id: 3,
			name: 'Berend Tillmanns',
			email: 'b.tillmanns@crossover.info'
		},
		body: 'Bitte denk daran, die Teilnehmerliste zu aktualisieren.',
		date: new Date(Date.now() - 7200 * 1000).toISOString(),
		unread: true,
	},
]

</script>

<template>
    <USlideover v-model:open="isNotificationsSlideoverOpen" title="Notifications">
        <template #body>
            <NuxtLink v-for="notification in notifications" :key="notification.id" :to="`/inbox?id=${notification.id}`"
                class="px-3 py-2.5 rounded-md hover:bg-elevated/50 flex items-center gap-3 relative -mx-3 first:-mt-3 last:-mb-3">
                <UChip color="error" :show="!!notification.unread" inset>
                    <UAvatar v-bind="notification.sender.avatar" :alt="notification.sender.name" size="md" />
                </UChip>

                <div class="text-sm flex-1">
                    <p class="flex items-center justify-between">
                        <span class="text-highlighted font-medium">{{ notification.sender.name }}</span>

                        <time :datetime="notification.date" class="text-muted text-xs"
                            v-text="formatTimeAgo(new Date(notification.date))" />
                    </p>

                    <p class="text-dimmed">
                        {{ notification.body }}
                    </p>
                </div>
            </NuxtLink>
        </template>
    </USlideover>
</template>