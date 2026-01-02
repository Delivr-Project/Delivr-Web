<script lang="ts" setup>
import type { MailAccount, NewMailAccount } from '~/utils/types';
import type { UseSubrouterPathDynamics } from '~/composables/useSubrouterPathDynamics';
import { MailAccountsStore } from '~/utils/stores/mailAccountsStore';

const route = useRoute();

const mailAccountID = route.params.mailAccountID as string;

let error = null;

if (mailAccountID === "new") {

    useSubrouterInjectedData<number, NewMailAccount>('mail_account', true).provide({
        data: ref({
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
        }),
        isNew: true
    });

} else {
    
    const account = await MailAccountsStore.getByID(parseInt(mailAccountID));

    if (!account.value) {
        error = createError({
            statusCode: 404,
            statusMessage: 'Mail Account Not Found',
            message: `The mail account with ID ${mailAccountID} could not be found. It may have been deleted.`
        });
    }

    useSubrouterInjectedData<MailAccount, NewMailAccount>('mail_account', true).provide({
        data: account as Ref<MailAccount>,
        refresh: MailAccountsStore.refresh,
        loading: MailAccountsStore.isLoading,
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
        },
        [`/mail-accounts/new/backend-configuration`]: {
            isNavLink: true,
            label: 'Backend Configuration',
            icon: 'i-lucide-settings',
            exact: true,
            getDynamicValues() {
                return {
                    seoSettings: {
                        title: `Mail Account ${mailAccountID} Settings`,
                        description: `Manage settings for Mail Account ${mailAccountID} on Delivr`
                    },
                    breadcrumbItems: [
                        { label: mailAccountID, to: `/mail-accounts/${mailAccountID}` },
                        { label: 'Backend Configuration' }
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
                        title: `Mail Account ${mailAccountID}`,
                        description: `Manage Mail Account ${mailAccountID} on Delivr`
                    },
                    breadcrumbItems: [
                        { label: mailAccountID }
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
                        title: `Mail Account ${mailAccountID} Settings`,
                        description: `Manage settings for Mail Account ${mailAccountID} on Delivr`
                    },
                    breadcrumbItems: [
                        { label: mailAccountID, to: `/mail-accounts/${mailAccountID}` },
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
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                icon="i-lucide-rocket"
                :breadcrumb-items="routePathDynamicValues.breadcrumbItems"
            />

            <UDashboardToolbar>
				<!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
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