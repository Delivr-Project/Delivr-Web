<script lang="ts" setup>
import type { FormError, NavigationMenuItem } from '@nuxt/ui';
import { zPostMailAccountsData, zPutMailAccountsMailAccountIdData } from '~/api-client/zod.gen';
import { MailAccountsStore } from '~/utils/stores/mailAccountsStore';

const toast = useToast();
const route = useRoute();


const mailAccount = useSubrouterInjectedData<MailAccount, NewMailAccount>('mail_account', true).inject();
const mailAccount_data = mailAccount.data;
const mailAccount_loading = mailAccount.loading;

const headerTexts = computed(() => {
	if (mailAccount.isNew) {
		return {
			title: 'Add new Mail Account',
            description: 'Configure a new mail account to send and receive emails.'
		}
	}
	return {
		title: `Mail Account ${(mailAccount_data as Ref<MailAccount>).value.display_name}`,
		description: 'View and manage the details of the mail account.'
	}
});


const mailAccount_form_schema = mailAccount.isNew ? zPostMailAccountsData.shape.body : zPutMailAccountsMailAccountIdData.shape.body;
const mailAccount_form_state = computed({
    get: () => {
		if (mailAccount.isNew) {
			return {
				display_name: mailAccount_data.value.display_name,
				is_default: mailAccount_data.value.is_default,
			
				imap_host: mailAccount_data.value.imap_host,
				imap_port: mailAccount_data.value.imap_port,
				imap_username: mailAccount_data.value.imap_username,
				imap_password: (mailAccount_data.value as NewMailAccount).imap_password,
				imap_encryption: mailAccount_data.value.imap_encryption,

				smtp_host: mailAccount_data.value.smtp_host,
				smtp_port: mailAccount_data.value.smtp_port,
				smtp_username: mailAccount_data.value.smtp_username,
				smtp_password: (mailAccount_data.value as NewMailAccount).smtp_password,
				smtp_encryption: mailAccount_data.value.smtp_encryption
			}
		}
		return {
			display_name: mailAccount_data.value.display_name,
			is_default: mailAccount_data.value.is_default,
		}

    },
    set: (newState) => {
		if (mailAccount.isNew) {
			mailAccount_data.value.display_name = newState.display_name;
			mailAccount_data.value.is_default = newState.is_default;

			(mailAccount_data.value as NewMailAccount).imap_host = newState.imap_host as string;
			(mailAccount_data.value as NewMailAccount).imap_port = newState.imap_port as number;
			(mailAccount_data.value as NewMailAccount).imap_username = newState.imap_username as string;
			(mailAccount_data.value as NewMailAccount).imap_password = newState.imap_password as string;
			(mailAccount_data.value as NewMailAccount).imap_encryption = newState.imap_encryption as 'SSL' | 'STARTTLS' | 'NONE';

			(mailAccount_data.value as NewMailAccount).smtp_host = newState.smtp_host as string;
			(mailAccount_data.value as NewMailAccount).smtp_port = newState.smtp_port as number;
			(mailAccount_data.value as NewMailAccount).smtp_username = newState.smtp_username as string;
			(mailAccount_data.value as NewMailAccount).smtp_password = newState.smtp_password as string;
			(mailAccount_data.value as NewMailAccount).smtp_encryption = newState.smtp_encryption as 'SSL' | 'STARTTLS' | 'NONE';
		} else {
			mailAccount_data.value.display_name = newState.display_name;
			mailAccount_data.value.is_default = newState.is_default;
		}
    }
});

const show_imap_password = ref(false);
const show_smtp_password = ref(false);

const mail_account_form_submit_loading = ref(false);

