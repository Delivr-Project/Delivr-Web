<script lang="ts" setup>
import type { MailAccountWithMailboxes, Mailbox } from '~/utils/types';
import type { GetMailAccountsByMailAccountIdSpecialUseResponse, PutMailAccountsByMailAccountIdSpecialUseData } from '~/api-client';
import { MailboxDisplayUtils } from '~/utils/mailboxDisplay';

// The resolved special-use mapping the API returns (type → { path, source }).
type SpecialUseMapping = GetMailAccountsByMailAccountIdSpecialUseResponse['data'];

const toast = useToast();

const injected = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const account = injected.data as Ref<MailAccountWithMailboxes>;
const refreshAccounts = injected.refresh ?? (async () => {});

const accountId = computed(() => account.value.id);
const mailboxes = computed<Mailbox[]>(() => account.value.mailboxes ?? []);
// The server's hierarchy delimiter (used when creating a top-level folder).
const defaultDelimiter = computed(() => mailboxes.value[0]?.delimiter || '/');

// ── Helpers ─────────────────────────────────────────────────────────────────

// reka-ui's <USelect> rejects an item whose value is an empty string, so
// "no selection" (top-level parent / unset special folder) uses this sentinel,
// translated back to "" (or an explicit none) at the edges. A real IMAP path
// can never equal it.
const NONE = '__none__';
const asParent = (v: string) => (v === NONE ? '' : v);

const isInbox = (mb: Mailbox) => MailboxDisplayUtils.isInbox(mb);
const leaf = (mb: Mailbox) => MailboxDisplayUtils.leafName(mb);
// Nesting depth (rendered as left padding on the dropdown items - see each
// picker's #item-label slot). The option label stays the bare leaf name so the
// closed <USelect> shows the selected folder flush-left, with no leading spaces.
type FolderOption = { label: string; value: string; depth: number };

// The real leaf segment of a path (not the display name).
function pathLeaf(mb: Mailbox): string {
    return mb.path.split(mb.delimiter).pop() || mb.path;
}

// Parent-folder options for a create/move picker. When `folder` is given, its
// own subtree is excluded (a folder can't move into itself or a descendant).
function parentOptions(folder?: Mailbox) {
    const opts: FolderOption[] = [{ label: 'Top level (no parent)', value: NONE, depth: 0 }];
    for (const mb of mailboxes.value) {
        if (folder && (mb.path === folder.path || mb.path.startsWith(folder.path + folder.delimiter))) continue;
        opts.push({ label: leaf(mb), value: mb.path, depth: mb.parent.length });
    }
    return opts;
}

// Folders as a flat option list for the special-use pickers. Only the optional
// archive folder offers "Not set" — required types (drafts/sent/spam/trash) must
// map to a folder (or fall back to auto-detection), never be unset by the user.
const folderItems = computed<FolderOption[]>(() => mailboxes.value.map((mb) => ({ label: leaf(mb), value: mb.path, depth: mb.parent.length })));
function folderOptionsFor(type: SpecialType): FolderOption[] {
    return folderItems.value;
}

function parentPathToChildPath(parentPath: string, name: string): string {
    if (!parentPath) return name;
    const parent = mailboxes.value.find((mb) => mb.path === parentPath);
    const delimiter = parent?.delimiter || defaultDelimiter.value;
    return parentPath + delimiter + name;
}

async function runMutation(fn: () => Promise<any>, successTitle: string, successDesc: string) {
    try {
        const result = await fn();
        if (!result.success) throw new Error(result.message || 'The operation failed.');
        toast.add({ title: successTitle, description: successDesc, icon: 'i-lucide-check', color: 'success' });
        await refreshAccounts();
        return true;
    } catch (error: any) {
        toast.add({ title: 'Error', description: error.message || 'An unexpected error occurred.', icon: 'i-lucide-x-circle', color: 'error' });
        return false;
    }
}

// ── Create ────────────────────────────────────────────────────────────────
const createName = ref('');
const createParent = ref(NONE);
const creating = ref(false);

async function createFolder() {
    const name = createName.value.trim();
    if (!name) return;
    creating.value = true;
    const path = parentPathToChildPath(asParent(createParent.value), name);
    const ok = await runMutation(
        () => useAPI((api) => api.postMailAccountsByMailAccountIdMailboxes({
            path: { mailAccountID: accountId.value },
            body: { path },
        })),
        'Folder created',
        `"${name}" was created.`,
    );
    if (ok) { createName.value = ''; createParent.value = NONE; }
    creating.value = false;
}

