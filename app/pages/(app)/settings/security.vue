<script setup lang="ts">
import * as z from 'zod'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import { UserStore } from '~/utils/stores/userStore'

const toast = useToast()
const overlay = useOverlay()

const passwordLoading = ref(false)
const deleteLoading = ref(false)
const deleteConfirmOpen = ref(false)
const deleteConfirmText = ref('')

const passwordSchema = z.object({
	current_password: z.string('Current Password is required').trim().min(1, 'Current Password is required'),
	new_password: z.string('Password is required').trim()
		.min(8, 'Must be at least 8 characters')
		.max(50, 'Must be at most 50 characters')
		.regex(/[A-Z]/, 'Must contain at least one uppercase letter')
		.regex(/[a-z]/, 'Must contain at least one lowercase letter')
		.regex(/[0-9]/, 'Must contain at least one number')
		.regex(/[\W_]/, 'Must contain at least one special character'),
	confirm_password: z.string('Confirm Password is required').trim().min(1, 'Confirm Password is required')
})

type PasswordSchema = z.output<typeof passwordSchema>

const password = reactive<Partial<PasswordSchema>>({
	current_password: undefined,
	new_password: undefined,
	confirm_password: undefined
});

const validate = (state: Partial<PasswordSchema>): FormError[] => {
	const errors: FormError[] = []
	if (state.current_password && state.new_password && state.current_password === state.new_password) {
		errors.push({ name: 'new_password', message: 'New password must be different from current password' })
	}
	if (state.new_password && state.confirm_password && state.new_password !== state.confirm_password) {
		errors.push({ name: 'confirm_password', message: 'Passwords do not match' })
	}
	return errors
}

