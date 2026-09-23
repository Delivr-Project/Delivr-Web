<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

/** Toolbar button + popover to add, edit or remove the link at the selection. */
const props = defineProps<{
    editor: Editor;
}>();

const open = ref(false);
const url = ref('');

const active = computed(() => props.editor.isActive('link'));
const disabled = computed(() => {
    if (!props.editor.isEditable) return true;
    return props.editor.state.selection.empty && !props.editor.isActive('link');
});

watch(() => props.editor, (editor, _, onCleanup) => {
    if (!editor) return;

    const updateUrl = () => {
        url.value = editor.getAttributes('link').href || '';
    };

    updateUrl();
    editor.on('selectionUpdate', updateUrl);
    onCleanup(() => editor.off('selectionUpdate', updateUrl));
}, { immediate: true });

/** A link in a mail must be absolute: bare domains get https://, addresses mailto:. */
function normalizeUrl(value: string): string {
    const trimmed = value.trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`;
    return `https://${trimmed}`;
}

function setLink() {
    if (!url.value.trim()) return;

    const href = normalizeUrl(url.value);
    const chain = props.editor.chain().focus();
    if (props.editor.state.selection.empty && !active.value) {
        // Nothing selected: insert the link text itself.
        chain.insertContent({ type: 'text', text: url.value.trim(), marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
        chain.extendMarkRange('link').setLink({ href }).run();
    }
    open.value = false;
}

function removeLink() {
    props.editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .unsetLink()
        .setMeta('preventAutolink', true)
        .run();

    url.value = '';
    open.value = false;
}

function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        event.preventDefault();
        setLink();
    }
}
</script>

<template>
    <UPopover v-model:open="open" :ui="{ content: 'p-0.5' }">
        <UTooltip text="Link">
            <UButton
                icon="i-lucide-link"
                color="neutral"
                active-color="primary"
                variant="ghost"
                active-variant="soft"
                size="sm"
                :active="active"
                :disabled="disabled"
                aria-label="Link"
            />
        </UTooltip>

        <template #content>
            <UInput
                v-model="url"
                autofocus
                name="url"
                type="url"
                variant="none"
                placeholder="Paste or type a link…"
                class="w-72"
                @keydown="onKeydown"
            >
                <template #trailing>
                    <div class="flex items-center -me-1.5">
                        <UButton
                            icon="i-lucide-corner-down-left"
                            variant="ghost"
                            size="sm"
                            :disabled="!url.trim()"
                            aria-label="Apply link"
                            @click="setLink"
                        />
                        <USeparator orientation="vertical" class="h-5 mx-0.5" />
                        <UButton
                            icon="i-lucide-trash-2"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            :disabled="!active"
                            aria-label="Remove link"
                            @click="removeLink"
                        />
                    </div>
                </template>
            </UInput>
        </template>
    </UPopover>
</template>