// ── Rename ────────────────────────────────────────────────────────────────
const renameTarget = ref<Mailbox | null>(null);
const renameName = ref('');
const renameOpen = ref(false);
const renameLoading = ref(false);

function openRename(mb: Mailbox) {
    renameTarget.value = mb;
    renameName.value = pathLeaf(mb);
    renameOpen.value = true;
}

async function confirmRename() {
    const mb = renameTarget.value;
    const name = renameName.value.trim();
    if (!mb || !name) return;
    renameLoading.value = true;
    // Replace only the leaf segment, keeping the folder in place.
    const parts = mb.path.split(mb.delimiter);
    parts[parts.length - 1] = name;
    const newPath = parts.join(mb.delimiter);
    const ok = await runMutation(
        () => useAPI((api) => api.putMailAccountsByMailAccountIdMailboxesByMailboxPath({
            path: { mailAccountID: accountId.value, mailboxPath: mb.path },
            body: { path: newPath },
        })),
        'Folder renamed',
        `Renamed to "${name}".`,
    );
    renameLoading.value = false;
    if (ok) renameOpen.value = false;
}

// ── Move ──────────────────────────────────────────────────────────────────
const moveTarget = ref<Mailbox | null>(null);
const moveParent = ref('');
const moveOpen = ref(false);
const moveLoading = ref(false);

function openMove(mb: Mailbox) {
    moveTarget.value = mb;
    moveParent.value = mb.parentPath || NONE;
    moveOpen.value = true;
}

const moveParentOptions = computed(() => parentOptions(moveTarget.value ?? undefined));

async function confirmMove() {
    const mb = moveTarget.value;
    if (!mb) return;
    const newPath = parentPathToChildPath(asParent(moveParent.value), pathLeaf(mb));
    if (newPath === mb.path) { moveOpen.value = false; return; }
    moveLoading.value = true;
    const dest = moveParent.value !== NONE ? `"${leaf(mailboxes.value.find((m) => m.path === moveParent.value)!)}"` : 'the top level';
    const ok = await runMutation(
        () => useAPI((api) => api.putMailAccountsByMailAccountIdMailboxesByMailboxPath({
            path: { mailAccountID: accountId.value, mailboxPath: mb.path },
            body: { path: newPath },
        })),
        'Folder moved',
        `"${leaf(mb)}" moved to ${dest}.`,
    );
    moveLoading.value = false;
    if (ok) moveOpen.value = false;
}

// ── Delete ────────────────────────────────────────────────────────────────
const deleteTarget = ref<Mailbox | null>(null);
const deleteOpen = ref(false);

function openDelete(mb: Mailbox) {
    deleteTarget.value = mb;
    deleteOpen.value = true;
}

async function confirmDelete() {
    const mb = deleteTarget.value;
    if (!mb) return;
    await runMutation(
        () => useAPI((api) => api.deleteMailAccountsByMailAccountIdMailboxesByMailboxPath({
            path: { mailAccountID: accountId.value, mailboxPath: mb.path },
        })),
        'Folder deleted',
        `"${leaf(mb)}" was deleted.`,
    );
    deleteOpen.value = false;
}

// ── Special-use mapping ─────────────────────────────────────────────────────
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
const savingSpecial = ref(false);

// Why a type currently sits at NONE: 'auto' = it was displaced when its folder was
// assigned to another type, or the user hit the revert button (re-detect).
const noneIntent = reactive<Partial<Record<SpecialType, 'auto'>>>({});

// The stored path for a type, or the NONE sentinel (missing entry, or an explicit
// user "none" whose path is null).
function storedValue(key: SpecialType): string {
    return specialUse.value[key]?.path ?? NONE;
}

function syncSpecialState() {
    for (const { key } of SPECIAL_TYPES) {
        specialState[key] = storedValue(key);
        delete noneIntent[key];
    }
}

// A folder can only be one special type: when a folder is picked for one type,
// release it from any other type that currently holds it.
function onSpecialSelect(type: SpecialType, value: string) {
    if (value !== NONE) {
        for (const { key } of SPECIAL_TYPES) {
            if (key !== type && specialState[key] === value) {
                specialState[key] = NONE;
                noneIntent[key] = 'auto';   // displaced → let the backend re-detect
            }
        }
    }
    delete noneIntent[type];
    specialState[type] = value;
}

