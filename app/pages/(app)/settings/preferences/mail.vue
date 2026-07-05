<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { useAutoMarkSeenStore } from '~/composables/stores/useAutoMarkSeenStore';

useSeoMeta({
	title: 'Mail Preferences | Delivr',
	description: 'Control how reading mail behaves',
});

const toast = useToast()

// ── Auto-mark-as-read (global preference) ──
const autoMarkSeenStore = useAutoMarkSeenStore();
await autoMarkSeenStore.use();

// Local, staged copy — edits only persist when the user clicks Save.
const state = reactive({
	autoMarkSeen: autoMarkSeenStore.enabled.value,
});

const saving = ref(false)

// Enable Save only when something actually changed.
const isDirty = computed(() => state.autoMarkSeen !== autoMarkSeenStore.enabled.value)

async function onSubmit(_event: FormSubmitEvent<typeof state>) {
	saving.value = true
	try {
		await autoMarkSeenStore.update({ enabled: state.autoMarkSeen })
		toast.add({
			title: 'Preferences saved',
			description: 'Your mail preferences have been updated.',
			icon: 'i-lucide-check',
			color: 'success',
		})
	} catch (error) {
		toast.add({
			title: 'Error',
			description: 'An unexpected error occurred while saving your preferences.',
			icon: 'i-lucide-alert-circle',
			color: 'error',
		})
	} finally {
		saving.value = false
	}
}
</script>

<template>
	<UDashboardPanel id="settings" :ui="{ body: 'lg:py-12 lg:gap-12 w-full lg:max-w-3xl mx-auto' }">
		<template #header>
			<DashboardPageHeader
				title="Mail Preferences"
				icon="i-lucide-mail"
				description="Control how reading mail behaves"
			/>
		</template>

		<template #body>
			<DashboardPageBody>
				<UForm :state="state" @submit="onSubmit" class="flex flex-col gap-12">
					<!-- Header -->
					<div>
						<h2 class="text-xl font-semibold text-white">Mail Preferences</h2>
						<p class="text-sm text-slate-400 mt-1">Control how reading mail behaves</p>
					</div>

					<!-- Mail Preferences Card -->
					<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
						<div class="px-6 py-4 border-b border-slate-800">
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
									<UIcon name="i-lucide-mail-open" class="w-5 h-5 text-sky-400" />
								</div>
								<div>
									<h3 class="font-medium text-white">Reading</h3>
									<p class="text-sm text-slate-400">How messages behave when you open them</p>
								</div>
							</div>
						</div>

						<div class="p-6">
							<UFormField
								name="autoMarkSeen"
								label="Auto-mark as read"
								description="Automatically mark an email as read shortly after you open it."
								class="flex max-sm:flex-col justify-between items-start gap-4"
								:ui='{
									root: "w-full sm:w-auto",
									container: "w-full sm:w-auto",
								}'
							>
								<UCheckbox v-model="state.autoMarkSeen" />
							</UFormField>
						</div>
					</div>

					<!-- Save -->
					<div class="flex justify-end">
						<UButton
							label="Save Changes"
							type="submit"
							color="primary"
							icon="i-lucide-save"
							:loading="saving"
							:disabled="!isDirty"
						/>
					</div>
				</UForm>
			</DashboardPageBody>
		</template>
	</UDashboardPanel>
</template>
