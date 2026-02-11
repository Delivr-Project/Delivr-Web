<script setup lang="ts">
/**
 * Folder layout page with split-view support.
 * When a mail is selected, it shows in the right panel.
 * Uses NuxtPage for routing but with split-view container.
 */
import type { MailAccountWithMailboxes } from '~/utils/types';

const route = useRoute();

const folderPath = computed(() => decodeURIComponent(route.params.folderPath as string));

// Check if we're viewing a specific mail (has mailUID param)
const selectedMailUID = computed(() => {
    return route.params.mailUID as string | undefined;
});

const hasSelectedMail = computed(() => !!selectedMailUID.value);

// Get mail account from parent injected data
const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const accountId = computed(() => mailAccount.data.value?.id);

// Handle closing the detail view (navigate back to list)
function closeDetail() {
    if (accountId.value && folderPath.value) {
        navigateTo(`/mail/${accountId.value}/folder/${encodeURIComponent(folderPath.value)}`);
    }
}
</script>

<template>
    <div class="flex flex-1 h-full overflow-hidden">
        <NuxtPage />
    </div>
</template>
