<script setup lang="ts">

</script>

<template>

    <div class="app-layout main-bg-color">
        
        <!-- Main Content -->
        <UMain class="main-content">
            <div class="auth-wrapper flex min-h-[calc(100vh-0px)] items-center justify-center">
                <UPageCard class="w-full max-w-md border-slate-800">
                    <slot />
                </UPageCard>

            </div>
        </UMain>

        <!-- Footer -->
        <UFooter class="mt-8 bg-neutral-900">
            <div class="text-sm text-slate-500 text-center">
                &copy; {{ new Date().getFullYear() }} Delivr Project. All rights reserved.
            </div>
        </UFooter>

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

.auth-wrapper {
    margin-top: -2rem;
}


</style>