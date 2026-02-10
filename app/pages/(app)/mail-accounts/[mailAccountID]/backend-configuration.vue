<script lang="ts" setup>
import type z from 'zod';
import { zPutMailAccountsByMailAccountIdCredentialsData } from '~/api-client/zod.gen';
import { useMailAccountsStore } from '~/composables/stores/useMailAccountsStore';
import { useDefaultOnFormError } from '~/composables/useDefaultOnFormError';

const toast = useToast();
const route = useRoute();

const mailAccountsStore = useMailAccountsStore();

const mailAccount = useSubrouterInjectedData<MailAccount>('mail_account').inject();
const mailAccount_data = mailAccount.data;

const headerTexts = computed(() => {
	return {
		title: `Mail Account ${(mailAccount_data as Ref<MailAccount>).value.display_name}`,
		description: 'View and manage the details of the mail account.'
	}
});


const mailAccount_form_schema = zPutMailAccountsByMailAccountIdCredentialsData.shape.body;
type MailAccountFormSchema = NonNullable<z.infer<typeof mailAccount_form_schema>>;

const mailAccount_form_state = ref<MailAccountFormSchema>({
	imap_host: mailAccount_data.value.imap_host,
	imap_port: mailAccount_data.value.imap_port,
	imap_username: mailAccount_data.value.imap_username,
	imap_password: "",
	imap_encryption: mailAccount_data.value.imap_encryption,

	smtp_host: mailAccount_data.value.smtp_host,
	smtp_port: mailAccount_data.value.smtp_port,
	smtp_username: mailAccount_data.value.smtp_username,
	smtp_password: "",
	smtp_encryption: mailAccount_data.value.smtp_encryption
});

const show_imap_password = ref(false);
const show_smtp_password = ref(false);

const mail_account_form_submit_loading = ref(false);

