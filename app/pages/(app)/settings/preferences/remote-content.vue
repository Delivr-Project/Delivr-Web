<script setup lang="ts">
import { useRemoteContentPolicyStore, type RemoteContentDecision } from '~/composables/stores/useRemoteContentPolicyStore';

useSeoMeta({
	title: 'Remote Content | Delivr',
	description: 'Control which senders may load remote content in emails',
});

const toast = useToast()

const store = useRemoteContentPolicyStore();
await store.use();

// Existing rules, reactive off the store's raw state.
const addressRules = computed(() => Object.entries(store.current.value?.addresses ?? {}));
const domainRules = computed(() => Object.entries(store.current.value?.domains ?? {}));
const hasRules = computed(() => addressRules.value.length > 0 || domainRules.value.length > 0);

// ── Add-rule form ──
const typeItems = [
	{ label: 'Address', value: 'address' },
	{ label: 'Domain', value: 'domain' },
];
const decisionItems: { label: string; value: RemoteContentDecision }[] = [
	{ label: 'Allow', value: 'allow' },
	{ label: 'Block', value: 'block' },
];

const newType = ref<'address' | 'domain'>('address');
const newValue = ref('');
const newDecision = ref<RemoteContentDecision>('allow');
const adding = ref(false);

async function addRule() {
	const value = newValue.value.trim().toLowerCase();
	if (!value) return;

	// Light sanity check: addresses need an @, domains must not have one.
	if (newType.value === 'address' && !value.includes('@')) {
		toast.add({ title: 'Invalid address', description: 'Enter a full email address, e.g. sender@example.com.', icon: 'i-lucide-alert-triangle', color: 'warning' });
		return;
	}
	if (newType.value === 'domain' && value.includes('@')) {
		toast.add({ title: 'Invalid domain', description: 'Enter a domain only, e.g. example.com.', icon: 'i-lucide-alert-triangle', color: 'warning' });
		return;
	}

	adding.value = true;
	try {
		if (newType.value === 'address') await store.setAddressPolicy(value, newDecision.value);
		else await store.setDomainPolicy(value, newDecision.value);
		toast.add({ title: 'Rule added', icon: 'i-lucide-check', color: 'success' });
		newValue.value = '';
	} catch (error) {
		toast.add({ title: 'Error', description: 'Could not save the rule.', icon: 'i-lucide-alert-circle', color: 'error' });
	} finally {
		adding.value = false;
	}
}

// Inline decision change on an existing rule (setters merge + persist).
async function changeAddress(address: string, decision: RemoteContentDecision) {
	await store.setAddressPolicy(address, decision);
}
async function changeDomain(domain: string, decision: RemoteContentDecision) {
	await store.setDomainPolicy(domain, decision);
}

async function removeAddress(address: string) {
	await store.clearAddress(address);
	toast.add({ title: 'Rule removed', icon: 'i-lucide-check', color: 'success' });
}
async function removeDomain(domain: string) {
	await store.clearDomain(domain);
	toast.add({ title: 'Rule removed', icon: 'i-lucide-check', color: 'success' });
}
</script>

<template>
	<UDashboardPanel id="settings" :ui="{ body: 'lg:py-12 lg:gap-12 w-full lg:max-w-3xl mx-auto' }">
		<template #header>
			<DashboardPageHeader
				title="Remote Content"
				icon="i-lucide-image"
				description="Control which senders may load remote content in emails"
			/>
		</template>

		<template #body>
			<DashboardPageBody>
				<!-- Header -->
				<div>
					<h2 class="text-xl font-semibold text-white">Remote Content</h2>
					<p class="text-sm text-slate-400 mt-1">
						By default, remote images and resources are blocked and you're shown a banner to load
						them per message. Add senders or domains here to always allow or always block them.
					</p>
				</div>

				<!-- Add rule Card -->
				<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
					<div class="px-6 py-4 border-b border-slate-800">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
								<UIcon name="i-lucide-plus" class="w-5 h-5 text-sky-400" />
							</div>
							<div>
								<h3 class="font-medium text-white">Add a rule</h3>
								<p class="text-sm text-slate-400">Allow or block remote content for a sender or domain</p>
							</div>
						</div>
					</div>

					<div class="p-6">
						<div class="flex flex-col sm:flex-row gap-3 sm:items-center">
							<USelect v-model="newType" :items="typeItems" value-key="value" class="w-full sm:w-32" />
							<UInput
								v-model="newValue"
								:placeholder="newType === 'address' ? 'sender@example.com' : 'example.com'"
								class="w-full sm:flex-1"
								@keydown.enter.prevent="addRule"
							/>
							<USelect v-model="newDecision" :items="decisionItems" value-key="value" class="w-full sm:w-28" />
							<UButton
								label="Add"
								color="primary"
								icon="i-lucide-plus"
								:loading="adding"
								:disabled="!newValue.trim()"
								@click="addRule"
							/>
						</div>
					</div>
				</div>

				<!-- Existing rules Card -->
				<div class="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
					<div class="px-6 py-4 border-b border-slate-800">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
								<UIcon name="i-lucide-list-checks" class="w-5 h-5 text-sky-400" />
							</div>
							<div>
								<h3 class="font-medium text-white">Your rules</h3>
								<p class="text-sm text-slate-400">Addresses take precedence over domains</p>
							</div>
						</div>
					</div>

					<div class="p-6">
						<!-- Empty state -->
						<div v-if="!hasRules" class="flex flex-col items-center justify-center py-8 text-center">
							<UIcon name="i-lucide-shield-off" class="size-8 text-slate-600 mb-3" />
							<p class="text-sm text-slate-400">No rules yet. Remote content is blocked by default.</p>
						</div>

						<div v-else class="flex flex-col divide-y divide-slate-800">
							<!-- Addresses -->
							<div
								v-for="[address, decision] in addressRules"
								:key="`addr-${address}`"
								class="flex items-center gap-3 py-3 first:pt-0"
							>
								<UIcon name="i-lucide-at-sign" class="size-4 shrink-0 text-slate-500" />
								<span class="flex-1 min-w-0 truncate text-sm text-white">{{ address }}</span>
								<USelect
									:model-value="decision"
									:items="decisionItems"
									value-key="value"
									size="sm"
									class="w-24"
									@update:model-value="(d: RemoteContentDecision) => changeAddress(address, d)"
								/>
								<UButton
									icon="i-lucide-trash-2"
									color="neutral"
									variant="ghost"
									size="sm"
									@click="removeAddress(address)"
								/>
							</div>

							<!-- Domains -->
							<div
								v-for="[domain, decision] in domainRules"
								:key="`dom-${domain}`"
								class="flex items-center gap-3 py-3 first:pt-0"
							>
								<UIcon name="i-lucide-globe" class="size-4 shrink-0 text-slate-500" />
								<span class="flex-1 min-w-0 truncate text-sm text-white">{{ domain }}</span>
								<USelect
									:model-value="decision"
									:items="decisionItems"
									value-key="value"
									size="sm"
									class="w-24"
									@update:model-value="(d: RemoteContentDecision) => changeDomain(domain, d)"
								/>
								<UButton
									icon="i-lucide-trash-2"
									color="neutral"
									variant="ghost"
									size="sm"
									@click="removeDomain(domain)"
								/>
							</div>
						</div>
					</div>
				</div>
			</DashboardPageBody>
		</template>
	</UDashboardPanel>
</template>
