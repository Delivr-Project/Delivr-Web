<script setup lang="ts">
import type { NuxtError } from '#app'
import Header from '~/components/layout/Header.vue'
import Footer from '~/components/layout/Footer.vue'


const props = defineProps<{
    error: NuxtError
}>()

</script>

<template>
    <div class="app-layout">
        <!-- Navigation -->
        <Header />

        <!-- Main Content -->
        <UMain class="main-content">
            <UError :error="error" />
        </UMain>

        <!-- Footer -->
        <Footer />
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