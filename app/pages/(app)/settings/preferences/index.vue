<script setup lang="ts">
// Preferences has no landing page of its own — send visitors to the first
// submenu so /settings/preferences never renders empty.
definePageMeta({
	middleware: () => navigateTo('/settings/preferences/mail', { redirectCode: 302 }),
});
</script>

<template>
	<div />
</template>
