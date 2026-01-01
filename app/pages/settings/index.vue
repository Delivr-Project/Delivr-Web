<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { UserStore } from '~/utils/stores/userStore'

const profileSchema = z.object({
	username: z.string().trim()
		.min(5, 'Must be at least 5 characters')
		.max(30, 'Must be at most 30 characters')
		.regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric characters and underscores are allowed'),
	display_name: z.string().trim()
		.max(50, 'Must be at most 50 characters')
		.optional(),
	email: z.email('Invalid email').trim(),
})

const userInfo = await UserStore.use()
const loading = ref(false)

if (!UserStore.isValid(userInfo)) {
	throw new Error('User not authenticated but trying to access Profile Settings')
}

type ProfileSchema = z.output<typeof profileSchema>

const profile = reactive<Partial<ProfileSchema>>({
	username: userInfo.value.username,
	display_name: userInfo.value.display_name || '',
	email: userInfo.value.email,
})

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<ProfileSchema>) {
	loading.value = true
	
	try {
		const result = await useAPI((api) => api.putAccount({
			body: {
				username: event.data.username,
				display_name: event.data.display_name || undefined,
				email: event.data.email
			}
		}))

		if (result.success) {
			toast.add({
				title: 'Profile updated',
				description: 'Your profile has been successfully updated.',
				icon: 'i-lucide-check',
				color: 'success'
			});

			UserStore.update({
				username: event.data.username,
				display_name: event.data.display_name || undefined,
				email: event.data.email
			});

		} else {
			toast.add({
				title: 'Error',
				description: result.message || 'An error occurred while updating your profile.',
				icon: 'i-lucide-alert-circle',
				color: 'error'
			})
		}
	} catch (error) {
		toast.add({
			title: 'Error',
			description: 'An unexpected error occurred.',
			icon: 'i-lucide-alert-circle',
			color: 'error'
		})
	} finally {
		loading.value = false
	}
}
</script>

<template>
	<div class="space-y-6">
		<!-- Header -->
		<div>
			<h2 class="text-xl font-semibold text-white">Profile Settings</h2>
			<p class="text-sm text-slate-400 mt-1">Manage your public profile information</p>
		</div>

		<!-- Profile Card -->
		<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
			<div class="px-6 py-4 border-b border-slate-800">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
						<UIcon name="i-lucide-user" class="w-5 h-5 text-sky-400" />
					</div>
					<div>
						<h3 class="font-medium text-white">Profile Information</h3>
						<p class="text-sm text-slate-400">Update your account profile details</p>
					</div>
				</div>
			</div>
			
			<div class="p-6">
				<UForm id="settings" :schema="profileSchema" :state="profile" @submit="onSubmit" class="divide-y divide-slate-800">
					<UFormField 
						name="username" 
						label="Username"
						description="Your unique username for logging in."
						required
						class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
						:ui='{
							root: "w-full sm:w-auto",
							container: "w-full sm:w-auto",
						}'
					>
						<UInput v-model="profile.username" placeholder="Enter username" class="w-full sm:w-96" />
					</UFormField>

					<UFormField 
						name="display_name" 
						label="Display Name"
						description="Shown publicly. Leave empty to use username."
						class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
						:ui='{
							root: "w-full sm:w-auto",
							container: "w-full sm:w-auto",
						}'
					>
						<UInput v-model="profile.display_name" placeholder="Enter display name" class="w-full sm:w-96" />
					</UFormField>

					<UFormField 
						name="email" 
						label="Email"
						description="Used to sign in and for notifications."
						required
						class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
						:ui='{
							root: "w-full sm:w-auto",
							container: "w-full sm:w-auto",
						}'
					>
						<UInput v-model="profile.email" type="email" placeholder="Enter email" class="w-full sm:w-96" />
					</UFormField>

					<div class="pt-4">
						<UButton 
							label="Save Changes" 
							color="primary" 
							type="submit" 
							:loading="loading"
							icon="i-lucide-save"
						/>
					</div>
				</UForm>
			</div>
		</div>

		<!-- Account Info Card -->
		<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-6">
			<div class="flex items-center gap-4">
				<div class="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
					<span class="text-xl font-bold text-white">{{ profile.display_name?.charAt(0) || profile.username?.charAt(0) || '?' }}</span>
				</div>
				<div>
					<p class="font-medium text-white">{{ profile.display_name || profile.username }}</p>
					<p class="text-sm text-slate-400">@{{ profile.username }}</p>
				</div>
				<div class="ml-auto">
					<UBadge 
						:label="userInfo.role" 
						:color="userInfo.role === 'admin' ? 'error' : userInfo.role === 'developer' ? 'primary' : 'neutral'"
						size="sm"
					/>
				</div>
			</div>
		</div>
	</div>
</template>
