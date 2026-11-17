<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { GetAccountPasskeysResponses } from '~/api-client/types.gen'
import { PasskeyUtils } from '~/utils/auth/passkey'

type Passkey = GetAccountPasskeysResponses[200]['data'][number]

const passkeyName = z.string('Name is required').trim().min(1, 'Name is required').max(100, 'Must be at most 100 characters')

const addSchema = z.object({
	name: passkeyName,
	current_password: z.string('Current Password is required').min(1, 'Current Password is required')
})

const renameSchema = z.object({
	name: passkeyName
})

type AddSchema = z.output<typeof addSchema>
type RenameSchema = z.output<typeof renameSchema>

const toast = useToast()

// Lazy, so the page shows up without waiting for it. `undefined` while it loads, `null` when it failed.
const { data: passkeys, refresh } = await useAPILazyAsyncData<Passkey[] | null>('account-passkeys', async () => {
	const result = await useAPI((api) => api.getAccountPasskeys({}))
	if (!result.success) {
		toast.add({ title: 'Failed to load passkeys', description: result.message, icon: 'i-lucide-alert-circle', color: 'error' })
		return null
	}
	return result.data
})

const supported = ref(true)
onMounted(() => {
	supported.value = PasskeyUtils.isSupported()
})

const addOpen = ref(false)
const addLoading = ref(false)
const addForm = reactive({ name: '', current_password: '' })

const renameOpen = ref(false)
const renameLoading = ref(false)
const renameForm = reactive({ id: '', name: '' })

const deleteOpen = ref(false)
const deleteTarget = ref<Passkey | null>(null)
const deleteWarning = computed(() => `You can't sign in with "${deleteTarget.value?.name ?? ''}" once it is removed.`)

function formatDate(timestamp: number | null) {
	return timestamp ? new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never'
}

function showError(description: string) {
	toast.add({ title: 'Error', description, icon: 'i-lucide-alert-circle', color: 'error' })
}

function openAdd() {
	addForm.name = PasskeyUtils.suggestName(navigator.userAgent)
	addForm.current_password = ''
	addOpen.value = true
}

async function addPasskey(event: FormSubmitEvent<AddSchema>) {
	const { name, current_password } = event.data

	addLoading.value = true
	try {
		const options = await useAPI((api) => api.postAccountPasskeysOptions({
			body: { current_password }
		}))

		if (!options.success) {
			showError(options.message || 'The passkey could not be added.')
			return
		}

		const response = await PasskeyUtils.create(options.data.options)

		const result = await useAPI((api) => api.postAccountPasskeys({
			body: { name, response }
		}))

		if (!result.success) {
			showError(result.message || 'The passkey could not be added.')
			return
		}

		addOpen.value = false
		await refresh()

		toast.add({
			title: 'Passkey added',
			description: `You can now sign in with "${result.data.name}".`,
			icon: 'i-lucide-check',
			color: 'success'
		})
	} catch (error) {
		if (!PasskeyUtils.isCancelled(error)) {
			showError(PasskeyUtils.describeError(error))
		}
	} finally {
		addForm.current_password = ''
		addLoading.value = false
	}
}

function openRename(passkey: Passkey) {
	renameForm.id = passkey.id
	renameForm.name = passkey.name
	renameOpen.value = true
}

async function renamePasskey(event: FormSubmitEvent<RenameSchema>) {
	renameLoading.value = true
	try {
		const result = await useAPI((api) => api.putAccountPasskeysByPasskeyId({
			path: { passkeyID: renameForm.id },
			body: { name: event.data.name }
		}))

		if (!result.success) {
			showError(result.message || 'The passkey could not be renamed.')
			return
		}

		renameOpen.value = false
		await refresh()
	} finally {
		renameLoading.value = false
	}
}

function openDelete(passkey: Passkey) {
	deleteTarget.value = passkey
	deleteOpen.value = true
}

async function deletePasskey() {
	const passkey = deleteTarget.value
	if (!passkey) return

	const result = await useAPI((api) => api.deleteAccountPasskeysByPasskeyId({
		path: { passkeyID: passkey.id }
	}))

	if (!result.success) {
		showError(result.message || 'The passkey could not be removed.')
		throw new Error(result.message || 'The passkey could not be removed.')
	}

	await refresh()
	toast.add({ title: 'Passkey removed', description: `"${passkey.name}" was removed.`, icon: 'i-lucide-check', color: 'success' })
}
</script>

