<script lang="ts" setup>
import type { Mailbox } from '~/utils/types';
import type {
    GetMailAccountsByMailAccountIdSpecialUseResponse,
    PutMailAccountsByMailAccountIdSpecialUseData,
} from '~/api-client';
import { MailboxDisplayUtils } from '~/utils/mailboxDisplay';
import { useMailAccountsStore } from '~/composables/stores/useMailAccountsStore';

// The resolved special-use mapping the API returns (type → { path, source }).
type SpecialUseMapping = GetMailAccountsByMailAccountIdSpecialUseResponse['data'];

const toast = useToast();
const route = useRoute();

const accountId = Number(route.params.mailAccountID);

const mailAccountsStore = useMailAccountsStore();
// The account was just created and the store refreshed before we navigated
// here, so it (and its mailboxes) are already in the shared store state.
const account = await mailAccountsStore.getByID(accountId);

const notFound = computed(() => !Number.isFinite(accountId) || !account.value);
const displayName = computed(() => account.value?.display_name || 'your mail account');
const mailboxes = computed<Mailbox[]>(() => account.value?.mailboxes ?? []);
const defaultDelimiter = computed(() => mailboxes.value[0]?.delimiter || '/');

useSeoMeta({
    title: 'Set up your Mail Account | Delivr',
    description: 'Finish setting up your new mail account by mapping its special folders.',
});

// ── Special folders ─────────────────────────────────────────────────────────
// Mirrors the mapping UI on the account's Folders tab, trimmed to the initial
// setup: pick which real folder is treated as Drafts / Sent / Spam / Trash /
// Archive. Leaving a type on "Auto-detect" keeps the backend's own resolution.

const NONE = '__none__';
const isInbox = (mb: Mailbox) => MailboxDisplayUtils.isInbox(mb);
const leaf = (mb: Mailbox) => MailboxDisplayUtils.leafName(mb);

type FolderOption = { label: string; value: string; depth: number; disabled?: boolean };

// Number of path segments minus one (depth 0 = top level). Computed from the
// real IMAP path rather than the backend's `parent` array, which some servers
// return empty.
function folderDepth(mb: Mailbox): number {
    const delimiter = mb.delimiter || defaultDelimiter.value;
    return mb.path.split(delimiter).filter(Boolean).length - 1;
}

function isInInboxTree(mb: Mailbox, inbox?: Mailbox): boolean {
    if (!inbox) return false;
    const delimiter = inbox.delimiter || defaultDelimiter.value;
    return mb.path === inbox.path || mb.path.startsWith(inbox.path + delimiter);
}

// Depth-first ordering by real path so children sit under their ancestors.
const sortedMailboxes = computed<Mailbox[]>(() => {
    const list = mailboxes.value.slice();
    const delimiter = defaultDelimiter.value;
    const inbox = list.find(isInbox);
    list.sort((a, b) => {
        const aInInbox = isInInboxTree(a, inbox);
        const bInInbox = isInInboxTree(b, inbox);
        if (aInInbox && !bInInbox) return -1;
        if (!aInInbox && bInInbox) return 1;

        const da = a.delimiter || delimiter;
        const db = b.delimiter || delimiter;
        return a.path.split(da).filter(Boolean).join('/')
            .localeCompare(b.path.split(db).filter(Boolean).join('/'));
    });
    return list;
});

// Inbox is included as a disabled item so its sub-folders stay anchored to it.
const specialFolderOptions = computed<FolderOption[]>(() =>
    sortedMailboxes.value.map((mb) => ({
        label: isInbox(mb) ? 'Inbox' : leaf(mb),
        value: mb.path,
        depth: folderDepth(mb),
        disabled: isInbox(mb),
    }))
);

const SPECIAL_TYPES = [
    { key: 'drafts', label: 'Drafts', icon: 'i-lucide-file-edit' },
    { key: 'sent', label: 'Sent', icon: 'i-lucide-send' },
    { key: 'spam', label: 'Spam', icon: 'i-lucide-shield-alert' },
    { key: 'trash', label: 'Trash', icon: 'i-lucide-trash-2' },
    { key: 'archive', label: 'Archive', icon: 'i-lucide-archive' },
] as const;
type SpecialType = (typeof SPECIAL_TYPES)[number]['key'];

const specialUse = ref<SpecialUseMapping>({});
const specialState = reactive<Record<SpecialType, string>>({ drafts: NONE, sent: NONE, spam: NONE, trash: NONE, archive: NONE });

function storedValue(key: SpecialType): string {
    return specialUse.value[key]?.path ?? NONE;
}

async function loadSpecialUse() {
    if (notFound.value) return;
    const res = await useAPI((api) => api.getMailAccountsByMailAccountIdSpecialUse({ path: { mailAccountID: accountId } }));
    if (res.success) {
        specialUse.value = res.data;
        for (const { key } of SPECIAL_TYPES) specialState[key] = storedValue(key);
    }
}
await loadSpecialUse();

// A folder can only be one special type: picking it for one releases it from any
// other type that currently holds it.
function onSpecialSelect(type: SpecialType, value: string) {
    if (value !== NONE) {
        for (const { key } of SPECIAL_TYPES) {
            if (key !== type && specialState[key] === value) specialState[key] = NONE;
        }
    }
    specialState[type] = value;
}

function sourceLabel(key: SpecialType): string | null {
    const src = specialUse.value[key]?.source;
    if (!src) return null;
    return src === 'user' ? 'Manual' : 'Auto';
}

