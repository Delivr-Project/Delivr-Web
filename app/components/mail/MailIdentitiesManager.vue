<script lang="ts" setup>
import type { MailIdentity } from '~/utils/types';
import { zPostMailAccountsByMailAccountIdIdentitiesBody } from '~/api-client/zod.gen';
import { MailIdentityUtils } from '~/utils/mail/mailIdentity';

const props = withDefaults(defineProps<{
    accountId: number;
    /**
     * Prefill for a first identity — normally the account's own SMTP address.
     * It is only offered while the account has no identities yet.
     */
    suggestion?: { display_name?: string; email_address?: string };
    title?: string;
    description?: string;
}>(), {
    title: 'Sender identities',
    description: 'Extra addresses you can send from with this account'
});

const emit = defineEmits<{ change: [] }>();

const toast = useToast();

// Create and update take the same three fields; the update endpoint accepts
// them partially, so the stricter create schema validates both forms.
const formSchema = zPostMailAccountsByMailAccountIdIdentitiesBody;

const identities = ref<MailIdentity[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
    loading.value = true;
    const res = await useAPI((api) => api.getMailAccountsByMailAccountIdIdentities({
        path: { mailAccountID: props.accountId }
    }));
    identities.value = res.success ? res.data : [];
    loading.value = false;
}

// Also covers the component being pointed at another account.
watch(() => props.accountId, () => { load(); }, { immediate: true });

defineExpose({ reload: load });

// A mail account must keep at least one address to send from — the backend
// refuses the last delete too, this only keeps the UI honest about it.
const canDelete = computed(() => MailIdentityUtils.canDelete(identities.value));

// The suggestion is dropped once that address has an identity of its own.
const suggestedIdentity = computed(() => {
    const suggestion = props.suggestion;
    if (!suggestion?.email_address) return null;
    return MailIdentityUtils.suggestionFor(
        { display_name: suggestion.display_name, smtp_username: suggestion.email_address },
        identities.value
    );
});

// ── Create / edit ───────────────────────────────────────────────────────────

const formOpen = ref(false);
const editing = ref<MailIdentity | null>(null);
const saving = ref(false);
const formState = reactive({ display_name: '', email_address: '', is_default: false });

function openCreate(prefill?: { display_name: string; email_address: string }): void {
    editing.value = null;
    formState.display_name = prefill?.display_name ?? '';
    formState.email_address = prefill?.email_address ?? '';
    // The first identity is the one compose picks, so default it on.
    formState.is_default = identities.value.length === 0;
    formOpen.value = true;
}

function openEdit(identity: MailIdentity): void {
    editing.value = identity;
    formState.display_name = identity.display_name;
    formState.email_address = identity.email_address;
    formState.is_default = identity.is_default;
    formOpen.value = true;
}

async function onFormSubmit(): Promise<void> {
    const target = editing.value;
    const body = {
        display_name: formState.display_name.trim(),
        email_address: formState.email_address.trim(),
        is_default: formState.is_default
    };

    if (MailIdentityUtils.findDuplicate(identities.value, body.email_address, target?.id)) {
        toast.add({
            title: 'Address already in use',
            description: `${body.email_address} is already set up as an identity for this account.`,
            icon: 'i-lucide-x-circle',
            color: 'error'
        });
        return;
    }

    saving.value = true;

    try {
        const res = target
            ? await useAPI((api) => api.putMailAccountsByMailAccountIdIdentitiesByMailIdentityId({
                path: { mailAccountID: props.accountId, mailIdentityID: target.id },
                body
            }))
            : await useAPI((api) => api.postMailAccountsByMailAccountIdIdentities({
                path: { mailAccountID: props.accountId },
                body
            }));

        if (!res.success) throw new Error(res.message || 'Failed to save the identity.');

        toast.add({
            title: target ? 'Identity updated' : 'Identity added',
            description: `${body.display_name} <${body.email_address}> has been saved.`,
            icon: 'i-lucide-check',
            color: 'success'
        });

        formOpen.value = false;
        await load();
        emit('change');
    } catch (error: any) {
        toast.add({
            title: 'Error',
            description: error.message || 'An unexpected error occurred.',
            icon: 'i-lucide-x-circle',
            color: 'error'
        });
    }

    saving.value = false;
}

// ── Default ─────────────────────────────────────────────────────────────────

// The API clears the flag on the other identities of this account itself.
const defaultingId = ref<number | null>(null);

async function makeDefault(identity: MailIdentity): Promise<void> {
    defaultingId.value = identity.id;

    try {
        const res = await useAPI((api) => api.putMailAccountsByMailAccountIdIdentitiesByMailIdentityId({
            path: { mailAccountID: props.accountId, mailIdentityID: identity.id },
            body: { is_default: true }
        }));
        if (!res.success) throw new Error(res.message || 'Failed to set the default identity.');

        await load();
        emit('change');
    } catch (error: any) {
        toast.add({
            title: 'Error',
            description: error.message || 'An unexpected error occurred.',
            icon: 'i-lucide-x-circle',
            color: 'error'
        });
    }

    defaultingId.value = null;
}

// ── Delete ──────────────────────────────────────────────────────────────────

const deleteOpen = ref(false);
const deleteTarget = ref<MailIdentity | null>(null);
const deleting = ref(false);

function openDelete(identity: MailIdentity): void {
    deleteTarget.value = identity;
    deleteOpen.value = true;
}