async function onFormSubmit() {

	mail_account_form_submit_loading.value = true;

	try {

		const result = await useAPI((api) => api.putMailAccountsByMailAccountIdCredentials({
			path: {
				mailAccountID: (mailAccount_data.value as MailAccount).id,
			},
			body: mailAccount_form_state.value
		}));

		if (result.success) {
			toast.add({
				title: 'Mail Account updated',
				description: `The Mail Account has been successfully updated.`,
				icon: 'i-lucide-check',
				color: 'success'
			});

			mailAccount_data.value = {
				...mailAccount_data.value,
				...mailAccount_form_state.value
			} satisfies MailAccount;

			await mailAccountsStore.refresh();

		} else {
			throw new Error(result.message || 'Failed to update Mail Account');
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


async function testConfiguration() {

	mail_account_form_submit_loading.value = true;

	try {

		const result = await useAPI((api) => api.getMailAccountsByMailAccountIdMailboxesByMailboxPath({
			path: {
				mailAccountID: (mailAccount_data.value as MailAccount).id,
				mailboxPath: 'INBOX',
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

		<UForm class="space-y-6" :schema="mailAccount_form_schema" :state="mailAccount_form_state"
			@submit="onFormSubmit()" @error="useDefaultOnFormError()">

			<!-- Settings Card -->
			<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
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

				<div class="p-6 space-y-8 w-full">

					<!-- IMAP Settings -->
					<div class="space-y-4">
						<div class="flex items-center gap-2 pb-2 border-b border-slate-800">
							<UIcon class="w-4 h-4 text-sky-400" name="i-lucide-inbox" />
							<h4 class="text-sm font-medium text-slate-300">IMAP Settings</h4>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<UFormField name="imap_host" label="IMAP Host" required class="flex flex-col gap-1">
								<UInput v-model="mailAccount_form_state.imap_host" placeholder="imap.example.com"
									class="w-full" />
							</UFormField>

							<UFormField name="imap_port" label="IMAP Port" required class="flex flex-col gap-1">
								<UInput v-model="mailAccount_form_state.imap_port" type="number" placeholder="993"
									class="w-full" />
							</UFormField>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<UFormField name="imap_username" label="IMAP Username" required class="flex flex-col gap-1">
								<UInput v-model="mailAccount_form_state.imap_username" placeholder="user@example.com"
									class="w-full" />
							</UFormField>

							<UFormField name="imap_password" label="IMAP Password" required class="flex flex-col gap-1">
								<UInput v-model="mailAccount_form_state.imap_password"
									:type="show_imap_password ? 'text' : 'password'" placeholder="••••••••"
									class="w-full" :ui="{ trailing: 'pe-1' }">
									<template #trailing>
										<UButton color="neutral" variant="link" size="sm"
											:icon="show_imap_password ? 'i-lucide-eye-off' : 'i-lucide-eye'"
											:aria-label="show_imap_password ? 'Hide password' : 'Show password'"
											:aria-pressed="show_imap_password" aria-controls="password"
											autocomplete="new-password" autocapitalize="off" autocorrect="off"
											spellcheck="false" @click="show_imap_password = !show_imap_password" />
									</template>
								</UInput>
							</UFormField>
						</div>

						<UFormField name="imap_encryption" label="IMAP Encryption" required class="flex flex-col gap-1">
							<USelect v-model="mailAccount_form_state.imap_encryption" :items="[
								{ label: 'SSL/TLS', value: 'SSL' },
								{ label: 'STARTTLS', value: 'STARTTLS' },
								{ label: 'None', value: 'NONE' }
							]" placeholder="Select encryption" class="w-full sm:w-64" />
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
							<UFormField name="smtp_host" label="SMTP Host" required class="flex flex-col gap-1">
								<UInput v-model="mailAccount_form_state.smtp_host" placeholder="smtp.example.com"
									class="w-full" />
							</UFormField>

							<UFormField name="smtp_port" label="SMTP Port" required class="flex flex-col gap-1">
								<UInput v-model="mailAccount_form_state.smtp_port" type="number" placeholder="587"
									class="w-full" />
							</UFormField>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<UFormField name="smtp_username" label="SMTP Username" required class="flex flex-col gap-1">
								<UInput v-model="mailAccount_form_state.smtp_username" placeholder="user@example.com"
									class="w-full" />
							</UFormField>

							<UFormField name="smtp_password" label="SMTP Password" required class="flex flex-col gap-1">
								<UInput v-model="mailAccount_form_state.smtp_password"
									:type="show_smtp_password ? 'text' : 'password'" placeholder="••••••••"
									class="w-full" :ui="{ trailing: 'pe-1' }">
									<template #trailing>
										<UButton color="neutral" variant="link" size="sm"
											:icon="show_smtp_password ? 'i-lucide-eye-off' : 'i-lucide-eye'"
											:aria-label="show_smtp_password ? 'Hide password' : 'Show password'"
											:aria-pressed="show_smtp_password" aria-controls="password"
											autocomplete="new-password" autocapitalize="off" autocorrect="off"
											spellcheck="false" @click="show_smtp_password = !show_smtp_password" />
									</template>
								</UInput>
							</UFormField>
						</div>

						<UFormField name="smtp_encryption" label="SMTP Encryption" required class="flex flex-col gap-1">
							<USelect v-model="mailAccount_form_state.smtp_encryption" :items="[
								{ label: 'SSL/TLS', value: 'SSL' },
								{ label: 'STARTTLS', value: 'STARTTLS' },
								{ label: 'None', value: 'NONE' }
							]" placeholder="Select encryption" class="w-full sm:w-64" />
						</UFormField>
					</div>

					<!-- Submit Button -->
					<div class="pt-4 border-t border-slate-800">
						<UButton 
							label="Update Mail Account Credentials"
							color="primary"
							type="submit"
							:loading="mail_account_form_submit_loading"
							icon="i-lucide-save"
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
	</div>
</template>

<style>
/* Hide the password reveal button in Edge */
::-ms-reveal {
	display: none;
}
</style>