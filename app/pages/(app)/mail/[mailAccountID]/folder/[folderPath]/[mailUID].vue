<script setup lang="ts">
import { MailboxDisplayUtils } from '~/utils/mailboxDisplay';
import MailFolderView from '~/components/mail/MailFolderView.vue';
import { useEffectiveMailViewMode } from '~/composables/useMailViewMode';
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

definePageMeta({
    key: (route) => route.path,
});

const route = useRoute();
const router = useRouter();

const mailUid = computed(() => {
    const raw = route.params.mailUID;
    const str = Array.isArray(raw) ? raw[0] : raw;
    const n = typeof str === 'string' ? parseInt(str, 10) : NaN;
    return Number.isNaN(n) ? null : n;
});

const viewMode = useEffectiveMailViewMode();
const isMobile = useBreakpoints(breakpointsTailwind).smaller('lg');
const fullScreen = computed(() => isMobile.value || viewMode.value === 'list');

function goBack() {
    // Back to the list on the page the mail was opened from. `route.path` is still
    // encoded, so the folder segment stays one segment (the decoded param may hold "/").
    const page = Array.isArray(route.query.page) ? route.query.page[0] : route.query.page;
    router.push({
        path: route.path.replace(/\/[^/]+\/?$/, ''),
        query: page ? { page } : {}
    });
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