async function confirmDelete(): Promise<void> {
    const target = deleteTarget.value;
    if (!target || !canDelete.value) return;

    deleting.value = true;

    try {
        const res = await useAPI((api) => api.deleteMailAccountsByMailAccountIdIdentitiesByMailIdentityId({
            path: { mailAccountID: props.accountId, mailIdentityID: target.id }
        }));
        if (!res.success) throw new Error(res.message || 'Failed to delete the identity.');

        toast.add({
            title: 'Identity removed',
            description: `${target.display_name} <${target.email_address}> has been removed.`,
            icon: 'i-lucide-check',
            color: 'success'
        });

        deleteOpen.value = false;
        await load();
        emit('change');
    } catch (error: any) {
        toast.add({
            title: 'Error',
            description: error.message || 'An unexpected error occurred.',
            icon: 'i-lucide-x-circle',
            color: 'error'
        });
    }

    deleting.value = false;
}
</script>

<template>
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-800">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                        <UIcon name="i-lucide-user-round-pen" class="w-5 h-5 text-sky-400" />
                    </div>
                    <div class="min-w-0">
                        <h3 class="font-medium text-white">{{ title }}</h3>
                        <p class="text-sm text-slate-400">{{ description }}</p>
                    </div>
                </div>
                <UButton
                    label="Add identity"
                    icon="i-lucide-plus"
                    color="primary"
                    variant="soft"
                    size="sm"
                    class="shrink-0"
                    @click="openCreate()"
                />
            </div>
        </div>

        <div class="divide-y divide-slate-800">
            <div v-if="loading && identities.length === 0" class="px-6 py-8 flex items-center justify-center">
                <UIcon name="i-lucide-loader-2" class="animate-spin text-xl text-slate-400" />
            </div>

            <div
                v-for="identity in identities"
                :key="identity.id"
                class="flex items-center gap-3 px-6 py-3"
            >
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                        <span class="truncate text-sm text-white">{{ identity.display_name }}</span>
                        <UBadge v-if="identity.is_default" color="primary" variant="subtle" size="xs" class="shrink-0">
                            Default
                        </UBadge>
                    </div>
                    <p class="truncate text-xs text-slate-400">{{ identity.email_address }}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <UButton
                        v-if="!identity.is_default"
                        icon="i-lucide-star"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        aria-label="Make default"
                        :loading="defaultingId === identity.id"
                        @click="makeDefault(identity)"
                    />
                    <UButton
                        icon="i-lucide-pencil"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        aria-label="Edit identity"
                        @click="openEdit(identity)"
                    />
                    <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        aria-label="Delete identity"
                        :disabled="!canDelete"
                        :title="canDelete ? undefined : 'A mail account needs at least one identity'"
                        @click="openDelete(identity)"
                    />
                </div>
            </div>

            <div v-if="!canDelete && identities.length === 1" class="px-6 py-3 text-xs text-slate-400">
                A mail account needs at least one identity. Add another one to replace this address,
                or edit it in place.
            </div>

            <div v-if="!loading && identities.length === 0" class="px-6 py-8 text-center">
                <UIcon name="i-lucide-user-round-plus" class="mx-auto mb-2 size-6 text-slate-500" />
                <p class="text-sm text-slate-400">
                    No identities yet — mail is sent from the account's own address.
                </p>
                <UButton
                    v-if="suggestedIdentity"
                    class="mt-3"
                    :label="`Use ${suggestedIdentity.email_address}`"
                    icon="i-lucide-plus"
                    color="primary"
                    variant="soft"
                    size="sm"
                    @click="openCreate(suggestedIdentity)"
                />
            </div>
        </div>

        <!-- Create / edit modal -->
        <DashboardModal
            v-model:open="formOpen"
            :title="editing ? 'Edit identity' : 'Add identity'"
            :description="editing ? 'Change how this sender address appears.' : 'Add another address you can send from.'"
            icon="i-lucide-user-round-pen"
            icon-color="sky"
        >
            <UForm
                id="mail-identity-form"
                class="space-y-4"
                :schema="formSchema"
                :state="formState"
                @submit="onFormSubmit()"
                @error="useDefaultOnFormError()"
            >
                <UFormField name="display_name" label="Display name" required class="flex flex-col gap-1">
                    <UInput v-model="formState.display_name" placeholder="Jane Doe" class="w-full" />
                </UFormField>

                <UFormField name="email_address" label="Email address" required class="flex flex-col gap-1">
                    <UInput v-model="formState.email_address" type="email" placeholder="jane@example.com" class="w-full" />
                </UFormField>

                <UFormField
                    name="is_default"
                    label="Default identity"
                    description="Preselect this address when composing a message."
                    class="flex items-start justify-between gap-4"
                >
                    <UCheckbox v-model="formState.is_default" />
                </UFormField>
            </UForm>

            <template #footer>
                <div class="flex justify-end gap-3">
                    <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { formOpen = false }" />
                    <UButton
                        :label="editing ? 'Save changes' : 'Add identity'"
                        color="primary"
                        type="submit"
                        form="mail-identity-form"
                        icon="i-lucide-check"
                        :loading="saving"
                    />
                </div>
            </template>
        </DashboardModal>

        <!-- Delete confirmation -->
        <DashboardModal
            v-model:open="deleteOpen"
            title="Remove identity"
            description="This action is permanent"
            icon="i-lucide-alert-triangle"
            icon-color="error"
        >
            <div class="p-4 rounded-lg bg-red-950/50 border border-red-900/50">
                <p class="text-sm text-red-300">
                    <strong>Warning:</strong>
                    This removes
                    <strong>{{ deleteTarget?.display_name }} &lt;{{ deleteTarget?.email_address }}&gt;</strong>
                    as a sender address. Messages already sent from it are not affected.
                </p>
            </div>

            <template #footer>
                <div class="flex justify-end gap-3">
                    <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { deleteOpen = false }" />
                    <UButton
                        label="Remove identity"
                        color="error"
                        icon="i-lucide-trash-2"
                        :loading="deleting"
                        @click="confirmDelete()"
                    />
                </div>
            </template>
        </DashboardModal>
    </div>
</template>
