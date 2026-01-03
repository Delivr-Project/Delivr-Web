<script setup lang="ts">
import type { AvatarProps } from '@nuxt/ui';
import { useGravatarURL } from '~/composables/useGravatarURL';

const props = defineProps<Omit<AvatarProps, 'src'> & { email?: string }>();

const avatarSrc = props.email ? await useGravatarURL(props.email) : undefined;

</script>

<template>
    <UAvatar
        :src="avatarSrc"
        v-bind="props"
    >
        <slot />
    </UAvatar>
</template>

