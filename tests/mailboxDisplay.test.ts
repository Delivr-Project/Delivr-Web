/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect } from 'bun:test';
import { createMemoryHistory, createRouter } from 'vue-router';
import { MailboxDisplayUtils } from '../app/utils/mailboxDisplay.ts';
import type { Mailbox } from '../app/utils/types.ts';

const mailbox = (path: string, delimiter: string) => ({ path, delimiter, name: path }) as unknown as Mailbox;

const slash = ['INBOX', 'INBOX/Job', 'john.doe', 'Projects/v1.2', 'back\\slash', 'Sale 100%', 'Ab%41', 'AbA'].map(p => mailbox(p, '/'));
const dot = ['INBOX', 'INBOX.a/b', 'INBOX.a', 'INBOX.a.b', 'INBOX.Sale 100%'].map(p => mailbox(p, '.'));

// The real router, so the param is decoded exactly the way the app sees it.
const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/mail/:mailAccountID/folder/:folderPath', component: {} }]
});

function paramOf(url: string): string {
    return MailboxDisplayUtils.folderParam(router.resolve(url).params.folderPath as string | string[]);
}

describe('MailboxDisplayUtils folder URLs', () => {

    for (const [label, list] of [['"/"-delimited', slash], ['"."-delimited', dot]] as const) {
        test(`every ${label} folder's URL resolves back to that folder`, () => {
            for (const mb of list) {
                const param = paramOf(MailboxDisplayUtils.folderUrl(1, mb));
                expect(MailboxDisplayUtils.findMailboxByFolderParam(list, param)?.path).toBe(mb.path);
            }
        });
    }

    test('a folder link\'s href, decoded once, resolves like the route param', () => {
        for (const mb of slash) {
            const href = router.resolve(MailboxDisplayUtils.folderUrl(1, mb)).href;
            const segment = href.match(/\/folder\/([^/?#]+)/)![1]!;
            expect(MailboxDisplayUtils.findMailboxByFolderParam(slash, decodeURIComponent(segment))?.path).toBe(mb.path);
        }
    });

    test('accepts a typed IMAP path, the "inbox" alias and another case', () => {
        expect(MailboxDisplayUtils.findMailboxByFolderParam(slash, paramOf('/mail/1/folder/INBOX'))?.path).toBe('INBOX');
        expect(MailboxDisplayUtils.findMailboxByFolderParam(slash, paramOf('/mail/1/folder/inbox'))?.path).toBe('INBOX');
        expect(MailboxDisplayUtils.findMailboxByFolderParam(dot, 'inbox.a')?.path).toBe('INBOX.a');
    });

    test('an unknown folder resolves to nothing instead of a look-alike', () => {
        expect(MailboxDisplayUtils.findMailboxByFolderParam(slash, 'john/doe')).toBeUndefined();
        expect(MailboxDisplayUtils.findMailboxByFolderParam(slash, '')).toBeUndefined();
    });
});
