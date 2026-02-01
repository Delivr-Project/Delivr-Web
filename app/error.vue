<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
    error: NuxtError
}>()

</script>

<template>
    <div class="app-layout main-bg-color">

        <!-- Main Content -->
        <UMain class="main-content">
            <UError :error="error" />
        </UMain>

    </div>
</template>

<style scoped>
.app-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.main-content {
    flex: 1;
}
</style>