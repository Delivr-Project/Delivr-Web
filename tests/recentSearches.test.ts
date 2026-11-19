/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Window } from 'happy-dom';
import { nextTick, ref } from 'vue';

// VueUse picks up `window` when it is imported, so the DOM has to exist first.
const window = new Window();
const globals = { window, document: window.document, localStorage: window.localStorage, Storage: window.Storage, StorageEvent: window.StorageEvent };
const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, globals);

// Other test files run in the same process; leave the globals as they were.
afterAll(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
    }
});

let recent: typeof import('../app/composables/useRecentSearches.ts');

beforeAll(async () => {
    recent = await import('../app/composables/useRecentSearches.ts');
});

beforeEach(() => window.localStorage.clear());

describe('recent mail searches', () => {

    test('are kept apart per user', async () => {
        const user = ref<number | null>(1);
        const searches = recent.useRecentMailSearches(user);
        searches.value = ['from:alice@x.com'];
        await nextTick();

        user.value = 2;
        await nextTick();
        expect(searches.value).toEqual([]);

        user.value = 1;
        await nextTick();
        expect(searches.value).toEqual(['from:alice@x.com']);
    });

    test('drop the old key every user shared', () => {
        window.localStorage.setItem('delivr:mail-search:recent', JSON.stringify(['old']));
        const searches = recent.useRecentMailSearches(1);
        expect(searches.value).toEqual([]);
        expect(window.localStorage.getItem('delivr:mail-search:recent')).toBeNull();
    });

    test('are all forgotten on logout, other storage is left alone', () => {
        window.localStorage.setItem('delivr:mail-search:recent:1', JSON.stringify(['a']));
        window.localStorage.setItem('delivr:mail-search:recent:2', JSON.stringify(['b']));
        window.localStorage.setItem('delivr:mail-view-mode', 'split');

        recent.clearRecentMailSearches();

        expect(window.localStorage.getItem('delivr:mail-search:recent:1')).toBeNull();
        expect(window.localStorage.getItem('delivr:mail-search:recent:2')).toBeNull();
        expect(window.localStorage.getItem('delivr:mail-view-mode')).toBe('split');
    });
});
