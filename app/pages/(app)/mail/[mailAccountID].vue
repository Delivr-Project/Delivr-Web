<script setup lang="ts">
import { useMailAccountsStore } from '~/composables/stores/useMailAccountsStore';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';
import type { MailAccountWithMailboxes } from '~/utils/types';

const mailAccountID = parseInt(useRoute().params.mailAccountID as string);

let error = null;

const mailAccountsStore = useMailAccountsStore();

const selectedMailAccountStore = useSelectedMailAccountStore();

selectedMailAccountStore.set(mailAccountID);

const account = await selectedMailAccountStore.use();

if (!account.value) {
    error = createError({
        statusCode: 404,
        statusMessage: 'Mail Account Not Found',
        message: `The mail account with ID ${mailAccountID} could not be found. It may have been deleted.`
    });
} else {
    
    useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').provide({
        data: account as Ref<MailAccountWithMailboxes>,
        refresh: mailAccountsStore.refresh,
        loading: mailAccountsStore.isLoading
    });

    // watch for changes in the selected mail account and update the route accordingly
    watch(account, (newAccount) => {
        if (newAccount && newAccount.id !== mailAccountID) {
            navigateTo(`/mail/${newAccount.id}`);
        }
    });

}
</script>

<template>
    <NuxtPage v-if="!error" />

    <UDashboardPanel v-else-if="error">

        <template #body>
            <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full">
                <UError :error="error" />
            </div>
        </template>

    </UDashboardPanel>

</template>