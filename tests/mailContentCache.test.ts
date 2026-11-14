/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect, beforeEach } from 'bun:test';
import { createMailContentCache } from '../app/composables/useMailContentCache.ts';

/**
 * The cache runs on Nuxt's auto-imported `useAPI`, which doesn't exist under
 * `bun test`, so it is stood in for here: it records the UIDs it is asked for.
 */

type APIResponse = { success: boolean; code: number; message: string; data?: unknown };

let requested: number[];
let responses: Map<number, APIResponse>;

const api = {
    getMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUid: async (options: { path: { mailUID: number } }) => {
        const uid = options.path.mailUID;
        requested.push(uid);
        return responses.get(uid) ?? { success: true, code: 200, message: 'ok', data: { uid, subject: `Mail ${uid}`, flags: { seen: false } } };
    },
};

Object.assign(globalThis, {
    useAPI: async (handler: (client: unknown) => unknown) => await handler(api),
});

beforeEach(() => {
    requested = [];
    responses = new Map();
});

describe('createMailContentCache', () => {

    test('loads a mail once and hands out the same object afterwards', async () => {
        const cache = createMailContentCache(1, () => 'INBOX');

        expect(cache.peek(7)).toBeNull();

        const first = await cache.load(7);
        const second = await cache.load(7);

        expect(requested).toEqual([7]);
        expect(first.success && second.success && first.data === second.data).toBe(true);
        // flag changes made on the open mail are still there when it is opened again
        expect(cache.peek(7)).toBe(first.success ? first.data : null);
    });

    test('a prefetched mail is not requested again when it is opened', async () => {
        const cache = createMailContentCache(1, () => 'INBOX');

        cache.prefetch(3);
        cache.prefetch(3);
        // still loading: nothing to show yet, but the open waits for the same request
        expect(cache.peek(3)).toBeNull();

        const mail = await cache.load(3);

        expect(requested).toEqual([3]);
        expect(mail.success).toBe(true);
        expect(cache.peek(3)).not.toBeNull();
    });

    test('does not keep a failed load', async () => {
        const cache = createMailContentCache(1, () => 'INBOX');
        responses.set(5, { success: false, code: 404, message: 'Mail with specified UID not found' });

        expect(await cache.load(5)).toEqual({ success: false, code: 404, message: 'Mail with specified UID not found' });
        expect(cache.peek(5)).toBeNull();

        responses.delete(5);
        expect((await cache.load(5)).success).toBe(true);
        expect(requested).toEqual([5, 5]);
    });

    test('forgets the mail that was used longest ago', async () => {
        const cache = createMailContentCache(1, () => 'INBOX', 2);

        await cache.load(1);
        await cache.load(2);
        await cache.load(1); // 2 is now the oldest
        await cache.load(3);

        expect(cache.peek(1)).not.toBeNull();
        expect(cache.peek(2)).toBeNull();
        expect(cache.peek(3)).not.toBeNull();
    });

    test('keeps the mails of different mailboxes apart and drops on request', async () => {
        let mailbox = 'INBOX';
        const cache = createMailContentCache(1, () => mailbox);

        await cache.load(1);
        mailbox = 'Archive';
        expect(cache.peek(1)).toBeNull();

        mailbox = 'INBOX';
        expect(cache.peek(1)).not.toBeNull();
        cache.drop(1);
        expect(cache.peek(1)).toBeNull();
    });
});
