<script setup lang="ts">
import type { Mailbox } from '~/utils/types';
import { MailUtils } from '~/utils/mail';
import { useMailActions } from '~/composables/useMailActions';
import { useMailDragState } from '~/composables/useMailDragState';

const props = defineProps<{
    collapsed?: boolean
    mailboxes: Mailbox[]
    accountId: number
}>();

const toast = useToast();
const dragState = useMailDragState();
const hoveredPath = ref<string | null>(null);

interface FolderEntry {
    mailbox: Mailbox
    label: string
    icon: string
    to: string
    unseen?: number
}

function iconFor(mailbox: Mailbox): string {
    const lower = mailbox.path.toLowerCase();
    if (lower === 'inbox') return 'i-lucide-inbox';
    if (lower === 'sent' || lower === 'sent mail' || lower === 'sent messages') return 'i-lucide-send';
    if (lower === 'drafts') return 'i-lucide-file-edit';
    if (MailUtils.isTrashFolder(mailbox.path)) return 'i-lucide-trash-2';
    if (lower === 'spam' || lower === 'junk') return 'i-lucide-shield-alert';
    if (lower === 'archive') return 'i-lucide-archive';
    return 'i-lucide-folder';
}

const inboxEntry = computed<FolderEntry | null>(() => {
    const inbox = props.mailboxes.find(mb => mb.path.toLowerCase() === 'inbox');
    if (!inbox) return null;
    return {
        mailbox: inbox,
        label: 'Inbox',
        icon: 'i-lucide-inbox',
        to: `/mail/${props.accountId}/folder/inbox`,
        unseen: inbox.status.unseen
    };
});

const otherEntries = computed<FolderEntry[]>(() =>
    props.mailboxes
        .filter(mb => mb.path.toLowerCase() !== 'inbox')
        .map(mailbox => ({
            mailbox,
            label: mailbox.name,
            icon: iconFor(mailbox),
            to: `/mail/${props.accountId}/folder/${encodeURIComponent(mailbox.path)}`,
            unseen: mailbox.status.unseen
        }))
);

const entries = computed<FolderEntry[]>(() => [
    ...(inboxEntry.value ? [inboxEntry.value] : []),
    ...otherEntries.value
]);

function isValidDropZone(entry: FolderEntry): boolean {
    const drag = dragState.value;
    if (!drag) return false;
    if (drag.accountId !== props.accountId) return false;
    return drag.sourceMailboxPath !== entry.mailbox.path;
}

function onDragEnter(entry: FolderEntry) {
    if (isValidDropZone(entry)) hoveredPath.value = entry.mailbox.path;
}

function onDragLeave(entry: FolderEntry) {
    if (hoveredPath.value === entry.mailbox.path) hoveredPath.value = null;
}

function onDragOver(event: DragEvent, entry: FolderEntry) {
    if (!isValidDropZone(entry) || !event.dataTransfer) return;
    event.dataTransfer.dropEffect = event.ctrlKey && !event.shiftKey ? 'copy' : 'move';
}

async function onDrop(event: DragEvent, entry: FolderEntry) {
    hoveredPath.value = null;

    const isValid = isValidDropZone(entry);
    const drag = dragState.value;
    dragState.value = null;
    if (!drag || !isValid) return;

    const isCopy = event.ctrlKey && !event.shiftKey;
    const actions = useMailActions(drag.accountId);

    const success = isCopy
        ? await actions.bulkCopy(drag.sourceMailboxPath, drag.uids, entry.mailbox.path)
        : await actions.bulkMove(drag.sourceMailboxPath, drag.uids, entry.mailbox.path);

    if (success) {
        toast.add({
            title: isCopy ? 'Email(s) copied' : 'Email(s) moved',
            description: `${drag.uids.length} email${drag.uids.length === 1 ? '' : 's'} ${isCopy ? 'copied to' : 'moved to'} ${entry.label}.`,
            color: 'success'
        });

        const keyFor = (path: string) => `/mail-accounts/${drag.accountId}/mailboxes/${path}/mails`;
        await refreshNuxtData([keyFor(drag.sourceMailboxPath), keyFor(entry.mailbox.path)]);
    }
}
</script>

<template>
    <nav class="flex flex-col gap-0.5 px-2">
        <NuxtLink
            v-for="entry in entries"
            :key="entry.mailbox.path"
            :to="entry.to"
            class="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-default"
            active-class="bg-elevated text-default font-medium"
            :class="[
                isValidDropZone(entry) ? 'outline-dashed outline-1 outline-primary/50' : '',
                hoveredPath === entry.mailbox.path ? 'bg-primary/10! outline-primary' : ''
            ]"
            @dragover.prevent="onDragOver($event, entry)"
            @dragenter.prevent="onDragEnter(entry)"
            @dragleave="onDragLeave(entry)"
            @drop.prevent="onDrop($event, entry)"
        >
            <UIcon :name="entry.icon" class="size-4 shrink-0" />
            <span v-if="!collapsed" class="flex-1 truncate">{{ entry.label }}</span>
            <UBadge v-if="!collapsed && entry.unseen" size="sm" color="primary" variant="subtle">
                {{ entry.unseen }}
            </UBadge>
        </NuxtLink>

        <div v-if="entries.length === 0" class="px-2 py-1.5 text-sm text-dimmed">
            No Folders to show
        </div>
    </nav>
</template>
