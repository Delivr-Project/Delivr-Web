<script setup lang="ts">
import { MailboxDisplayUtils } from '~/utils/mailboxDisplay';
import MailFolderView from '~/components/mail/MailFolderView.vue';
import { useEffectiveMailViewMode } from '~/composables/useMailViewMode';
import { useMediaQuery } from '@vueuse/core';

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
const isMobile = useMediaQuery('(max-width: 1023px)');
const fullScreen = computed(() => isMobile.value || viewMode.value === 'list');

function goBack() {
    const folderPath = Array.isArray(route.params.folderPath)
        ? route.params.folderPath[0]
        : route.params.folderPath;
    const segments = MailboxDisplayUtils.parseFolderParam(folderPath);
    const encoded = segments.map(encodeURIComponent).join('/');
    router.push(`/mail/${route.params.mailAccountID}/folder/${encoded}`);
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