async function loadSpecialUse() {
    const res = await useAPI((api) => api.getMailAccountsByMailAccountIdSpecialUse({ path: { mailAccountID: accountId.value } }));
    if (res.success) { specialUse.value = res.data; syncSpecialState(); }
}
await loadSpecialUse();

const specialDirty = computed(() => SPECIAL_TYPES.some(({ key }) => specialState[key] !== storedValue(key)));

function sourceLabel(key: SpecialType): string | null {
    const src = specialUse.value[key]?.source;
    if (!src) return null;
    return src === 'user' ? 'Manual' : 'Auto';
}

function revertSpecialUse(type: SpecialType) {
    specialState[type] = NONE;
    noneIntent[type] = 'auto';
}

// Render the <USelect> value. The internal NONE sentinel is never shown as a label;
// it always renders the "Auto-detect" placeholder.
function selectDisplayValue(type: SpecialType): string | undefined {
    return specialState[type] === NONE ? undefined : specialState[type];
}

async function saveSpecialUse() {
    savingSpecial.value = true;
    const body: PutMailAccountsByMailAccountIdSpecialUseData['body'] = {};
    for (const { key } of SPECIAL_TYPES) {
        if (specialState[key] === storedValue(key)) continue;
        if (specialState[key] !== NONE) {
            body[key] = specialState[key];
        } else {
            // Revert to auto-detection: null tells the backend to re-discover this
            // special folder. The API accepts null for all types.
            body[key] = null;
        }
    }
    try {
        const res = await useAPI((api) => api.putMailAccountsByMailAccountIdSpecialUse({
            path: { mailAccountID: accountId.value },
            body,
        }));
        if (!res.success) throw new Error(res.message || 'Failed to save special folders.');
        specialUse.value = res.data;
        syncSpecialState();
        toast.add({ title: 'Special folders saved', description: 'Your special-folder mapping has been updated.', icon: 'i-lucide-check', color: 'success' });
        // Mailbox icons/behaviour depend on the resolved mapping — refresh them.
        await refreshAccounts();
    } catch (error: any) {
        toast.add({ title: 'Error', description: error.message || 'An unexpected error occurred.', icon: 'i-lucide-x-circle', color: 'error' });
    }
    savingSpecial.value = false;
}
</script>

