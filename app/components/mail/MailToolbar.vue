<script setup lang="ts">
import type { MailViewMode } from '~/composables/useMailViewMode';

// The list toolbar: folder counts on the left, selection/open-mail actions and
// the view-mode + refresh controls on the right. Purely presentational — all
// behaviour is owned by the parent and wired through the emits below.
withDefaults(defineProps<{
    /** Emails on the current page and how many are unread. */
    count: number;
    unreadCount: number;
    /** Hide the count (e.g. the full-screen reading view shows a single mail). */
    showCount?: boolean;
    /** Whether the account has an Archive folder we're not already in. */
    canArchive: boolean;
    /** At least one email to act on (a checked selection or the open mail). */
    hasActionTarget: boolean;
    /** Label + icon for the single read/unread toggle (parent decides direction). */
    readToggleLabel: string;
    readToggleIcon: string;
    /** In-flight flags. */
    isApplyingFlags: boolean;
    isDeleting: boolean;
    isRefreshing: boolean;
    /** Show reply/forward/print — a single mail is open in split view. */
    showMailActions: boolean;
    /** Below the lg breakpoint there's no split view, so hide the toggle. */
    isMobile: boolean;
    viewMode: MailViewMode;

    /** Render a back link to the previous page (e.g. the folder list) instead of the
     * view-mode + refresh controls. */
    backLink?: string;
}>(), { showCount: true });

defineEmits<{
    archive: [];
    toggleRead: [];
    delete: [];
    reply: [];
    replyAll: [];
    forward: [];
    print: [];
    toggleView: [];
    refresh: [];
}>();
</script>

<template>
    <div class="flex items-center gap-2 px-4 py-2 border-b border-default shrink-0">
        <div v-if="showCount" class="text-sm text-muted shrink-0">
            <span class="font-medium text-default">{{ count }}</span>
            <span class="mx-1">·</span>
            <span>{{ unreadCount }} unread</span>
        </div>

        <div v-if="backLink" class="flex items-center gap-0.5 shrink-0">
            <UButton
                icon="i-lucide-arrow-left"
                color="neutral"
                variant="ghost"
                size="sm"
                :to="backLink"
            />
        </div>


        <div class="flex-1" />

        <!-- Selection actions: operate on the checked email(s) — one or many —
             or the single email open in the reading pane. Disabled with no target. -->
        <div class="flex items-center gap-0.5 shrink-0">
            <UTooltip :text="canArchive ? 'Archive' : 'No Archive folder'">
                <UButton
                    icon="i-lucide-archive"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :disabled="!hasActionTarget || !canArchive"
                    @click="$emit('archive')"
                />
            </UTooltip>
            <UTooltip :text="readToggleLabel">
                <UButton
                    :icon="readToggleIcon"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :disabled="!hasActionTarget"
                    :loading="isApplyingFlags"
                    @click="$emit('toggleRead')"
                />
            </UTooltip>
            <UTooltip text="Delete">
                <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="sm"
                    :disabled="!hasActionTarget"
                    :loading="isDeleting"
                    @click="$emit('delete')"
                />
            </UTooltip>

            <!-- Actions for the open mail (split view): reply/forward + print -->
            <template v-if="showMailActions">
                <div class="w-px h-5 bg-default mx-1" />
                <UTooltip text="Reply">
                    <UButton icon="i-lucide-reply" color="neutral" variant="ghost" size="sm" @click="$emit('reply')" />
                </UTooltip>
                <UTooltip text="Reply All">
                    <UButton icon="i-lucide-reply-all" color="neutral" variant="ghost" size="sm" @click="$emit('replyAll')" />
                </UTooltip>
                <UTooltip text="Forward">
                    <UButton icon="i-lucide-forward" color="neutral" variant="ghost" size="sm" @click="$emit('forward')" />
                </UTooltip>
                <UTooltip text="Print">
                    <UButton icon="i-lucide-printer" color="neutral" variant="ghost" size="sm" @click="$emit('print')" />
                </UTooltip>
            </template>
        </div>

        <div class="w-px h-5 bg-default shrink-0" />

        <!-- View mode toggle (desktop only; mobile is always single-list) -->
        <UTooltip v-if="!isMobile" :text="viewMode === 'split' ? 'Switch to list view' : 'Switch to split view'">
            <UButton
                :icon="viewMode === 'split' ? 'i-lucide-columns-2' : 'i-lucide-rows-3'"
                color="neutral"
                variant="ghost"
                size="md"
                @click="$emit('toggleView')"
            />
        </UTooltip>

        <UTooltip text="Refresh">
            <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="ghost"
                size="md"
                :loading="isRefreshing"
                @click="$emit('refresh')"
            />
        </UTooltip>
    </div>
</template>
