import { ref } from 'vue';
import { MailSelectionUtils } from '~/utils/mail';

/**
 * Wires Outlook/Gmail-style modifier-click selection (Ctrl = toggle one,
 * Shift = range select, no modifier = existing single-click behavior) onto
 * an existing `selectedUids` ref. Used identically by the list view and the
 * split view rows so both share the exact same click semantics.
 */
export function useMailMultiSelect(selectedUids: Ref<Set<number>>) {
    const lastClickedUid = ref<number | null>(null);

    function handleItemClick(
        event: Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>,
        uid: number,
        orderedUids: readonly number[],
        onPlainClick: () => void
    ) {
        const result = MailSelectionUtils.resolveClick(
            selectedUids.value,
            orderedUids,
            lastClickedUid.value,
            uid,
            event
        );

        selectedUids.value = result.selection;
        lastClickedUid.value = result.anchor;

        if (result.openMail) onPlainClick();
    }

    return { lastClickedUid, handleItemClick };
}
