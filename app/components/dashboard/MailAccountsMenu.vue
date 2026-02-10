<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useMailAccountsStore } from '~/composables/stores/useMailAccountsStore';
import { useSelectedMailAccountStore } from '~/composables/stores/useSelectedMailAccountStore';

defineProps<{
    collapsed?: boolean
}>()

const mailAccountsStore = useMailAccountsStore();
const mailAccountsList = await mailAccountsStore.use();

const selectedMailAccountStore = useSelectedMailAccountStore();
const selectedMailAccount = await selectedMailAccountStore.use();

const baseItems: DropdownMenuItem[] = [{
    label: 'Add new Account',
    icon: 'i-lucide-circle-plus',
    to: '/mail-accounts/new'
},{
    label: 'Manage Accounts',
    icon: 'i-lucide-cog',
    to: '/mail-accounts'
}];

const items = computed<DropdownMenuItem[][]>(() => {

    if (!mailAccountsList.value) {
        return [
            [{
                label: 'Account could not be loaded',
                icon: 'i-lucide-alert-circle'
            }],
            baseItems
        ];
    }

    return [
        mailAccountsList.value.map(account => ({
            // @TODO: change label to primary identiy email address when implemented
            label: account.display_name,
            avatar: {
                alt: account.display_name,
            },
            onSelect() {
                selectedMailAccountStore.set(account.id);
            }
        } satisfies DropdownMenuItem)),
        baseItems
    ]
})
</script>

<template>
    <UDropdownMenu
        :items="items"
        :content="{
            align: 'center',
            collisionPadding: 12
        }"
        :ui="{
            viewport: 'main-bg-color',
			content: collapsed ? 'w-40' : 'w-(--reka-dropdown-menu-trigger-width)'
        }">
        <UButton
            v-bind="{
                avatar: {
                    alt: selectedMailAccount ? selectedMailAccount.display_name : 'No Account Selected',
                },
                label: collapsed ? undefined : selectedMailAccount ? selectedMailAccount.display_name : 'No Account Selected',
                trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
            }"
            color="neutral"
			variant="ghost"
			block
			:square="collapsed"
			class="data-[state=open]:bg-elevated"
			:class="[!collapsed && 'py-2']"
			:ui="{
				trailingIcon: 'text-dimmed'
			}"
		/>
    </UDropdownMenu>
</template>