async function onFormSubmit() {

    mail_account_form_submit_loading.value = true;

    try {

		if (mailAccount.isNew) {

			const result = await useAPI((api) => api.postMailAccounts({
				body: mailAccount_data.value as NewMailAccount
			}));

			if (result.success && result.data) {
				toast.add({
					title: 'Mail Account added',
					description: `The Mail Account has been successfully created.`,
					icon: 'i-lucide-check',
					color: 'success'
				});

                await MailAccountsStore.refresh();

				// Redirect to the new package page
				await navigateTo(`/mail-accounts/${result.data.id}`);
			} else {
				throw new Error(result.message || 'Failed to create package');
			}
		} else {
			
            const result = await useAPI((api) => api.putMailAccountsMailAccountId({
                path: {
                    mailAccountID: (mailAccount_data.value as MailAccount).id,
                },
                body: mailAccount_data.value as MailAccount
            }));

            if (result.success && result.data) {
                toast.add({
                    title: 'Mail Account updated',
                    description: `The Mail Account has been successfully updated.`,
                    icon: 'i-lucide-check',
                    color: 'success'
                });

                await MailAccountsStore.refresh();

            } else {
                throw new Error(result.message || 'Failed to update Mail Account');
            }

		}
	} catch (error: any) {
		toast.add({
			title: 'Error',
			description: error.message || 'An unexpected error occurred.',
			icon: 'i-lucide-x-circle',
			color: 'error'
		});
	}

    mail_account_form_submit_loading.value = false;
}


const deleteLoading = ref(false);
const deleteConfirmOpen = ref(false);
const deleteConfirmText = ref('');

async function onDeleteMailAccount() {

    deleteLoading.value = true;
    deleteConfirmOpen.value = false;

    if (mailAccount.isNew) {
        return;
    }

    try {

        const result = await useAPI((api) => api.deleteMailAccountsMailAccountId({
            path: {
                mailAccountID: (mailAccount_data.value as MailAccount).id,
            }
        }));

        if (result.success) {
            toast.add({
                title: 'Mail Account deleted',
                description: `The Mail Account has been successfully deleted.`,
                icon: 'i-lucide-check',
                color: 'success'
            });

            await MailAccountsStore.refresh();

            // Redirect to the mail accounts list page
            await navigateTo(`/mail-accounts`);
        } else {
            throw new Error(result.message || 'Failed to delete Mail Account');
        }
    } catch (error: any) {
        toast.add({
            title: 'Error',
            description: error.message || 'An unexpected error occurred.',
            icon: 'i-lucide-x-circle',
            color: 'error'
        });
    }
    deleteLoading.value = false;
}

async function testConfiguration() {
	
	mail_account_form_submit_loading.value = true;

	try {

		const result = await useAPI((api) => api.getMailAccountsMailAccountIdMails({
			path: {
				mailAccountID: (mailAccount_data.value as MailAccount).id,
			},
			query: {
				limit: 1
			}
		}));

		if (result.success) {
			toast.add({
				title: 'Configuration Successful',
				description: `The Mail Account configuration is valid and working.`,
				icon: 'i-lucide-check',
				color: 'success'
			});
		} else {
			throw new Error(result.message || 'Failed to test Mail Account configuration');
		}

	} catch (error: any) {
		toast.add({
			title: 'Error',
			description: error.message || 'An unexpected error occurred.',
			icon: 'i-lucide-x-circle',
			color: 'error'
		});
	}

	mail_account_form_submit_loading.value = false;

}

</script>

