<script setup lang="ts">
import type { UseSubrouterPathDynamics } from '~/composables/useSubrouterPathDynamics';

const route = useRoute();


const api_key_id = route.params.api_key_id as string;

let error = null;

if (!api_key_id) {
    error = createError({ statusCode: 400, statusMessage: 'API Key ID is required' });
}

if (api_key_id === "new") {

    useSubrouterInjectedData<number, NewAPIKey>('api_key', true).provide({
        data: ref({
            description: '',
            expires_at: "30d"
        }),
        isNew: true
    });

} else {
    
    const { data: result, refresh, loading } = await useAPIAsyncData(
        `/account/apikeys/${api_key_id}`,
        async () => {

            const res = await useAPI((api) => api.getAccountApikeysByApiKeyId({
                path: {
                    apiKeyID: api_key_id
                }
            }));

            return res;
        }
    )

    if (!result.value?.success || !result.value?.data) {
        error = createError({
            statusCode: result.value?.code || 500,
            statusMessage: result.value?.message || 'Failed to load API Key data'
        });
    }

    const data = computed(() => result.value?.data as APIKey);

    useSubrouterInjectedData<APIKey, NewAPIKey>("api_key", true).provide({
        data: data,
        refresh,
        loading,
        isNew: false
    });

}

function getRoutesConfig(): UseSubrouterPathDynamics.RoutesConfig {

    return api_key_id === "new" ? {
        [`/settings/apikeys/new`]: {
            isNavLink: true,
            label: 'General',
            icon: 'i-lucide-info',
            exact: true,
            getDynamicValues() {
                return {
                    seoSettings: {
                        title: `New API Key`,
                        description: `Create a new API Key for Delivr API access.`
                    },
                    breadcrumbItems: [
                        { label: 'New API Key' }
                    ]
                };
            }
        }
    } : {
        [`/settings/apikeys/${api_key_id}`]: {
            isNavLink: true,
            label: 'General',
            icon: 'i-lucide-info',
            exact: true,
            getDynamicValues() {
                return {
                    seoSettings: {
                        title: `API Key ${api_key_id}`,
                        description: `Manage API Key ${api_key_id} Delivr API`
                    },
                    breadcrumbItems: [
                        { label: api_key_id }
                    ]
                };
            }
        }
    };
}

const subrouterPathDynamics = useSubrouterPathDynamics({
    baseTitle: `API Keys | Delivr`,
    basebreadcrumbItems: [
        { label: 'API Keys', to: '/settings/apikeys' }
    ],      
    routes: getRoutesConfig()
});

const routePathDynamicValues = await useAwaitedComputed(async () => {
    const values = await subrouterPathDynamics.getPathDynamicValues(route.path);
    useSeoMeta(values.seoSettings);
    return values;
});

</script>

<template>
    <UDashboardPanel>
        <template #header>
            <DashboardPageHeader
                icon="i-lucide-key"
                :breadcrumb-items="routePathDynamicValues.breadcrumbItems"
            />

            <UDashboardToolbar>
				<!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
				<UNavigationMenu :items="subrouterPathDynamics.links" highlight class="-mx-1 flex-1" />
			</UDashboardToolbar>

        </template>

        <template #body>
			<div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full">
				<NuxtPage v-if="!error" />
                <UError v-else-if="error" :error="error" />
			</div>
		</template>

    </UDashboardPanel>
</template>