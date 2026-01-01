<script setup lang="ts">
import { DateFormatter, getLocalTimeZone, CalendarDate } from '@internationalized/date'

interface Range {
    start: Date | null,
    end: Date | null
}

interface Props {
    icon?: string
    class?: string
}

withDefaults(defineProps<Props>(), {
    icon: 'i-lucide-calendar'
});

const df = new DateFormatter('en-US', {
    dateStyle: 'medium'
});

const selected = defineModel<Range>({ required: true });

const toCalendarDate = (date: Date) => {
    return new CalendarDate(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
    )
}

const calendarRange = computed({
    get: () => ({
        start: selected.value.start ? toCalendarDate(selected.value.start) : undefined,
        end: selected.value.end ? toCalendarDate(selected.value.end) : undefined
    }),
    set: (newValue: { start: CalendarDate | null, end: CalendarDate | null }) => {
        selected.value = {
            start: newValue.start ? newValue.start.toDate(getLocalTimeZone()) : null,
            end: newValue.end ? newValue.end.toDate(getLocalTimeZone()) : null
        }
    }
});


const inputValue = computed(() => {
    const { start, end } = selected.value

    if (!start) return 'Pick a date'
    if (!end) return df.format(start)

    return `${df.format(start)} - ${df.format(end)}`
})

const resetRange = () => {
    selected.value = {
        start: null,
        end: null
    }
}

</script>

<template>
    <UPopover :content="{ align: 'start' }" :modal="true" :class="$props.class">
        <UInput color="neutral" variant="outline" :icon="$props.icon" :model-value="inputValue" class="data-[state=open]:bg-elevated group">
            <template #trailing>
                <UIcon name="i-lucide-chevron-down" class="shrink-0 text-dimmed size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
            </template>
        </UInput>

        <template #content>
            <div class="flex flex-col gap-2">
                <UCalendar v-model="calendarRange" class="p-2" :number-of-months="2" range />
                <div class="px-2 pb-2">
                    <UButton variant="ghost" color="primary" @click="resetRange" block>
                        Reset
                    </UButton>
                </div>
            </div>
        </template>
    </UPopover>
</template>