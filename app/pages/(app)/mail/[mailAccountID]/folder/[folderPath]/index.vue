<script setup lang="ts">
import MailFolderView from '~/components/mail/MailFolderView.vue';

// Re-mount when the folder path changes, but NOT when only query params change.
definePageMeta({
    key: (route) => route.path,
});

const route = useRoute();
</script>

<template>
    <MailFolderView :folder-path-param="route.params.folderPath" :mail-uid="null" />
</template>
