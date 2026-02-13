<script setup lang="ts">
import type { PostAccountApikeysResponses } from '~/api-client';
import { zPostAccountApikeysData } from '~/api-client/zod.gen';


const toast = useToast();

const apiKey = useSubrouterInjectedData<APIKey, NewAPIKey>("api_key", true).inject();
const apiKey_data = apiKey.data;
const apiKey_loading = apiKey.loading;

const apiKey_form_schema = apiKey.isNew ? zPostAccountApikeysData.shape.body : null;
const apiKey_form_state = ref<NewAPIKey>({
    description: apiKey_data.value.description,
    expires_at: apiKey_data.value.expires_at as any
});

const api_key_creation_result_data = ref<PostAccountApikeysResponses["200"]["data"] | null>(null);
const api_key_creation_result_reveale_token = ref(false);

async function onFormSubmit() {

	apiKey_loading.value = true;

	try {

		if (apiKey.isNew) {
			const result = await useAPI((api) => api.postAccountApikeys({
				body: {
                    description: apiKey_form_state.value.description,
                    expires_at: apiKey_form_state.value.expires_at
				}
			}));

			if (result.success) {
				toast.add({
					title: 'API Key created',
					description: 'The API Key has been successfully created.',
					icon: 'i-lucide-check',
					color: 'success'
				});

				api_key_creation_result_data.value = result.data 

				// Redirect to the newly created ÁPI Key page
				// navigateTo(`/settings/apikeys/${result.data?.id}`);

			} else {
				throw new Error(result.message || 'Failed to create API Key');
			}

		} else {

            toast.add({
                title: 'API Key update not implemented',
                description: 'Updating API Keys is not yet implemented.',
                icon: 'i-lucide-info',
                color: 'info'
            });
			
			// const result = await useAPI((api) => api.putAccountApikeysId({
			// 	path: {
			// 		id: (apiKey_data as Ref<APIKey>).value.id
			// 	},
			// 	body: {
			// 		description: apiKey_form_state.value.description,
            //         expires_at: apiKey_form_state.value.expires_at
			// 	}
			// }));

			// if (result.success) {
			// 	apiKey_data.value.description = apiKey_form_state.value.description;
            //     apiKey_data.value.expires_at = apiKey_form_state.value.expires_at;

			// 	toast.add({
			// 		title: 'API Key updated',
			// 		description: 'The API Key has been successfully updated.',
			// 		icon: 'i-lucide-check',
			// 		color: 'success'
			// 	})
			// } else {
			// 	throw new Error(result.message || 'Failed to update API Key');
			// }

		}
	} catch (error: any) {
		toast.add({
			title: 'Error',
			description: error.message || 'An unexpected error occurred.',
			icon: 'i-lucide-alert-circle',
			color: 'error'
		})
	} finally {
		apiKey_loading.value = false
	}
	
}


const deleteConfirmOpen = ref(false);

async function onDeleteApiKey() {

    try {
        const res = await useAPI((api) => api.deleteAccountApikeysByApiKeyId({
            path: {
                apiKeyID: (apiKey_data as Ref<APIKey>).value.id
            }
        }));

        if (res.success) {

            toast.add({
                title: 'API Key deleted',
                description: 'The API Key has been successfully deleted.',
                color: 'success'
            });

			deleteConfirmOpen.value = false;

			await navigateTo('/settings/apikeys');

        } else {
            throw new Error(res.message || 'Failed to delete API Key.');
        }

    } catch (error: any) {
        toast.add({
            title: 'Failed to delete API Key',
            description: error.message || 'An unknown error occurred.',
            icon: 'i-lucide-alert-circle',
            color: 'error'
        });
    }
}

async function onAPIKeyReveal() {
	if (!api_key_creation_result_data.value) return;

	const id = api_key_creation_result_data.value.id;
	api_key_creation_result_data.value = null;
	
	navigateTo(`/settings/apikeys/${id}`);
}


const headerTexts = computed(() => {
    if (apiKey.isNew) {
        return {
            title: "Create New API Key",
            description: "Create a new API Key for Delivr API access.",
        };
    }
    return {
        title: `API Key ${(apiKey_data as Ref<APIKey>).value.id}`,
        description: "View and manage the details of the API Key.",
    };
});

</script>

