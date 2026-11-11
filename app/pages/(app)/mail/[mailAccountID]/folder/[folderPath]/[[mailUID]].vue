<script setup lang="ts">
import { useEffectiveMailViewMode } from '~/composables/useMailViewMode';
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

// One instance per folder: opening or closing a mail keeps the list instead of
// rebuilding it. Query params don't re-mount either.
definePageMeta({
    key: (route) => (route.params.mailUID ? route.path.slice(0, route.path.lastIndexOf('/')) : route.path),
});

const route = useRoute();
const router = useRouter();

const mailUid = computed(() => {
    const raw = route.params.mailUID;
    const str = Array.isArray(raw) ? raw[0] : raw;
    const n = typeof str === 'string' ? parseInt(str, 10) : NaN;
    return Number.isNaN(n) ? null : n;
});

// An open mail takes over the whole panel on mobile and in list view.
const viewMode = useEffectiveMailViewMode();
const isMobile = useBreakpoints(breakpointsTailwind).smaller('lg');
const fullScreen = computed(() => mailUid.value !== null && (isMobile.value || viewMode.value === 'list'));

function goBack() {
    const folderPath = Array.isArray(route.params.folderPath)
        ? route.params.folderPath[0]
        : route.params.folderPath;
    router.push(`/mail/${route.params.mailAccountID}/folder/${folderPath || ''}`);
}
</script>

<template>
    <MailFolderView
        :folder-path-param="route.params.folderPath"
        :mail-uid="mailUid"
        :full-screen="fullScreen"
        @close="goBack"
    />
</template>
