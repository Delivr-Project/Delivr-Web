<script lang="ts" setup>
import { useOnboardingStore } from '~/composables/stores/useOnboardingStore';
import { useUserInfoStore } from '~/composables/stores/useUserStore';
import { useAutoMarkSeenStore } from '~/composables/stores/useAutoMarkSeenStore';
import { useFolderNestingStore } from '~/composables/stores/useFolderNestingStore';
import { useFolderDragDropStore } from '~/composables/stores/useFolderDragDropStore';

definePageMeta({
    layout: 'onboarding',
});

useSeoMeta({
    title: 'Welcome to Delivr',
    description: 'Set up your preferences to get started.',
});

const toast = useToast();

const onboardingStore = useOnboardingStore();
const userInfoStore = useUserInfoStore();
const autoMarkSeenStore = useAutoMarkSeenStore();
const folderNestingStore = useFolderNestingStore();
const folderDragDropStore = useFolderDragDropStore();

const [user] = await Promise.all([
    userInfoStore.use(),
    onboardingStore.refreshIfNeeded(),
    autoMarkSeenStore.use(),
    folderNestingStore.use(),
    folderDragDropStore.use(),
]);

// Already onboarded (e.g. opened /welcome directly) → nothing to do here.
if (onboardingStore.completed.value) {
    await navigateTo('/');
}

const firstName = computed(() => user.value?.display_name?.trim().split(/\s+/)[0] || null);

// Staged, local copy — persisted only when the user finishes.
const prefs = reactive({
    autoMarkSeen: autoMarkSeenStore.enabled.value,
    nestUnderInbox: folderNestingStore.nestUnderInbox.value,
    folderDragDrop: folderDragDropStore.enabled.value,
});

const finishing = ref(false);

async function savePreferences() {
    await Promise.all([
        prefs.autoMarkSeen !== autoMarkSeenStore.enabled.value
            ? autoMarkSeenStore.update({ enabled: prefs.autoMarkSeen })
            : Promise.resolve(),
        prefs.nestUnderInbox !== folderNestingStore.nestUnderInbox.value
            ? folderNestingStore.update({ nestUnderInbox: prefs.nestUnderInbox })
            : Promise.resolve(),
        prefs.folderDragDrop !== folderDragDropStore.enabled.value
            ? folderDragDropStore.update({ enabled: prefs.folderDragDrop })
            : Promise.resolve(),
    ]);
}

// Mark onboarding done so the first-login redirect stops firing, then leave the
// welcome flow. `/` routes to the inbox, or to add a first mail account.
async function complete(savePrefs: boolean) {
    finishing.value = true;
    try {
        if (savePrefs) await savePreferences();
        await onboardingStore.update({ completed: true });
        await navigateTo('/');
    } catch (error: any) {
        toast.add({
            title: 'Error',
            description: error.message || 'An unexpected error occurred while saving your preferences.',
            icon: 'i-lucide-x-circle',
            color: 'error',
        });
        finishing.value = false;
    }
}
</script>

<template>
    <div class="space-y-6">
        <!-- Welcome -->
        <div class="text-center">
            <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-sky-500/15">
                <UIcon name="i-lucide-party-popper" class="size-7 text-sky-400" />
            </div>
            <h1 class="text-2xl font-semibold text-white">
                Welcome to Delivr<span v-if="firstName">, {{ firstName }}</span>
            </h1>
            <p class="mx-auto mt-2 max-w-md text-sm text-slate-400">
                Let's set a few preferences for how mail behaves. These apply across your whole account —
                you can change them any time in Settings.
            </p>
        </div>

        <!-- Preferences -->
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <UIcon name="i-lucide-settings-2" class="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">Preferences</h3>
                        <p class="text-sm text-slate-400">How mail and folders behave</p>
                    </div>
                </div>
            </div>
            <div class="p-6 space-y-6">
                <UFormField
                    label="Auto-mark as read"
                    description="Automatically mark an email as read shortly after you open it."
                    class="flex max-sm:flex-col justify-between items-start gap-4"
                    :ui="{ root: 'w-full sm:w-auto', container: 'w-full sm:w-auto' }"
                >
                    <UCheckbox v-model="prefs.autoMarkSeen" />
                </UFormField>

                <USeparator />

                <UFormField
                    label="Nest folders under Inbox"
                    description="Show sub-folders of the Inbox nested beneath it, instead of as top-level folders."
                    class="flex max-sm:flex-col justify-between items-start gap-4"
                    :ui="{ root: 'w-full sm:w-auto', container: 'w-full sm:w-auto' }"
                >
                    <UCheckbox v-model="prefs.nestUnderInbox" />
                </UFormField>

                <USeparator />

                <UFormField
                    label="Drag-and-drop folders"
                    description="Reorganise folders by dragging them in the sidebar — onto another folder to nest, or into the empty space to move to the top level."
                    class="flex max-sm:flex-col justify-between items-start gap-4"
                    :ui="{ root: 'w-full sm:w-auto', container: 'w-full sm:w-auto' }"
                >
                    <UCheckbox v-model="prefs.folderDragDrop" />
                </UFormField>
            </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between gap-3">
            <UButton
                label="Skip for now"
                color="neutral"
                variant="ghost"
                :disabled="finishing"
                @click="complete(false)"
            />
            <UButton
                label="Save & continue"
                color="primary"
                trailing-icon="i-lucide-arrow-right"
                :loading="finishing"
                @click="complete(true)"
            />
        </div>
    </div>
</template>