<template>
    <div class="space-y-6 w-full lg:w-3xl mx-auto">
		<!-- Header -->
		<div>
			<h2 class="text-xl font-semibold text-white">
				{{ headerTexts.title }}
			</h2>
			<p class="text-sm text-slate-400 mt-1">
				{{ headerTexts.description }}
			</p>
		</div>

		<!-- Profile Card -->
		<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
			<div class="px-6 py-4 border-b border-slate-800">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
						<UIcon class="w-5 h-5 text-sky-400" name="i-lucide-info" />
					</div>
					<div>
						<h3 class="font-medium text-white">API Key Information</h3>
						<p class="text-sm text-slate-400">View and manage the details of this API Key.</p>
					</div>
				</div>
			</div>
			
			<div class="p-6">
				<UForm
                    id="settings"
                    class="divide-y divide-slate-800"
                    :schema="apiKey_form_schema"
                    :state="apiKey_form_state"
                    @submit="onFormSubmit()"
                    :disabled="!apiKey.isNew"
                >

					<UFormField
                        name="description"
                        label="Description"
                        description="The description for this API Key."
                        class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{
                            container: 'w-full',
                        }"
                    >
                        <UTextarea
                            v-model="apiKey_form_state.description"
                            placeholder="No description provided."
                            :rows="5"
                            autoresize
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField
                        name="expires_at"
                        label="Expiration Date"
                        description="The date and time when this API Key will expire. Leave blank for no expiration."
                        class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
                        :ui="{
                            container: 'w-full sm:w-60',
                        }"
                    >
                        <USelect
							v-if="apiKey.isNew"
                            v-model="apiKey_form_state.expires_at"
                            placeholder="Select expiration date"
                            class="w-full"
                            :items='[
                                { label: "7 Days", value: "7d" },
                                { label: "30 Days", value: "30d" },
                                { label: "90 Days", value: "90d" },
                                { label: "180 Days", value: "180d" },
                                { label: "365 Days", value: "365d" },
                                { label: "No Expiration", value: null }
                            ]'
                        />
						<UInput
							v-else
							:value="apiKey_data.expires_at ? new Date(apiKey_data.expires_at).toLocaleString() : 'Never'"
							disabled
						/>
                    </UFormField>

                    <div class="pt-4">
						<UButton v-if="!apiKey.isNew"
							label="Save Changes" 
							color="primary"
							type="submit" 
							:loading="apiKey_loading"
							icon="i-lucide-save"
							disabled
						/>
						<UButton v-else
							label="Create API Key" 
							color="primary"
							type="submit" 
							:loading="apiKey_loading"
							icon="i-lucide-plus-circle"
						/>
					</div>

				</UForm>
			</div>
		</div>

		<!-- Danger Zone Card -->
        <div
            v-if="!apiKey.isNew"
            class="rounded-xl border border-red-900/50 bg-red-950/20 backdrop-blur-sm overflow-hidden"
        >
            <div class="px-6 py-4 border-b border-red-900/50">
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"
                    >
                        <UIcon
                            name="i-lucide-alert-triangle"
                            class="w-5 h-5 text-red-400"
                        />
                    </div>
                    <div>
                        <h3 class="font-medium text-red-400">Danger Zone</h3>
                        <p class="text-sm text-slate-400">
                            Irreversible and destructive actions
                        </p>
                    </div>
                </div>
            </div>

            <div class="p-6">
                <div class="flex flex-col md:flex-row md:items-center gap-4">
                    <div class="flex-1">
                        <h4 class="font-medium text-white">
                            Delete API Key
                        </h4>
                        <p class="text-sm text-slate-400 mt-1">
                            Permanently delete this API Key
                        </p>
                    </div>
                    <UButton
                        label="Delete API Key"
                        color="error"
                        variant="soft"
                        icon="i-lucide-trash-2"
                        @click="deleteConfirmOpen = true"
                    />
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <DashboardDeleteModal
            v-if="!apiKey.isNew"
            title="Delete API Key"
            warning-text="All data associated with this API Key and related information will be permanently deleted. This action cannot be reversed."
            v-model:open="deleteConfirmOpen"
            @delete="onDeleteApiKey"
            :prevent-auto-close=true
        >
        </DashboardDeleteModal>

		<DashboardModal
			:open="!!api_key_creation_result_data?.token"
			:title="'API Key Created Successfully'"
			description="Make sure to copy your new API Key now. You won't be able to see it again!"
			icon="i-lucide-check-circle"
			icon-color="emerald"
		>
			<div class="space-y-4">
				<div class="p-4 rounded-lg bg-red-950/50 border border-red-900/50">
					<p class="text-sm text-red-300">
						<strong>Warning:</strong>
						The API Key will only be shown once. Make sure to copy and store it securely.
					</p>
				</div>

				<div>
					<label class="block text-sm font-medium text-slate-300 mb-2">
						API Key
					</label>
					<UInput
						:value="api_key_creation_result_data?.token"
						readonly
						:type="api_key_creation_result_reveale_token ? 'text' : 'password'"
						class="w-full"
						:ui="{
							trailing: 'pe-1'
						}"
					>
						<template #trailing>
							<UButton
								color="neutral"
								variant="link"
								size="sm"
								:icon="api_key_creation_result_reveale_token ?'i-lucide-eye-off' : 'i-lucide-eye'"
								:aria-label="api_key_creation_result_reveale_token ? 'Hide password' : 'Show password'"
								:aria-pressed="api_key_creation_result_reveale_token"
								aria-controls="password"
								autocomplete="new-password"
								autocapitalize="off" 
								autocorrect="off"
								spellcheck="false"
								@click="api_key_creation_result_reveale_token = !api_key_creation_result_reveale_token"
							/>
						</template>
					</UInput>
				</div>
			</div>

			<template #footer>
				<div class="flex justify-end gap-3">
					<UButton
						label="Close"
						color="neutral"
						variant="ghost"
						@click="onAPIKeyReveal()"
					/>
				</div>
			</template>

			<template #close>
				<UButton
                    :icon="'i-lucide-x'"
                    color="neutral"
                    variant="ghost"
                    data-slot="close"
					class="absolute top-4 end-4"
					@click="onAPIKeyReveal()"
                />
			</template>

		</DashboardModal>

	</div>
</template>