<script setup lang="ts">
</script>

<template>
    <div class="app-layout main-bg-color">
        <UMain class="main-content">
            <div class="flex min-h-screen flex-col items-center justify-center px-4 py-10">
                <DelivrLogo class="mb-8 h-8 w-auto" />
                <div class="w-full max-w-2xl">
                    <slot />
                </div>
            </div>
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
