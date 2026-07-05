<script setup lang="ts">
import { useRemoteContentPolicyStore, type RemoteContentDecision, type RemoteContentPolicyData } from '~/composables/stores/useRemoteContentPolicyStore';

useSeoMeta({
	title: 'Remote Content | Delivr',
	description: 'Control which senders may load remote content in emails',
});

const toast = useToast()

const store = useRemoteContentPolicyStore();
await store.use();

interface Rule {
	value: string;
	decision: RemoteContentDecision;
}

// ── Staged, local copy — edits only persist when the user clicks Save. ──
const addresses = ref<Rule[]>([]);
const domains = ref<Rule[]>([]);

// Build the local lists from the persisted policy.
function snapshotFromStore(): { addresses: Rule[]; domains: Rule[] } {
	const data = store.current.value;
	return {
		addresses: Object.entries(data?.addresses ?? {}).map(([value, decision]) => ({ value, decision })),
		domains: Object.entries(data?.domains ?? {}).map(([value, decision]) => ({ value, decision })),
	};
}

function resetFromStore() {
	const snap = snapshotFromStore();
	addresses.value = snap.addresses;
	domains.value = snap.domains;
}

resetFromStore();

const hasRules = computed(() => addresses.value.length > 0 || domains.value.length > 0);

// Serialise a rule list into the map shape the API stores (last write wins).
function toMap(rules: Rule[]): Record<string, RemoteContentDecision> {
	const map: Record<string, RemoteContentDecision> = {};
	for (const { value, decision } of rules) map[value] = decision;
	return map;
}

// Compare the staged lists against what's persisted to drive the Save button.
const isDirty = computed(() => {
	const snap = snapshotFromStore();
	const same = (a: Rule[], b: Rule[]) =>
		JSON.stringify(toMap(a)) === JSON.stringify(toMap(b));
	return !same(addresses.value, snap.addresses) || !same(domains.value, snap.domains);
});

// ── Add-rule form (stages into the local lists, no persistence) ──
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

function addRule() {
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

	const list = newType.value === 'address' ? addresses : domains;
	const existing = list.value.find(r => r.value === value);
	if (existing) {
		existing.decision = newDecision.value; // updating an existing entry
	} else {
		list.value.push({ value, decision: newDecision.value });
	}
	newValue.value = '';
}

function removeAddress(index: number) {
	addresses.value.splice(index, 1);
}
function removeDomain(index: number) {
	domains.value.splice(index, 1);
}

// ── Save / discard ──
const saving = ref(false);

async function onSave() {
	saving.value = true;
	try {
		await store.replace({
			addresses: toMap(addresses.value),
			domains: toMap(domains.value),
		} satisfies RemoteContentPolicyData);
		toast.add({
			title: 'Preferences saved',
			description: 'Your remote content rules have been updated.',
			icon: 'i-lucide-check',
			color: 'success',
		});
	} catch (error) {
		toast.add({
			title: 'Error',
			description: 'An unexpected error occurred while saving your rules.',
			icon: 'i-lucide-alert-circle',
			color: 'error',
		});
	} finally {
		saving.value = false;
	}
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
								color="neutral"
								variant="subtle"
								icon="i-lucide-plus"
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
								v-for="(rule, index) in addresses"
								:key="`addr-${rule.value}`"
								class="flex items-center gap-3 py-3 first:pt-0"
							>
								<UIcon name="i-lucide-at-sign" class="size-4 shrink-0 text-slate-500" />
								<span class="flex-1 min-w-0 truncate text-sm text-white">{{ rule.value }}</span>
								<USelect
									v-model="rule.decision"
									:items="decisionItems"
									value-key="value"
									size="sm"
									class="w-24"
								/>
								<UButton
									icon="i-lucide-trash-2"
									color="neutral"
									variant="ghost"
									size="sm"
									@click="removeAddress(index)"
								/>
							</div>

							<!-- Domains -->
							<div
								v-for="(rule, index) in domains"
								:key="`dom-${rule.value}`"
								class="flex items-center gap-3 py-3 first:pt-0"
							>
								<UIcon name="i-lucide-globe" class="size-4 shrink-0 text-slate-500" />
								<span class="flex-1 min-w-0 truncate text-sm text-white">{{ rule.value }}</span>
								<USelect
									v-model="rule.decision"
									:items="decisionItems"
									value-key="value"
									size="sm"
									class="w-24"
								/>
								<UButton
									icon="i-lucide-trash-2"
									color="neutral"
									variant="ghost"
									size="sm"
									@click="removeDomain(index)"
								/>
							</div>
						</div>
					</div>
				</div>

				<!-- Save / discard -->
				<div class="flex justify-end gap-3">
					<UButton
						label="Discard"
						color="neutral"
						variant="ghost"
						:disabled="!isDirty || saving"
						@click="resetFromStore"
					/>
					<UButton
						label="Save Changes"
						color="primary"
						icon="i-lucide-save"
						:loading="saving"
						:disabled="!isDirty"
						@click="onSave"
					/>
				</div>
			</DashboardPageBody>
		</template>
	</UDashboardPanel>
</template>
