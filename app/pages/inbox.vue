<script setup lang="ts">

// mock data
const mails: Mail[] = [
    // add mock mails here
];

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                title="Inbox"
                icon="i-lucide-inbox"
            />
        </template>

        <template #body>
            <DashboardPageBody></DashboardPageBody>
        </template>
    </UDashboardPanel>
</template>