<script setup lang="ts">
import { MailAddressUtils } from '~/utils/mail/mailAddress';

type Address = MailAddressUtils.Address;

/**
 * Recipient chips for one address field (To / Cc / Bcc). Typing an address and
 * pressing Enter, Tab, `,` or `;` (or leaving the field) turns it into a chip;
 * invalid addresses stay as chips marked in red so they can be fixed.
 */
defineProps<{
    placeholder?: string;
    autofocus?: boolean;
}>();

const model = defineModel<Address[]>({ required: true });

const inputTags = useTemplateRef('inputTags');

function update(value: Address[]) {
    model.value = MailAddressUtils.dedupe(value);
}

// Pasting a list ('a@x.com, "Doe, Jane" <j@x.com>') adds one chip per address.
// InputTags' own paste splitting would cut quoted names apart, so it's done here.
function onPaste(event: ClipboardEvent) {
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (!/[,;\n@]/.test(pasted)) return;

    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const entries = MailAddressUtils.parseList(`${input.value}${pasted}`);
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    update([...model.value, ...entries]);
}

defineExpose({
    focus: () => inputTags.value?.inputRef?.focus()
});
</script>

<template>
    <UInputTags
        ref="inputTags"
        :model-value="model"
        :convert-value="MailAddressUtils.parse"
        :display-value="MailAddressUtils.label"
        :delimiter="/[,;]/"
        :placeholder="model.length === 0 ? placeholder : undefined"
        :autofocus="autofocus"
        add-on-blur
        add-on-tab
        variant="none"
        size="md"
        autocomplete="off"
        class="w-full"
        :ui="{
            base: 'px-0 py-1 gap-1.5 flex-wrap',
            item: 'rounded-md ring-default bg-elevated/70 max-w-full',
            itemText: 'truncate',
            input: 'min-w-40 flex-1'
        }"
        @update:model-value="update"
        @paste="onPaste"
    >
        <template #item-text="{ item }">
            <UTooltip :text="MailAddressUtils.format(item)" :delay-duration="400">
                <span
                    class="inline-flex items-center gap-1 truncate"
                    :class="MailAddressUtils.isValid(item.address) ? 'text-default' : 'text-error'"
                >
                    <UIcon
                        v-if="!MailAddressUtils.isValid(item.address)"
                        name="i-lucide-circle-alert"
                        class="size-3.5 shrink-0"
                    />
                    <span class="truncate">{{ MailAddressUtils.label(item) }}</span>
                </span>
            </UTooltip>
        </template>
    </UInputTags>
</template>
