<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui';
import type { MailAccountWithMailboxes } from '~/utils/types';

const toast = useToast();

const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const accountId = mailAccount.data.value.id;

useSeoMeta({
    title: 'Compose | Delivr',
    description: 'Compose a new email'
});

// ── Form state ──

const to = ref('');
const cc = ref('');
const bcc = ref('');
const subject = ref('');
const body = ref('');

const showCc = ref(false);
const showBcc = ref(false);
const sending = ref(false);

// ── Editor toolbar items ──

const toolbarItems: EditorToolbarItem[][] = [
    [
        {
            icon: 'i-lucide-heading',
            tooltip: { text: 'Headings' },
            content: { align: 'start' },
            items: [
                { kind: 'heading', level: 1, icon: 'i-lucide-heading-1', label: 'Heading 1' },
                { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', label: 'Heading 2' },
                { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', label: 'Heading 3' },
            ]
        },
        {
            icon: 'i-lucide-list',
            tooltip: { text: 'Lists' },
            content: { align: 'start' },
            items: [
                { kind: 'bulletList', icon: 'i-lucide-list', label: 'Bullet List' },
                { kind: 'orderedList', icon: 'i-lucide-list-ordered', label: 'Ordered List' },
            ]
        },
        { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: 'Quote' } },
        { kind: 'horizontalRule', icon: 'i-lucide-separator-horizontal', tooltip: { text: 'Divider' } },
    ],
    [
        { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold' } },
        { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic' } },
        { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline' } },
        { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } },
        { kind: 'mark', mark: 'code', icon: 'i-lucide-code', tooltip: { text: 'Code' } },
    ],
    [
        { kind: 'link', icon: 'i-lucide-link', tooltip: { text: 'Link' } },
    ],
    [
        { kind: 'undo', icon: 'i-lucide-undo', tooltip: { text: 'Undo' } },
        { kind: 'redo', icon: 'i-lucide-redo', tooltip: { text: 'Redo' } },
    ],
];

// ── Actions ──

function goBack() {
    navigateTo(`/mail/${accountId}/folder/inbox`);
}

async function handleSend() {
    if (!to.value.trim()) {
        toast.add({
            title: 'Missing recipient',
            description: 'Please enter at least one recipient.',
            color: 'error'
        });
        return;
    }

    // Backend not implemented yet
    toast.add({
        title: 'Sending not available yet',
        description: 'The mail sending feature is coming soon. Your draft cannot be saved at this time.',
        color: 'warning'
    });
}

function handleDiscard() {
    if (to.value || subject.value || body.value) {
        // Simple confirm — no modal needed for now
        if (!confirm('Discard this draft?')) return;
    }
    goBack();
}

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="Compose"
                icon="i-lucide-pen-square"
            >
                <template #leading>
                    <UButton
                        icon="i-lucide-arrow-left"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="goBack"
                    />
                </template>
                <template #trailing>
                    <div class="flex items-center gap-2">
                        <UButton
                            icon="i-lucide-trash-2"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            @click="handleDiscard"
                        >
                            Discard
                        </UButton>
                        <UButton
                            icon="i-lucide-send"
                            color="primary"
                            size="sm"
                            :loading="sending"
                            @click="handleSend"
                        >
                            Send
                        </UButton>
                    </div>
                </template>
            </DashboardPageHeader>
        </template>

        <template #body>
            <DashboardPageBody>
                <div class="space-y-4">

                    <!-- Recipients card -->
                    <div class="rounded-lg border border-default bg-elevated divide-y divide-default">
                        <!-- To -->
                        <div class="flex items-center gap-3 px-5 py-3">
                            <span class="text-sm text-muted w-10 shrink-0">To</span>
                            <UInput
                                v-model="to"
                                placeholder="recipient@example.com"
                                variant="none"
                                class="flex-1"
                                size="md"
                            />
                            <div class="flex items-center gap-1 shrink-0">
                                <UButton
                                    v-if="!showCc"
                                    label="Cc"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    @click="showCc = true"
                                />
                                <UButton
                                    v-if="!showBcc"
                                    label="Bcc"
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    @click="showBcc = true"
                                />
                            </div>
                        </div>

                        <!-- Cc -->
                        <div v-if="showCc" class="flex items-center gap-3 px-5 py-3">
                            <span class="text-sm text-muted w-10 shrink-0">Cc</span>
                            <UInput
                                v-model="cc"
                                placeholder="cc@example.com"
                                variant="none"
                                class="flex-1"
                                size="md"
                            />
                            <UButton
                                icon="i-lucide-x"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="showCc = false; cc = ''"
                            />
                        </div>

                        <!-- Bcc -->
                        <div v-if="showBcc" class="flex items-center gap-3 px-5 py-3">
                            <span class="text-sm text-muted w-10 shrink-0">Bcc</span>
                            <UInput
                                v-model="bcc"
                                placeholder="bcc@example.com"
                                variant="none"
                                class="flex-1"
                                size="md"
                            />
                            <UButton
                                icon="i-lucide-x"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                @click="showBcc = false; bcc = ''"
                            />
                        </div>

                        <!-- Subject -->
                        <div class="flex items-center gap-3 px-5 py-3">
                            <span class="text-sm text-muted w-10 shrink-0">Subj.</span>
                            <UInput
                                v-model="subject"
                                placeholder="Subject"
                                variant="none"
                                class="flex-1"
                                size="md"
                            />
                        </div>
                    </div>

                    <!-- Editor -->
                    <div class="rounded-lg border border-default overflow-hidden">
                        <UEditor
                            v-slot="{ editor }"
                            v-model="body"
                            content-type="html"
                            placeholder="Write your message..."
                            class="min-h-75 flex flex-col"
                        >
                            <UEditorToolbar
                                :editor="editor"
                                :items="toolbarItems"
                                layout="fixed"
                                class="border-b border-default px-2"
                            />
                        </UEditor>
                    </div>

                    <!-- Info banner -->
                    <div class="flex items-center gap-3 px-4 py-3 rounded-lg border border-default bg-elevated">
                        <UIcon name="i-lucide-info" class="size-4 text-muted shrink-0" />
                        <p class="text-xs text-muted">
                            Mail sending is not yet available. This compose view will be fully functional once the backend endpoint is implemented.
                        </p>
                    </div>

                </div>
            </DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>