<template>
    <div class="space-y-6 lg:max-w-3xl mx-auto">
		<!-- Header -->
		<div>
			<h2 class="text-xl font-semibold text-white">
				{{ headerTexts.title }}
			</h2>
			<p class="text-sm text-slate-400 mt-1">
				{{ headerTexts.description }}
			</p>
		</div>

		<UForm class="space-y-6" :schema="mailAccount_form_schema" :state="mailAccount_form_state" @submit="onFormSubmit()">

			<!-- Settings Card -->
			<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
				<div class="px-6 py-4 border-b border-slate-800">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
							<UIcon class="w-5 h-5 text-sky-400" name="i-lucide-info" />
						</div>
						<div>
							<h3 class="font-medium text-white">Mail Account Information</h3>
							<p class="text-sm text-slate-400">Modify the details of your mail account</p>
						</div>
					</div>
				</div>
				
				<div class="p-6">
					<div class="divide-y divide-slate-800">

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
							<UInput v-model="mailAccount_data.display_name" placeholder="Enter display name" class="w-full sm:w-96" />
						</UFormField>

						<UFormField 
							name="is_default" 
							label="Is Default Mail Account"
							description="Set this Mail Account as the default for sending emails."
							required
							class="flex justify-between items-start gap-4 py-4 first:pt-0 last:pb-0"
						>
							<div class="w-full sm:w-96 rounded-md border-0 appearance-none placeholder:text-dimmed focus:outline-none disabled:cursor-not-allowed disabled:opacity-75 transition-colors py-1.5 text-sm gap-1.5 text-highlighted bg-transparent sm:flex sm:justify-center">
								<UCheckbox v-model="mailAccount_data.is_default" />
							</div>
						</UFormField>

						<div class="pt-4" v-if="!mailAccount.isNew">
							<UButton
								label="Save Changes" 
								color="primary"
								disabled
								type="submit" 
								:loading="mail_account_form_submit_loading"
								icon="i-lucide-save"
							/>
						</div>

					</div>
				</div>
			</div>

			<!-- Backend Configuration Card -->
			<div v-if="mailAccount.isNew" class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
				<div class="px-6 py-4 border-b border-slate-800">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
							<UIcon class="w-5 h-5 text-sky-400" name="i-lucide-info" />
						</div>
						<div>
							<h3 class="font-medium text-white">Backend Configuration</h3>
							<p class="text-sm text-slate-400">Modify backend settings for your mail account</p>
						</div>
					</div>
				</div>
				
				<div class="p-6 space-y-8">
					<!-- IMAP Settings -->
					<div class="space-y-4">
						<div class="flex items-center gap-2 pb-2 border-b border-slate-800">
							<UIcon class="w-4 h-4 text-sky-400" name="i-lucide-inbox" />
							<h4 class="text-sm font-medium text-slate-300">IMAP Settings</h4>
						</div>
						
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<UFormField 
								name="imap_host" 
								label="IMAP Host"
								required
								class="flex flex-col gap-1"
							>
								<UInput v-model="(mailAccount_data as NewMailAccount).imap_host" placeholder="imap.example.com" class="w-full" />
							</UFormField>

							<UFormField 
								name="imap_port" 
								label="IMAP Port"
								required
								class="flex flex-col gap-1"
							>
								<UInput v-model="(mailAccount_data as NewMailAccount).imap_port" type="number" placeholder="993" class="w-full" />
							</UFormField>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<UFormField 
								name="imap_username" 
								label="IMAP Username"
								required
								class="flex flex-col gap-1"
							>
								<UInput v-model="(mailAccount_data as NewMailAccount).imap_username" placeholder="user@example.com" class="w-full" />
							</UFormField>

							<UFormField 
								name="imap_password" 
								label="IMAP Password"
								required
								class="flex flex-col gap-1"
							>
								<UInput
									v-model="(mailAccount_data as NewMailAccount).imap_password"
									:type="show_imap_password ? 'text' : 'password'"
									placeholder="••••••••"
									class="w-full"
									:ui="{ trailing: 'pe-1' }"
								>
									<template #trailing>
										<UButton
											color="neutral"
											variant="link"
											size="sm"
											:icon="show_imap_password ? 'i-lucide-eye-off' : 'i-lucide-eye'"
											:aria-label="show_imap_password ? 'Hide password' : 'Show password'"
											:aria-pressed="show_imap_password"
											aria-controls="password"
											autocomplete="new-password"
											autocapitalize="off"
											autocorrect="off"
											spellcheck="false"
											@click="show_imap_password = !show_imap_password"
										/>
									</template>
								</UInput>
							</UFormField>
						</div>

						<UFormField 
							name="imap_encryption" 
							label="IMAP Encryption"
							required
							class="flex flex-col gap-1"
						>
							<USelect 
								v-model="(mailAccount_data as NewMailAccount).imap_encryption" 
								:items="[
									{ label: 'SSL/TLS', value: 'SSL' },
									{ label: 'STARTTLS', value: 'STARTTLS' },
									{ label: 'None', value: 'NONE' }
								]"
								placeholder="Select encryption"
								class="w-full sm:w-64"
							/>
						</UFormField>
					</div>

					<!-- Divider -->
					<div class="border-t border-slate-800"></div>

					<!-- SMTP Settings -->
					<div class="space-y-4">
						<div class="flex items-center gap-2 pb-2 border-b border-slate-800">
							<UIcon class="w-4 h-4 text-sky-400" name="i-lucide-send" />
							<h4 class="text-sm font-medium text-slate-300">SMTP Settings</h4>
						</div>
						
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<UFormField 
								name="smtp_host" 
								label="SMTP Host"
								required
								class="flex flex-col gap-1"
							>
								<UInput v-model="(mailAccount_data as NewMailAccount).smtp_host" placeholder="smtp.example.com" class="w-full" />
							</UFormField>

							<UFormField 
								name="smtp_port" 
								label="SMTP Port"
								required
								class="flex flex-col gap-1"
							>
								<UInput v-model="(mailAccount_data as NewMailAccount).smtp_port" type="number" placeholder="587" class="w-full" />
							</UFormField>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<UFormField 
								name="smtp_username" 
								label="SMTP Username"
								required
								class="flex flex-col gap-1"
							>
								<UInput v-model="(mailAccount_data as NewMailAccount).smtp_username" placeholder="user@example.com" class="w-full" />
							</UFormField>

							<UFormField 
								name="smtp_password" 
								label="SMTP Password"
								required
								class="flex flex-col gap-1"
							>
								<UInput
									v-model="(mailAccount_data as NewMailAccount).smtp_password"
									:type="show_smtp_password ? 'text' : 'password'"
									placeholder="••••••••"
									class="w-full"
									:ui="{ trailing: 'pe-1' }"
								>
									<template #trailing>
										<UButton
											color="neutral"
											variant="link"
											size="sm"
											:icon="show_smtp_password ? 'i-lucide-eye-off' : 'i-lucide-eye'"
											:aria-label="show_smtp_password ? 'Hide password' : 'Show password'"
											:aria-pressed="show_smtp_password"
											aria-controls="password"
											autocomplete="new-password"
											autocapitalize="off"
											autocorrect="off"
											spellcheck="false"
											@click="show_smtp_password = !show_smtp_password"
										/>
									</template>
								</UInput>
							</UFormField>
						</div>

						<UFormField 
							name="smtp_encryption" 
							label="SMTP Encryption"
							required
							class="flex flex-col gap-1"
						>
							<USelect 
								v-model="(mailAccount_data as NewMailAccount).smtp_encryption" 
								:items="[
									{ label: 'SSL/TLS', value: 'SSL' },
									{ label: 'STARTTLS', value: 'STARTTLS' },
									{ label: 'None', value: 'NONE' }
								]"
								placeholder="Select encryption"
								class="w-full sm:w-64"
							/>
						</UFormField>
					</div>

					<!-- Submit Button -->
					<div class="pt-4 border-t border-slate-800">
						<UButton
							label="Create Mail Account" 
							color="primary"
							type="submit" 
							:loading="mail_account_form_submit_loading"
							icon="i-lucide-plus-circle"
						/>
						<!-- <UButton
							label="Test Configuration" 
							color="secondary"
							class="ms-3"
							:loading="mail_account_form_submit_loading"
							icon="i-lucide-send"
							@click="testConfiguration()"
						/> -->
					</div>
				</div>
			</div>

		</UForm>

        <!-- Danger Zone Card -->
		<div v-if="!mailAccount.isNew" class="rounded-xl border border-red-900/50 bg-red-950/20 backdrop-blur-sm overflow-hidden">
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
						<h4 class="font-medium text-white">Delete Mail Account</h4>
						<p class="text-sm text-slate-400 mt-1">
							Permanently delete this Mail Account and all associated data. This action cannot be undone.
						</p>
					</div>
					<UButton 
						label="Delete Mail Account" 
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
			v-if="!mailAccount.isNew"
			v-model:open="deleteConfirmOpen"
			title="Delete Mail Account"
			description="This action is permanent"
			icon="i-lucide-alert-triangle"
			icon-color="error"
		>
			<div class="space-y-4">
				<div class="p-4 rounded-lg bg-red-950/50 border border-red-900/50">
					<p class="text-sm text-red-300">
						<strong>Warning:</strong> All the OS release data including packages, releases, and related information will be permanently deleted. This action cannot be reversed.
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
						label="Delete Mail Account"
						color="error"
						:loading="deleteLoading"
						:disabled="deleteConfirmText !== 'DELETE'"
						icon="i-lucide-trash-2"
						@click="onDeleteMailAccount"
					/>
				</div>
			</div>
		</DashboardModal>

	</div>
</template>

<style>
/* Hide the password reveal button in Edge */
::-ms-reveal {
    display: none;
}
</style>