<script setup lang="ts">
import { ref, watch } from 'vue';

const confirmText = ref("");

interface Props {
    title: string;
    description?: string;
    warningText: string;
    open: boolean;
    preventAutoClose?: boolean;
    onDelete: () => Promise<void> | void;
}

const props = withDefaults(defineProps<Props>(), {
    preventAutoClose: false,
    description: 'This action is permanent'
});

const emit = defineEmits<{
    'update:open': [value: boolean];
}>();

const loading = ref(false);

// Bumped on every open, so a delete that is still running from an earlier
// opening can't touch the dialog anymore.
let attempt = 0;

// Setze confirmText zurück, wenn das Modal geschlossen wird
watch(() => props.open, (newVal) => {
    if (!newVal) {
        confirmText.value = "";
    } else {
        attempt++;
        loading.value = false;
    }
});

async function onDeleteWrapper() {
    const thisAttempt = attempt;
    loading.value = true;
    try {
        await props.onDelete();
    } finally {
        if (thisAttempt === attempt) loading.value = false;
    }

    if (thisAttempt === attempt && !props.preventAutoClose) {
        emit('update:open', false);
    }
}

</script>

<template>
    <DashboardModal
        v-model:open="props.open"
        @update:open="(value: boolean) => emit('update:open', value)"
        :title="title"
        :description="description"
        icon="i-lucide-alert-triangle"
        icon-color="error"
    >
        <div class="space-y-4">
            <div class="p-4 rounded-lg bg-red-950/50 border border-red-900/50">
                <p class="text-sm text-red-300">
                    <strong>Warning:</strong>
                    {{ warningText }}
                </p>
            </div>

            <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                    Type <span class="text-red-400">DELETE</span> to confirm
                </label>
                <UInput
                    v-model="confirmText"
                    type="text"
                    placeholder="Type DELETE"
                    class="w-full"
                />
            </div>

            <p v-if="loading" class="text-sm text-muted">
                Deleting… Closing this dialog won't stop it; it finishes in the background.
            </p>
        </div>

        <template #footer>
            <div class="flex justify-end gap-3">
                <UButton
                    label="Cancel"
                    color="neutral"
                    variant="ghost"
                    @click="emit('update:open', false)"
                />
                <UButton
                    :label="title"
                    color="error"
                    :loading="loading"
                    :disabled="confirmText !== 'DELETE'"
                    icon="i-lucide-trash-2"
                    @click="onDeleteWrapper"
                />
            </div>
        </template>
    </DashboardModal>
</template>