<template>
	<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
		<div class="px-6 py-4 border-b border-slate-800">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
					<UIcon name="i-lucide-fingerprint" class="w-5 h-5 text-sky-400" />
				</div>
				<div class="flex-1">
					<h3 class="font-medium text-white">Passkeys</h3>
					<p class="text-sm text-slate-400">Sign in with your fingerprint, face or device PIN instead of a password</p>
				</div>
				<UButton
					label="Add passkey"
					color="primary"
					icon="i-lucide-plus"
					:disabled="!supported"
					@click="openAdd"
				/>
			</div>
		</div>

		<div class="p-6">
			<p v-if="!supported" class="text-sm text-amber-400 mb-4">
				This browser doesn't support passkeys.
			</p>

			<div v-if="passkeys === undefined" class="space-y-2">
				<USkeleton class="h-4 w-3/4" />
				<USkeleton class="h-4 w-1/2" />
			</div>

			<p v-else-if="passkeys === null" class="text-sm text-slate-400">
				Your passkeys couldn't be loaded. Reload the page to try again.
			</p>

			<p v-else-if="!passkeys.length" class="text-sm text-slate-400">
				No passkeys yet.
			</p>

			<ul v-else class="divide-y divide-slate-800">
				<li v-for="passkey in passkeys" :key="passkey.id" class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
					<UIcon name="i-lucide-key-round" class="w-5 h-5 text-slate-400 shrink-0" />
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<span class="font-medium text-white truncate">{{ passkey.name }}</span>
							<UBadge v-if="passkey.backed_up" label="Synced" color="neutral" variant="subtle" size="sm" />
						</div>
						<p class="text-xs text-slate-400 mt-0.5">
							Added {{ formatDate(passkey.created_at) }} · Last used {{ formatDate(passkey.last_used_at) }}
						</p>
					</div>
					<UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" aria-label="Rename passkey" @click="openRename(passkey)" />
					<UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" aria-label="Remove passkey" @click="openDelete(passkey)" />
				</li>
			</ul>
		</div>

		<DashboardModal
			v-model:open="addOpen"
			title="Add passkey"
			icon="i-lucide-fingerprint"
			icon-color="sky"
		>
			<UForm :schema="addSchema" :state="addForm" class="space-y-4" @submit="addPasskey">
				<p class="text-sm text-slate-400">
					Your browser will ask you to create the passkey on this device, a phone or a security key.
				</p>

				<UFormField name="name" label="Name" description="Helps you recognize it later." required>
					<UInput v-model="addForm.name" maxlength="100" class="w-full" />
				</UFormField>

				<UFormField name="current_password" label="Current Password" required>
					<UInput v-model="addForm.current_password" type="password" placeholder="Current password" autocomplete="current-password" class="w-full" />
				</UFormField>

				<div class="flex justify-end gap-3 pt-2">
					<UButton label="Cancel" color="neutral" variant="ghost" @click="addOpen = false" />
					<UButton type="submit" label="Continue" color="primary" :loading="addLoading" />
				</div>
			</UForm>
		</DashboardModal>

		<DashboardModal
			v-model:open="renameOpen"
			title="Rename passkey"
			icon="i-lucide-pencil"
			icon-color="sky"
		>
			<UForm :schema="renameSchema" :state="renameForm" class="space-y-4" @submit="renamePasskey">
				<UFormField name="name" label="Name" required>
					<UInput v-model="renameForm.name" maxlength="100" class="w-full" autofocus />
				</UFormField>

				<div class="flex justify-end gap-3 pt-2">
					<UButton label="Cancel" color="neutral" variant="ghost" @click="renameOpen = false" />
					<UButton type="submit" label="Save" color="primary" :loading="renameLoading" />
				</div>
			</UForm>
		</DashboardModal>

		<DashboardDeleteModal
			v-model:open="deleteOpen"
			title="Remove passkey"
			:warning-text="deleteWarning"
			:on-delete="deletePasskey"
		/>
	</div>
</template>
