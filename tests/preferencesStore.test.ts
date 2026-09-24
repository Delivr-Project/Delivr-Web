/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';
import { ref, computed, type Ref } from 'vue';
import * as abstractStore from '../app/utils/abstractStore.ts';
import type { RemoteContentPolicyData } from '../app/composables/stores/usePreferencesStore.ts';

/**
 * The store runs on Nuxt's auto-imports (`useState`, `useAPI`, …) and the `~`
 * alias, neither of which exists under `bun test`, so both are stood in for
 * here: state lives in a plain map and the API records every call it gets.
 */

mock.module('~/utils/abstractStore', () => abstractStore);

type APIResponse = { success: boolean; message?: string; data?: unknown };

const SERVER_PREFERENCES = {
    'remote-content-policy': { addresses: { 'a@x.com': 'allow' }, domains: { 'y.com': 'block' } },
    'auto-mark-seen': { enabled: false },
    'folder-nesting': { nestUnderInbox: true },
    'folder-dnd': { enabled: false },
    onboarding: { completed: true },
};

let state: Map<string, Ref<unknown>>;
let getResponse: APIResponse;
let putResponses: Record<string, APIResponse>;
let calls: { method: string; body: unknown }[];

const api = new Proxy({}, {
    get: (_, method: string) => async (options: { body?: unknown }) => {
        calls.push({ method, body: options.body });
        if (method === 'getAccountPreferences') return structuredClone(getResponse);
        return putResponses[method] ?? { success: true };
    },
});

Object.assign(globalThis, {
    computed,
    useState: (key: string, init: () => unknown) => {
        if (!state.has(key)) state.set(key, ref(init()));
        return state.get(key);
    },
    useAppCookies: () => ({ sessionToken: { get: () => ({ value: 'token' }) } }),
    useAPI: async (handler: (client: unknown) => unknown) => await handler(api),
});

const { usePreferencesStore } = await import('../app/composables/stores/usePreferencesStore.ts');

const puts = () => calls.filter(call => call.method.startsWith('put'));

beforeEach(() => {
    state = new Map();
    getResponse = { success: true, data: SERVER_PREFERENCES };
    putResponses = {};
    calls = [];
});

describe('usePreferencesStore', () => {

    test('loads every preference in one request', async () => {
        const store = usePreferencesStore();
        await store.use();

        expect(calls.map(call => call.method)).toEqual(['getAccountPreferences']);
        expect(store.autoMarkSeen.value).toBe(false);
        expect(store.onboardingCompleted.value).toBe(true);
        expect(store.resolveRemoteContent('A@x.com')).toBe('allow');
        expect(store.resolveRemoteContent('b@y.com')).toBe('block');
    });

    test('writes only the preferences that changed', async () => {
        const store = usePreferencesStore();
        await store.update({ autoMarkSeen: false, nestUnderInbox: false, folderDragDrop: false });

        expect(puts()).toEqual([{ method: 'putAccountPreferencesFolderNesting', body: { nestUnderInbox: false } }]);
        expect(store.nestUnderInbox.value).toBe(false);
    });

    test('ignores keys that are set to undefined', async () => {
        const store = usePreferencesStore();
        await store.update({ autoMarkSeen: undefined });

        expect(puts()).toEqual([]);
        expect(store.autoMarkSeen.value).toBe(false);
    });

    test('refuses to write while the preferences cannot be loaded', async () => {
        getResponse = { success: false, message: 'Not Found' };
        const store = usePreferencesStore();

        await expect(store.setRemoteContentDomainPolicy('z.com', 'allow')).rejects.toThrow("couldn't be loaded");
        await expect(store.update({ onboardingCompleted: true })).rejects.toThrow("couldn't be loaded");
        expect(puts()).toEqual([]);

        // Nothing was stored in the meantime, so the rules load once the API is back.
        getResponse = { success: true, data: SERVER_PREFERENCES };
        await store.refreshIfNeeded();
        expect(store.remoteContentPolicy.value?.addresses).toEqual({ 'a@x.com': 'allow' });
    });

    test('merges a new remote content rule into the existing ones', async () => {
        const store = usePreferencesStore();
        await store.setRemoteContentDomainPolicy('Z.com', 'allow');

        expect(puts()).toEqual([{
            method: 'putAccountPreferencesRemoteContentPolicy',
            body: { addresses: { 'a@x.com': 'allow' }, domains: { 'y.com': 'block', 'z.com': 'allow' } },
        }]);
    });

    test('keeps both rules when two are saved at the same time', async () => {
        const store = usePreferencesStore();
        await store.use();
        await Promise.all([
            store.setRemoteContentDomainPolicy('z.com', 'allow'),
            store.setRemoteContentAddressPolicy('c@z.com', 'block'),
        ]);

        const expected: RemoteContentPolicyData = {
            addresses: { 'a@x.com': 'allow', 'c@z.com': 'block' },
            domains: { 'y.com': 'block', 'z.com': 'allow' },
        };
        expect(store.remoteContentPolicy.value).toEqual(expected);
        expect(puts().at(-1)?.body).toEqual(expected);
    });

    test('rolls back a preference that could not be saved and throws', async () => {
        const consoleError = spyOn(console, 'error').mockImplementation(() => {});
        putResponses.putAccountPreferencesFolderNesting = { success: false, message: 'Internal Server Error' };
        const store = usePreferencesStore();

        await expect(store.update({ nestUnderInbox: false, folderDragDrop: true })).rejects.toThrow("Couldn't save folder nesting");
        expect(store.nestUnderInbox.value).toBe(true);
        expect(store.folderDragDrop.value).toBe(true);
        consoleError.mockRestore();
    });

});
