<script setup lang="ts">
import { MailAccountsStore } from '~/utils/stores/mailAccountsStore';

const mailAccountID = useRoute().params.mailAccountID as string;

let error = null;

await MailAccountsStore.fetchAndSetIfNeeded();
const account = await MailAccountsStore.getByID(parseInt(mailAccountID));

if (!account.value) {
    error = createError({
        statusCode: 404,
        statusMessage: 'Mail Account Not Found',
        message: `The mail account with ID ${mailAccountID} could not be found. It may have been deleted.`
    });
} else {

    MailAccountsStore.setSelected(account.value.id);
    
    useSubrouterInjectedData<MailAccount>('mail_account').provide({
        data: account as Ref<MailAccount>,
        refresh: MailAccountsStore.refresh,
        loading: MailAccountsStore.isLoading,
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