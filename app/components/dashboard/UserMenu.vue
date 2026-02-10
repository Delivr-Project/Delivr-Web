<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { useUserInfoStore } from "~/composables/stores/useUserStore";

defineProps<{
    collapsed?: boolean;
}>();

const toast = useToast();

const userinfoStore = await useUserInfoStore();
const userinfo = await userinfoStore.use();
if (!userinfoStore.isValid(userinfo)) {
    throw new Error("User not authenticated but should be to access UserMenu");
}

const user = computed(() => {
    if (!userinfo.value) {
        return {
            name: "Unknown User",
            avatar: {
                alt: "Unknown User",
            },
        };
    }
    return {
        name: userinfo.value.display_name,
        avatar: {
            alt: userinfo.value.display_name,
        },
    };
});

async function logout() {
    try {
        const result = await useAPI((api) => {
            return api.postAuthLogout({});
        });

        await userinfoStore.clear();

        useAppCookies().sessionToken.get().value = null;

        if (!result.success) {
            toast.add({
                title: "Error",
                description:
                    result.message || "An error occurred during logout.",
                icon: "i-lucide-alert-circle",
                color: "error",
            });
            return;
        }

        toast.add({
            title: "Logged out",
            description: "You have been successfully logged out.",
            icon: "i-lucide-check",
            color: "success",
        });

        await navigateTo("/auth/login");
    } catch (error) {
        toast.add({
            title: "Error",
            description: "An unexpected error occurred during logout.",
            icon: "i-lucide-alert-circle",
            color: "error",
        });
    }
}

const items = computed<DropdownMenuItem[][]>(() => [
    [
        {
            type: "label",
            label: user.value.name,
            avatar: user.value.avatar,
        },
    ],
    [
        {
            label: "Settings",
            icon: "i-lucide-settings",
            to: "/settings",
        },
    ],
    [
        {
            label: 'Documentation',
            icon: 'i-lucide-book-open',
            to: 'https://github.com/Delivr-Project',
            target: '_blank'
        },
        {
            label: 'GitHub repository',
            icon: 'i-simple-icons-github',
            to: 'https://github.com/Delivr-Project',
            target: '_blank'
        }
    ],
    [
        {
            label: "Log out",
            icon: "i-lucide-log-out",
            onSelect: logout,
        },
    ],
]);

</script>

<template>

    <UDropdownMenu
        :items="items"
        :content="{ align: 'center', collisionPadding: 12 }"
        :ui="{
			viewport: 'main-bg-color',
            content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)',
        }"
    >
        <UButton
            v-bind="{
                ...user,
                label: collapsed ? undefined : user?.name,
                trailingIcon: collapsed
                    ? undefined
                    : 'i-lucide-chevrons-up-down',
            }"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="data-[state=open]:bg-elevated/50 hover:bg-elevated/50"
            :ui="{
                trailingIcon: 'text-dimmed',
            }"
        />

		<template #chip-leading="{ item }">
			<div class="inline-flex items-center justify-center shrink-0 size-5">
				<span class="rounded-full ring ring-bg bg-(--chip-light) dark:bg-(--chip-dark) size-2" :style="{
					'--chip-light': `var(--color-${(item as any).chip}-500)`,
					'--chip-dark': `var(--color-${(item as any).chip}-400)`
				}" />
			</div>
		</template>

    </UDropdownMenu>
</template>
