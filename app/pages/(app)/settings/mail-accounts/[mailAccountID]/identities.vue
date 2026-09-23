<script lang="ts" setup>
import type { MailAccountWithMailboxes } from '~/utils/types';
import { MailAddressUtils } from '~/utils/mail/mailAddress';

const injected = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const account = injected.data as Ref<MailAccountWithMailboxes>;

const accountId = computed(() => account.value.id);

// The SMTP login doubles as the account's own sender address whenever it is one.
const accountAddress = computed(() =>
    MailAddressUtils.isValid(account.value.smtp_username) ? account.value.smtp_username : undefined);

const suggestion = computed(() => ({
    display_name: account.value.display_name,
    email_address: accountAddress.value
}));
</script>

<template>
    <div class="space-y-6 w-full lg:w-3xl mx-auto">
        <div>
            <h2 class="text-xl font-semibold text-white">Identities</h2>
            <p class="text-sm text-slate-400 mt-1">
                Manage the addresses you can send from with this account. They show up in the
                composer's "From" list, with the default one preselected.
            </p>
        </div>

        <MailIdentitiesManager :account-id="accountId" :suggestion="suggestion" />

        <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <UIcon name="i-lucide-at-sign" class="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">Account address</h3>
                        <p class="text-sm text-slate-400">The address this account signs in with</p>
                    </div>
                </div>
            </div>
            <div class="p-6">
                <p v-if="accountAddress" class="text-sm text-white">{{ accountAddress }}</p>
                <p v-else class="text-sm text-slate-400">
                    The SMTP username <strong class="text-white">{{ account.smtp_username }}</strong>
                    isn't an email address, so it can't be used as a sender. Add an identity to send
                    mail from this account.
                </p>
                <p v-if="accountAddress" class="text-sm text-slate-400 mt-1">
                    It is always available as a sender, even without a matching identity. Change it
                    under Backend Configuration.
                </p>
            </div>
        </div>
    </div>
</template>
