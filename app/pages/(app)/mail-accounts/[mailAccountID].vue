<script lang="ts" setup>
import type { MailAccount, MailAccountWithMailboxes, NewMailAccount } from '~/utils/types';
import type { UseSubrouterPathDynamics } from '~/composables/useSubrouterPathDynamics';
import { useMailAccountsStore } from '~/composables/stores/useMailAccountsStore';

const route = useRoute();


const mailAccountsStore = useMailAccountsStore();


const mailAccountID = route.params.mailAccountID as string;

let error = null;

const account = mailAccountID === "new" ? ref({
    display_name: '',

    smtp_host: '',
    smtp_port: 465,
    smtp_username: '',
    smtp_password: '',
    smtp_encryption: 'SSL',

    imap_host: '',
    imap_port: 993,
    imap_username: '',
    imap_password: '',
    imap_encryption: 'SSL',

    is_default: false

}) : await mailAccountsStore.getByID(parseInt(mailAccountID));

if (mailAccountID === "new") {

    useSubrouterInjectedData<MailAccountWithMailboxes, NewMailAccount>('mail_account', true).provide({
        data: account as Ref<NewMailAccount>,
        isNew: true
    });

} else {

    if (!account.value) {
        error = createError({
            statusCode: 404,
            statusMessage: 'Mail Account Not Found',
            message: `The mail account with ID ${mailAccountID} could not be found. It may have been deleted.`
        });
    }

    useSubrouterInjectedData<MailAccountWithMailboxes, NewMailAccount>('mail_account', true).provide({
        data: account as Ref<MailAccountWithMailboxes>,
        refresh: mailAccountsStore.refresh,
        loading: mailAccountsStore.isLoading,
        isNew: false
    });

}

function getRoutesConfig(): UseSubrouterPathDynamics.RoutesConfig {

    return mailAccountID === "new" ? {
        [`/mail-accounts/new`]: {
            isNavLink: true,
            label: 'General',
            icon: 'i-lucide-info',
            exact: true,
            getDynamicValues() {
                return {
                    seoSettings: {
                        title: `Connect new Mail Account`,
                        description: `Connect a new mail account to start sending emails via Delivr.`
                    },
                    breadcrumbItems: [
                        { label: 'Connect new Mail Account' }
                    ]
                };
            }
        }
    } : {
        [`/mail-accounts/${mailAccountID}`]: {
            isNavLink: true,
            label: 'General',
            icon: 'i-lucide-info',
            exact: true,
            getDynamicValues() {
                return {
                    seoSettings: {
                        title: `Mail Account ${account.value?.display_name}`,
                        description: `Manage Mail Account ${account.value?.display_name} on Delivr`
                    },
                    breadcrumbItems: [
                        { label: account.value?.display_name }
                    ]
                };
            }
        },
        [`/mail-accounts/${mailAccountID}/backend-configuration`]: {
            isNavLink: true,
            label: 'Backend Configuration',
            icon: 'i-lucide-settings',
            exact: true,
            getDynamicValues() {
                return {
                    seoSettings: {
                        title: `Mail Account ${account.value?.display_name} Settings`,
                        description: `Manage settings for Mail Account ${account.value?.display_name} on Delivr`
                    },
                    breadcrumbItems: [
                        { label: account.value?.display_name, to: `/mail-accounts/${mailAccountID}` },
                        { label: 'Backend Configuration' }
                    ]
                };
            }
        }
    };
}

const subrouterPathDynamics = useSubrouterPathDynamics({
    baseTitle: `Mail Accounts | Delivr`,
    basebreadcrumbItems: [
        { label: 'Manage Mail Accounts', to: '/mail-accounts' }
    ],
    routes: getRoutesConfig()
});

const routePathDynamicValues = await useAwaitedComputed(async () => {
    const values = await subrouterPathDynamics.getPathDynamicValues(route.path);
    useSeoMeta(values.seoSettings);
    return values;
});

</script>

<template>
    <UDashboardPanel class="flex-1">
        <template #header>
            <DashboardPageHeader icon="i-lucide-at-sign" :breadcrumb-items="routePathDynamicValues.breadcrumbItems">
                <template #leading>
                    <UButton
                        icon="i-lucide-arrow-left"
                        color="neutral"
                        variant="ghost"
                        to="/mail-accounts"
                        class="mr-2"
                    />
                </template>
            </DashboardPageHeader>

            <UDashboardToolbar>
                <UNavigationMenu :items="subrouterPathDynamics.links" highlight class="-mx-1 flex-1" />
            </UDashboardToolbar>

        </template>

        <template #body>
            <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full">
                <NuxtPage v-if="!error" />
                <UError v-else-if="error" :error="error" />
            </div>
        </template>

    </UDashboardPanel>
</template>