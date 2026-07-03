<script setup lang="ts">
import type { MailAccountWithMailboxes } from '~/utils/types';
import MailDetailContent from '~/components/mail/MailDetailContent.vue';
import { useMailViewMode } from '~/composables/useMailViewMode';

const route = useRoute();

const folderPath = decodeURIComponent(route.params.folderPath as string);
const uiFolderPath = folderPath.charAt(0).toUpperCase() + folderPath.slice(1).toLowerCase();
const mailUID = parseInt(route.params.mailUID as string);

const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const accountId = mailAccount.data.value.id;

const viewMode = useMailViewMode();

// If the user prefers the split view, send them back to the list with the mail
// pre-selected — deep-linking a mail should still work without awkward navigation.
onMounted(() => {
    if (viewMode.value === 'split') {
        navigateTo(
            `/mail/${accountId}/folder/${encodeURIComponent(folderPath)}?selected=${mailUID}`,
            { replace: true }
        );
    }
});

useSeoMeta({
    title: `Email | Delivr`,
    description: 'View email'
});

function goBack() {
    navigateTo(`/mail/${accountId}/folder/${encodeURIComponent(folderPath)}`);
}
</script>

<template>
    <UDashboardPanel>
        <template #header>
            <UDashboardNavbar
                :title="uiFolderPath"
                icon="i-lucide-mail-open"
            >
                <template #leading>
                    <UButton
                        icon="i-lucide-arrow-left"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="goBack"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <DashboardPageBody class="h-full p-0">
                <div class="h-full flex flex-col min-h-0">
                    <MailDetailContent
                        :account-id="accountId"
                        :folder-path="folderPath"
                        :mail-uid="mailUID"
                        @not-found="goBack"
                        @deleted="goBack"
                    />
                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>
