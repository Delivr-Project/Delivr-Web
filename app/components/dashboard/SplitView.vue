<script setup lang="ts">
/**
 * SplitView component for Gmail-like split view experience.
 * Shows a list on the left and a detail view on the right.
 * On mobile, only the list is shown if no item is selected.
 */

const props = withDefaults(defineProps<{
    /** Whether to show the split view (right panel) */
    showDetail?: boolean;
    /** Minimum size of the list panel (percentage) */
    listMinSize?: number;
    /** Default size of the list panel (percentage) */
    listDefaultSize?: number;
    /** Maximum size of the list panel (percentage) */
    listMaxSize?: number;
    /** ID for panel state persistence */
    id?: string;
}>(), {
    showDetail: false,
    listMinSize: 25,
    listDefaultSize: 35,
    listMaxSize: 50,
    id: 'split-view',
});

const emit = defineEmits<{
    (e: 'close-detail'): void;
}>();

const isMobile = ref(false);

function checkMobile() {
    if (typeof window !== 'undefined') {
        isMobile.value = window.innerWidth < 1024;
    }
}

onMounted(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('resize', checkMobile);
    }
});
</script>

<template>
    <div class="flex flex-1 h-full overflow-hidden">
        <!-- List Panel -->
        <UDashboardPanel
            :id="`${id}-list`"
            :resizable="showDetail && !isMobile"
            :min-size="listMinSize"
            :default-size="showDetail ? listDefaultSize : 100"
            :max-size="showDetail ? listMaxSize : 100"
            :class="[
                'border-r border-default',
                showDetail && !isMobile ? '' : 'flex-1',
                showDetail && isMobile ? 'hidden' : ''
            ]"
        >
            <slot name="list" />
        </UDashboardPanel>

        <!-- Detail Panel (only visible when showDetail is true and not on mobile) -->
        <UDashboardPanel
            v-if="showDetail"
            :id="`${id}-detail`"
            class="flex-1"
            :class="{ 'hidden lg:flex': !isMobile }"
        >
            <!-- Back button for mobile -->
            <template #header v-if="isMobile">
                <UDashboardNavbar>
                    <template #leading>
                        <UButton
                            icon="i-lucide-arrow-left"
                            color="neutral"
                            variant="ghost"
                            @click="emit('close-detail')"
                        />
                    </template>
                </UDashboardNavbar>
            </template>

            <slot name="detail" />
        </UDashboardPanel>

        <!-- Empty state when no detail selected -->
        <div
            v-if="!showDetail"
            class="hidden lg:flex flex-1 items-center justify-center bg-muted/30"
        >
            <slot name="empty">
                <div class="text-center text-muted">
                    <UIcon name="i-lucide-mail-open" class="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p class="text-lg font-medium">Select an email to read</p>
                    <p class="text-sm">Choose from your inbox on the left</p>
                </div>
            </slot>
        </div>
    </div>
</template>
