<script setup lang="ts">
import type { AvatarProps } from '@nuxt/ui';
import { useGravatarURL } from '~/composables/useGravatarURL';
import { useBimiURL } from '~/composables/useBimiURL';

/**
 * Avatar for an email sender. Prefers the sender domain's BIMI brand logo (the
 * official, DNS-published brand indicator) and falls back to the sender's
 * personal Gravatar when the domain publishes no BIMI record.
 *
 * Drop-in extension of {@link Gravatar}: forwards all `UAvatar` props plus an
 * `email` (and optional explicit `domain`).
 */
const props = defineProps<Omit<AvatarProps, 'src'> & {
    email?: string;
    /** Explicit sender domain; derived from `email` when omitted. */
    domain?: string;
    /** Set to `false` to skip the BIMI lookup and use Gravatar only. */
    bimi?: boolean;
}>();

function domainOf(email?: string): string | null {
    if (!email) return null;
    const at = email.lastIndexOf('@');
    if (at === -1) return null;
    const domain = email.slice(at + 1).trim().toLowerCase();
    return domain || null;
}

const avatarSrc = await (async (): Promise<string | undefined> => {
    const domain = props.domain?.trim().toLowerCase() || domainOf(props.email);

    // Prefer the sender domain's BIMI brand logo when one is published.
    if (props.bimi !== false && domain) {
        const bimiUrl = await useBimiURL(domain).catch(() => null);
        if (bimiUrl) return bimiUrl;
    }

    // Fall back to the sender's personal Gravatar.
    if (props.email) return await useGravatarURL(props.email);

    return undefined;
})();
</script>

<template>
    <UAvatar
        :src="avatarSrc"
        v-bind="props"
    >
        <slot />
    </UAvatar>
</template>
