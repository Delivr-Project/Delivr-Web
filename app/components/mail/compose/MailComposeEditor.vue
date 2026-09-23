<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui';
import { Node, mergeAttributes } from '@tiptap/core';
import { TextAlign } from '@tiptap/extension-text-align';
import MailComposeLinkPopover from '~/components/mail/compose/MailComposeLinkPopover.vue';
import { MailComposeUtils } from '~/utils/mail/mailCompose';

/**
 * Rich text editor for a mail body (HTML). Block spacing is kept tight so the
 * editor shows what recipients will see (see `MailComposeUtils.toEmailHtml`).
 * Files pasted or dropped into the text are handed to the composer as
 * attachments instead of being embedded.
 */
const props = defineProps<{
    placeholder?: string;
    disabled?: boolean;
    autofocus?: boolean;
}>();

const emit = defineEmits<{
    files: [files: File[]];
    /** The editor finished initializing, including any adjustments it makes to the initial content. */
    ready: [];
}>();

const model = defineModel<string>({ required: true });

const editorRef = useTemplateRef('editorRef');

onMounted(() => {
    const editor = editorRef.value?.editor;
    if (!editor) return;
    // Extensions may adjust the initial content once the editor is created (e.g.
    // a trailing paragraph after a quote), which reaches the model as an update.
    const ready = () => nextTick(() => emit('ready'));
    if (editor.isInitialized) ready();
    else editor.once('create', ready);
});

function takeFiles(data: DataTransfer | null): boolean {
    const files = Array.from(data?.files ?? []);
    if (files.length === 0) return false;
    emit('files', files);
    // Handled: nothing is inserted into the text.
    return true;
}

const editorProps = {
    handlePaste: (_view: unknown, event: ClipboardEvent) => takeFiles(event.clipboardData),
    handleDrop: (_view: unknown, event: DragEvent) => takeFiles(event.dataTransfer)
};

/**
 * The identity signature as a real node. TipTap drops elements it has no node
 * for — a plain marked `<div>` would come back out of the editor unwrapped and
 * unmarked, leaving the composer unable to find the signature again when the
 * sender changes. It is edited like any other text; only the wrapper is fixed.
 */
const MailSignature = Node.create({
    name: 'mailSignature',
    group: 'block',
    content: 'block+',
    defining: true,

    parseHTML() {
        return [{ tag: `div[${MailComposeUtils.SIGNATURE_ATTRIBUTE}]` }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { [MailComposeUtils.SIGNATURE_ATTRIBUTE]: '' }), 0];
    }
});

const extensions = [TextAlign.configure({ types: ['heading', 'paragraph'] }), MailSignature];

const toolbarItems = [
    [
        { kind: 'undo', icon: 'i-lucide-undo-2', tooltip: { text: 'Undo', kbds: ['meta', 'z'] } },
        { kind: 'redo', icon: 'i-lucide-redo-2', tooltip: { text: 'Redo', kbds: ['meta', 'shift', 'z'] } }
    ],
    [
        {
            icon: 'i-lucide-heading',
            tooltip: { text: 'Text style' },
            // Normal text is always an active child; don't render the menu as "on".
            activeColor: 'neutral',
            activeVariant: 'ghost',
            content: { align: 'start' },
            items: [
                { kind: 'paragraph', icon: 'i-lucide-pilcrow', label: 'Normal text' },
                { kind: 'heading', level: 1, icon: 'i-lucide-heading-1', label: 'Heading 1' },
                { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', label: 'Heading 2' },
                { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', label: 'Heading 3' }
            ]
        }
    ],
    [
        { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold', kbds: ['meta', 'b'] } },
        { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic', kbds: ['meta', 'i'] } },
        { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline', kbds: ['meta', 'u'] } },
        { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } }
    ],
    [
        { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: 'Bulleted list' } },
        { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: { text: 'Numbered list' } },
        { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: 'Quote' } }
    ],
    [
        { slot: 'link' as const, icon: 'i-lucide-link' },
        {
            icon: 'i-lucide-align-left',
            tooltip: { text: 'Alignment' },
            content: { align: 'end' },
            items: [
                { kind: 'textAlign', align: 'left', icon: 'i-lucide-align-left', label: 'Align left' },
                { kind: 'textAlign', align: 'center', icon: 'i-lucide-align-center', label: 'Center' },
                { kind: 'textAlign', align: 'right', icon: 'i-lucide-align-right', label: 'Align right' },
                { kind: 'textAlign', align: 'justify', icon: 'i-lucide-align-justify', label: 'Justify' }
            ]
        },
        { kind: 'clearFormatting', icon: 'i-lucide-remove-formatting', tooltip: { text: 'Clear formatting' } }
    ]
] satisfies EditorToolbarItem[][];

const bubbleItems = [
    [
        { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold' } },
        { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic' } },
        { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline' } },
        { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } }
    ],
    [
        { slot: 'link' as const, icon: 'i-lucide-link' },
        { kind: 'clearFormatting', icon: 'i-lucide-remove-formatting', tooltip: { text: 'Clear formatting' } }
    ]
] satisfies EditorToolbarItem[][];

defineExpose({
    focus: (position: 'start' | 'end' = 'start') => editorRef.value?.editor?.commands.focus(position)
});
</script>

<template>
    <UEditor
        ref="editorRef"
        v-slot="{ editor }"
        v-model="model"
        content-type="html"
        :placeholder="{ placeholder: props.placeholder ?? 'Write your message…', mode: 'firstLine' }"
        :starter-kit="{
            heading: { levels: [1, 2, 3] },
            link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
            dropcursor: { color: 'var(--ui-primary)', width: 2 }
        }"
        :image="false"
        :mention="false"
        :extensions="extensions"
        :editor-props="editorProps"
        :editable="!props.disabled"
        :autofocus="props.autofocus ? 'start' : false"
        :ui="{
            root: 'flex flex-col',
            content: 'flex flex-col flex-1',
            base: [
                'flex-1 min-h-72 px-4 sm:px-6 py-5 *:my-0 [&_p]:leading-6',
                '[&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_:is(h1,h2,h3)]:leading-snug',
                '[&_blockquote]:not-italic [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:text-muted',
                '[&_li]:my-0.5'
            ].join(' ')
        }"
    >
        <UEditorToolbar
            :editor="editor"
            :items="toolbarItems"
            class="sticky top-0 z-10 border-b border-default bg-default/90 backdrop-blur px-2 sm:px-4 py-1.5 overflow-x-auto"
        >
            <template #link>
                <MailComposeLinkPopover :editor="editor" />
            </template>
        </UEditorToolbar>

        <UEditorToolbar
            :editor="editor"
            :items="bubbleItems"
            layout="bubble"
            :should-show="({ view, state }) => view.hasFocus() && !state.selection.empty"
        >
            <template #link>
                <MailComposeLinkPopover :editor="editor" />
            </template>
        </UEditorToolbar>
    </UEditor>
</template>