// The NONE sentinel is never shown as a label — it renders the placeholder.
function selectDisplayValue(type: SpecialType): string | undefined {
    return specialState[type] === NONE ? undefined : specialState[type];
}

async function saveSpecialUse(): Promise<void> {
    if (notFound.value) return;
    const body: PutMailAccountsByMailAccountIdSpecialUseData['body'] = {};
    let changed = false;
    for (const { key } of SPECIAL_TYPES) {
        if (specialState[key] === storedValue(key)) continue;
        changed = true;
        // A real path assigns the folder; NONE reverts to backend auto-detection.
        body[key] = specialState[key] !== NONE ? specialState[key] : null;
    }
    if (!changed) return;

    const res = await useAPI((api) => api.putMailAccountsByMailAccountIdSpecialUse({
        path: { mailAccountID: accountId },
        body,
    }));
    if (!res.success) throw new Error(res.message || 'Failed to save special folders.');
    specialUse.value = res.data;
}

const finishing = ref(false);

async function finish() {
    finishing.value = true;
    try {
        await saveSpecialUse();
        // Mailbox icons/behaviour depend on the resolved special-folder mapping.
        await mailAccountsStore.refresh();
        toast.add({
            title: "You're all set",
            description: `${displayName.value} is ready to use.`,
            icon: 'i-lucide-party-popper',
            color: 'success',
        });
        await navigateTo(`/mail/${accountId}/folder/inbox`);
    } catch (error: any) {
        toast.add({
            title: 'Error',
            description: error.message || 'An unexpected error occurred while saving your folders.',
            icon: 'i-lucide-x-circle',
            color: 'error',
        });
        finishing.value = false;
    }
}

async function skip() {
    // Auto-detected folders already apply, so skipping leaves them as-is.
    await navigateTo(`/mail/${accountId}/folder/inbox`);
}
</script>

<template>
    <UDashboardPanel id="mail-account-onboarding" :ui="{ body: 'lg:py-12 w-full lg:max-w-3xl mx-auto' }">
        <template #header>
            <DashboardPageHeader
                title="Set up your Mail Account"
                icon="i-lucide-sparkles"
                :breadcrumb-items="[
                    { label: 'Manage Mail Accounts', to: '/settings/mail-accounts' },
                    { label: 'Set up' },
                ]"
            />
        </template>

        <template #body>
            <DashboardPageBody>
                <!-- Account missing (e.g. opened directly / deleted) -->
                <div v-if="notFound" class="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center">
                    <UIcon name="i-lucide-mail-question" class="mx-auto mb-3 size-8 text-slate-500" />
                    <h2 class="text-lg font-semibold text-white">Mail account not found</h2>
                    <p class="mt-1 text-sm text-slate-400">This account may have been removed, or the link is no longer valid.</p>
                    <UButton class="mt-4" label="Back to Mail Accounts" color="primary" to="/settings/mail-accounts" />
                </div>

                <div v-else class="space-y-6 w-full">
                    <!-- Welcome -->
                    <div class="rounded-xl border border-slate-800 bg-gradient-to-b from-sky-500/10 to-transparent p-6">
                        <div class="flex items-start gap-4">
                            <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
                                <UIcon name="i-lucide-party-popper" class="size-6 text-sky-400" />
                            </div>
                            <div>
                                <h2 class="text-xl font-semibold text-white">
                                    {{ displayName }} is connected
                                </h2>
                                <p class="mt-1 text-sm text-slate-400">
                                    Confirm which folders map to your special folders and you're ready to go.
                                    You can change these later from the account's Folders settings.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Special folders -->
                    <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                        <div class="px-6 py-4 border-b border-slate-800">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                                    <UIcon name="i-lucide-folder-tree" class="w-5 h-5 text-sky-400" />
                                </div>
                                <div>
                                    <h3 class="font-medium text-white">Special folders</h3>
                                    <p class="text-sm text-slate-400">
                                        We've auto-detected these. Override any that look wrong.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div class="p-6 space-y-4">
                            <div v-for="type in SPECIAL_TYPES" :key="type.key" class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <div class="flex items-center gap-2 sm:w-40 shrink-0">
                                    <UIcon :name="type.icon" class="w-4 h-4 text-slate-400" />
                                    <span class="text-sm text-white">{{ type.label }}</span>
                                    <UBadge v-if="sourceLabel(type.key)" :color="sourceLabel(type.key) === 'Manual' ? 'primary' : 'neutral'" variant="subtle" size="xs">
                                        {{ sourceLabel(type.key) }}
                                    </UBadge>
                                </div>
                                <USelect
                                    :model-value="selectDisplayValue(type.key)"
                                    :items="specialFolderOptions"
                                    placeholder="Auto-detect"
                                    class="flex-1"
                                    @update:model-value="(v: string) => onSpecialSelect(type.key, v)"
                                >
                                    <template #item-label="{ item }">
                                        <span :style="{ paddingInlineStart: ((item as FolderOption).depth * 16) + 'px' }">{{ item.label }}</span>
                                    </template>
                                </USelect>
                            </div>
                            <p v-if="mailboxes.length === 0" class="text-sm text-slate-400">
                                No folders were found for this account yet.
                            </p>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center justify-between gap-3">
                        <UButton
                            label="Skip for now"
                            color="neutral"
                            variant="ghost"
                            :disabled="finishing"
                            @click="skip"
                        />
                        <UButton
                            label="Finish setup"
                            color="primary"
                            icon="i-lucide-check"
                            :loading="finishing"
                            @click="finish"
                        />
                    </div>
                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>