async function onPasswordSubmit(event: FormSubmitEvent<PasswordSchema>) {
	passwordLoading.value = true

	try {
		const result = await useAPI((api) => api.putAccountPassword({
			body: {
				current_password: event.data.current_password,
				new_password: event.data.new_password
			}
		}))

		if (result.success) {
			toast.add({
				title: 'Password updated',
				description: 'Your password has been successfully updated. Please log in again.',
				icon: 'i-lucide-check',
				color: 'success'
			})

			UserStore.clear()
			useAppCookies().sessionToken.set(null)
			navigateTo('/auth/login')
		} else {
			toast.add({
				title: 'Error',
				description: result.message || 'An error occurred while updating your password.',
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
		passwordLoading.value = false
	}
}

async function onDeleteAccount() {
	if (deleteConfirmText.value !== 'DELETE') {
		toast.add({
			title: 'Confirmation required',
			description: 'Please type DELETE to confirm account deletion.',
			icon: 'i-lucide-alert-triangle',
			color: 'warning'
		})
		return
	}

	deleteLoading.value = true

	try {
		const result = await useAPI((api) => api.deleteAccount({}))

		if (result.success) {
			toast.add({
				title: 'Account deleted',
				description: 'Your account has been permanently deleted.',
				icon: 'i-lucide-check',
				color: 'success'
			})

			UserStore.clear()
			useAppCookies().sessionToken.set(null)
			navigateTo('/')
		} else {
			toast.add({
				title: 'Error',
				description: result.message || 'An error occurred while deleting your account.',
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
		deleteLoading.value = false
		deleteConfirmOpen.value = false
	}
}
</script>

<template>
	<div class="space-y-6">
		<!-- Header -->
		<div>
			<h2 class="text-xl font-semibold text-white">Security Settings</h2>
			<p class="text-sm text-slate-400 mt-1">Manage your password and account security</p>
		</div>

		<!-- Password Card -->
		<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
			<div class="px-6 py-4 border-b border-slate-800">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
						<UIcon name="i-lucide-key-round" class="w-5 h-5 text-sky-400" />
					</div>
					<div>
						<h3 class="font-medium text-white">Change Password</h3>
						<p class="text-sm text-slate-400">Update your password to keep your account secure</p>
					</div>
				</div>
			</div>
			
			<div class="p-6">
				<UForm 
					:schema="passwordSchema" 
					:state="password" 
					:validate="validate" 
					@submit="onPasswordSubmit" 
					class="divide-y divide-slate-800"
				>
					<UFormField 
						name="current_password" 
						label="Current Password" 
						description="Enter your current password to verify."
						required
						class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
						:ui='{
							root: "w-full sm:w-auto",
							container: "w-full sm:w-auto",
						}'
					>
						<UInput v-model="password.current_password" type="password" placeholder="Current password" class="w-full sm:w-96" />
					</UFormField>

					<UFormField 
						name="new_password" 
						label="New Password" 
						description="Min. 8 chars with uppercase, lowercase, number & special char."
						required
						class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
						:ui='{
							root: "w-full sm:w-auto",
							container: "w-full sm:w-auto",
						}'
					>
						<UInput v-model="password.new_password" type="password" placeholder="New password" class="w-full sm:w-96" />
					</UFormField>

					<UFormField 
						name="confirm_password" 
						label="Confirm Password" 
						description="Re-enter your new password."
						required
						class="flex max-sm:flex-col justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
						:ui='{
							root: "w-full sm:w-auto",
							container: "w-full sm:w-auto",
						}'
					>
						<UInput v-model="password.confirm_password" type="password" placeholder="Confirm password" class="w-full sm:w-96" />
					</UFormField>

					<div class="pt-4">
						<UButton 
							label="Update Password" 
							type="submit" 
							color="primary"
							:loading="passwordLoading"
							icon="i-lucide-lock"
						/>
					</div>
				</UForm>
			</div>
		</div>

		<!-- Danger Zone Card -->
		<div class="rounded-xl border border-red-900/50 bg-red-950/20 backdrop-blur-sm overflow-hidden">
			<div class="px-6 py-4 border-b border-red-900/50">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
						<UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-red-400" />
					</div>
					<div>
						<h3 class="font-medium text-red-400">Danger Zone</h3>
						<p class="text-sm text-slate-400">Irreversible and destructive actions</p>
					</div>
				</div>
			</div>
			
			<div class="p-6">
				<div class="flex flex-col md:flex-row md:items-center gap-4">
					<div class="flex-1">
						<h4 class="font-medium text-white">Delete Account</h4>
						<p class="text-sm text-slate-400 mt-1">
							Permanently delete your account and all associated data. This action cannot be undone.
						</p>
					</div>
					<UButton 
						label="Delete Account" 
						color="error" 
						variant="soft"
						icon="i-lucide-trash-2"
						@click="deleteConfirmOpen = true"
					/>
				</div>
			</div>
		</div>

		<!-- Delete Confirmation Modal -->
		<DashboardModal
			v-model:open="deleteConfirmOpen"
			title="Delete Account"
			description="This action is permanent"
			icon="i-lucide-alert-triangle"
			icon-color="error"
		>
			<div class="space-y-4">
				<div class="p-4 rounded-lg bg-red-950/50 border border-red-900/50">
					<p class="text-sm text-red-300">
						<strong>Warning:</strong> All your data including packages, releases, and account information will be permanently deleted. This action cannot be reversed.
					</p>
				</div>

				<div>
					<label class="block text-sm font-medium text-slate-300 mb-2">
						Type <span class="text-red-400">DELETE</span> to confirm
					</label>
					<UInput 
						v-model="deleteConfirmText" 
						type="text" 
						placeholder="Type DELETE"
						class="w-full"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<UButton 
						label="Cancel" 
						color="neutral" 
						variant="ghost"
						@click="deleteConfirmOpen = false; deleteConfirmText = ''"
					/>
					<UButton 
						label="Delete Account" 
						color="error"
						:loading="deleteLoading"
						:disabled="deleteConfirmText !== 'DELETE'"
						icon="i-lucide-trash-2"
						@click="onDeleteAccount"
					/>
				</div>
			</div>
		</DashboardModal>
	</div>
</template>
