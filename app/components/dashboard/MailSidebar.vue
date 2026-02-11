<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';
import MailAccountsMenu from './MailAccountsMenu.vue';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';

defineProps<{
    collapsed?: boolean;
}>();

const currentMailAccountStore = useSelectedMailAccountStore();
const currentMailAccount = await currentMailAccountStore.use();
const mailboxes = computed(() => currentMailAccount.value?.mailboxes || []);

// Mail folder items
const mailFolderItems = computed<NavigationMenuItem[]>(() => {
    const items: NavigationMenuItem[] = [];

    if (mailboxes.value.length === 0) {
        items.push({
            label: 'No Folders',
            icon: 'i-lucide-mail',
            disabled: true,
        });
        return items;
    }

    const inbox = mailboxes.value.find(mb => mb.path.toLowerCase() === 'inbox');
    if (inbox) {
        items.push({
            label: 'Inbox',
            icon: 'i-lucide-inbox',
            to: currentMailAccount.value ? `/mail/${currentMailAccount.value.id}/folder/inbox` : undefined,
            badge: inbox.status.unseen > 0 ? inbox.status.unseen : undefined,
        });
    }

    for (const mailbox of mailboxes.value) {
        if (mailbox.path.toLowerCase() === 'inbox') continue;

        const lowerPath = mailbox.path.toLowerCase();
        let icon = 'i-lucide-folder';
        if (lowerPath === 'sent' || lowerPath === 'sent mail' || lowerPath === 'sent messages') icon = 'i-lucide-send';
        else if (lowerPath === 'drafts') icon = 'i-lucide-file-edit';
        else if (lowerPath === 'trash' || lowerPath === 'deleted' || lowerPath === 'deleted messages') icon = 'i-lucide-trash-2';
        else if (lowerPath === 'spam' || lowerPath === 'junk') icon = 'i-lucide-shield-alert';
        else if (lowerPath === 'archive') icon = 'i-lucide-archive';

        items.push({
            label: mailbox.name,
            icon,
            to: currentMailAccount.value ? `/mail/${currentMailAccount.value.id}/folder/${encodeURIComponent(mailbox.path)}` : undefined,
            badge: mailbox.status.unseen > 0 ? mailbox.status.unseen : undefined,
        });
    }

    return items;
});
</script>

<template>
    <div class="flex flex-col h-full py-3">
        <!-- Mail Account Selector -->
        <div class="px-3 mb-4">
            <MailAccountsMenu :collapsed="collapsed" />
        </div>

        <!-- Compose Button -->
        <div v-if="currentMailAccount" class="px-3 mb-4">
            <UButton
                v-if="!collapsed"
                icon="i-lucide-pen-square"
                color="primary"
                variant="solid"
                size="lg"
                class="w-full justify-start shadow-sm"
                :to="`/mail/${currentMailAccount.id}/compose`"
            >
                Compose
            </UButton>
            <UTooltip v-else text="Compose" :delay-duration="0">
                <UButton
                    icon="i-lucide-pen-square"
                    color="primary"
                    variant="solid"
                    size="lg"
                    :to="`/mail/${currentMailAccount.id}/compose`"
                />
            </UTooltip>
        </div>

        <!-- Mail Folders -->
        <nav class="flex-1 px-2">
            <UNavigationMenu
                :collapsed="collapsed"
                :items="mailFolderItems"
                orientation="vertical"
                highlight
            />
        </nav>

        <!-- Quick Links at bottom -->
        <div class="mt-auto border-t border-default pt-3 px-2">
            <UNavigationMenu
                :collapsed="collapsed"
                :items="[
                    {
                        label: 'Overview',
                        icon: 'i-lucide-layout-dashboard',
                        to: '/',
                    },
                ]"
                orientation="vertical"
            />
        </div>
    </div>
</template>