<template>
    <div class="space-y-6 w-full lg:w-3xl mx-auto">
        <div>
            <h2 class="text-xl font-semibold text-white">Folders</h2>
            <p class="text-sm text-slate-400 mt-1">Create, move and delete folders, and set which folders are your special folders.</p>
        </div>

        <!-- Create folder -->
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <UIcon name="i-lucide-folder-plus" class="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">Create folder</h3>
                        <p class="text-sm text-slate-400">Add a new folder, optionally inside another</p>
                    </div>
                </div>
            </div>
            <div class="p-6">
                <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <UFormField label="Name" class="flex flex-col gap-1 flex-1">
                        <UInput v-model="createName" placeholder="Folder name" class="w-full" @keydown.enter="createFolder" />
                    </UFormField>
                    <UFormField label="Parent" class="flex flex-col gap-1 flex-1">
                        <USelect v-model="createParent" :items="parentOptions()" class="w-full">
                            <template #item-label="{ item }">
                                <span :style="{ paddingInlineStart: ((item as FolderOption).depth * 16) + 'px' }">{{ item.label }}</span>
                            </template>
                        </USelect>
                    </UFormField>
                    <UButton label="Create" icon="i-lucide-plus" color="primary" :loading="creating" :disabled="!createName.trim()" @click="createFolder" />
                </div>
            </div>
        </div>

        <!-- Folder list -->
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <UIcon name="i-lucide-folders" class="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">All folders</h3>
                        <p class="text-sm text-slate-400">Rename, move or delete a folder</p>
                    </div>
                </div>
            </div>
            <div class="divide-y divide-slate-800">
                <div v-for="mb in mailboxes" :key="mb.path" class="flex items-center gap-2 px-6 py-3">
                    <span :style="{ paddingLeft: (mb.parent.length * 16) + 'px' }" class="flex items-center gap-2 min-w-0 flex-1">
                        <UIcon :name="MailboxDisplayUtils.specialUseIcon(mb.specialUse)" class="w-4 h-4 text-slate-400 shrink-0" />
                        <span class="truncate text-sm text-white">{{ leaf(mb) }}</span>
                        <UBadge v-if="mb.specialUse && !isInbox(mb)" color="neutral" variant="subtle" size="xs" class="shrink-0">
                            {{ mb.specialUse.replace(/^\\/, '').toLowerCase() }}
                        </UBadge>
                    </span>
                    <div v-if="!isInbox(mb)" class="flex items-center gap-1 shrink-0">
                        <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" aria-label="Rename" @click="openRename(mb)" />
                        <UButton icon="i-lucide-folder-input" color="neutral" variant="ghost" size="xs" aria-label="Move" @click="openMove(mb)" />
                        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" aria-label="Delete" @click="openDelete(mb)" />
                    </div>
                    <UBadge v-else color="primary" variant="subtle" size="xs" class="shrink-0">Inbox</UBadge>
                </div>
                <div v-if="mailboxes.length === 0" class="px-6 py-8 text-center text-sm text-slate-400">No folders found.</div>
            </div>
        </div>

        <!-- Special folders -->
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <UIcon name="i-lucide-sparkles" class="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h3 class="font-medium text-white">Special folders</h3>
                        <p class="text-sm text-slate-400">Override which folders Delivr treats as Drafts, Sent, Spam, Trash and Archive</p>
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
                    <div class="flex items-center gap-2 flex-1">
                        <USelect :model-value="selectDisplayValue(type.key)" :items="folderOptionsFor(type.key)" placeholder="Auto-detect" class="flex-1" @update:model-value="(v: string) => onSpecialSelect(type.key, v)">
                            <template #item-label="{ item }">
                                <span :style="{ paddingInlineStart: ((item as FolderOption).depth * 16) + 'px' }">{{ item.label }}</span>
                            </template>
                        </USelect>
                        <UButton
                            icon="i-lucide-rotate-ccw"
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            aria-label="Revert to auto-detect"
                            :disabled="specialUse[type.key]?.source !== 'user'"
                            @click="revertSpecialUse(type.key)"
                        />
                    </div>
                </div>
                <div class="flex justify-end pt-2">
                    <UButton label="Save special folders" icon="i-lucide-save" color="primary" :loading="savingSpecial" :disabled="!specialDirty" @click="saveSpecialUse" />
                </div>
            </div>
        </div>

        <!-- Rename modal -->
        <DashboardModal v-model:open="renameOpen" title="Rename folder" icon="i-lucide-pencil" icon-color="sky">
            <UFormField label="New name" class="flex flex-col gap-1">
                <UInput v-model="renameName" class="w-full" @keydown.enter="confirmRename" />
            </UFormField>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { renameOpen = false }" />
                    <UButton label="Rename" color="primary" icon="i-lucide-check" :loading="renameLoading" :disabled="!renameName.trim()" @click="confirmRename" />
                </div>
            </template>
        </DashboardModal>

        <!-- Move modal -->
        <DashboardModal v-model:open="moveOpen" title="Move folder" icon="i-lucide-folder-input" icon-color="sky">
            <p class="text-sm text-muted mb-3">Choose a new parent for "{{ moveTarget ? leaf(moveTarget) : '' }}". Its sub-folders move with it.</p>
            <UFormField label="Parent" class="flex flex-col gap-1">
                <USelect v-model="moveParent" :items="moveParentOptions" class="w-full">
                    <template #item-label="{ item }">
                        <span :style="{ paddingInlineStart: ((item as FolderOption).depth * 16) + 'px' }">{{ item.label }}</span>
                    </template>
                </USelect>
            </UFormField>
            <template #footer>
                <div class="flex justify-end gap-3">
                    <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { moveOpen = false }" />
                    <UButton label="Move" color="primary" icon="i-lucide-check" :loading="moveLoading" @click="confirmMove" />
                </div>
            </template>
        </DashboardModal>

        <!-- Delete confirmation -->
        <DashboardDeleteModal
            v-model:open="deleteOpen"
            title="Delete folder"
            :warning-text="`Deleting the folder ${deleteTarget ? leaf(deleteTarget) : ''} permanently removes it and all messages it contains. This cannot be undone.`"
            :on-delete="confirmDelete"
        />
    </div>
</template>
