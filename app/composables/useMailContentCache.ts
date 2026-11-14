import type { InjectionKey } from 'vue';
import type { MailData } from '~/utils/types';

type MailResponse =
    | { success: true; data: MailData }
    | { success: false; code: number; message: string };

/**
 * The mails opened (or about to be opened) in one folder view, kept in memory
 * so going back to a mail doesn't fetch it again.
 *
 * A mail's content never changes under its UID, so nothing here is refreshed.
 * Its flags do change — whoever shows a cached mail has to ask for them again.
 * The cache lives and dies with the folder view that created it: a UID is only
 * unique within its mailbox.
 */
export interface MailContentCache {
    /** The mail if it was loaded before, without waiting. */
    peek(uid: number): MailData | null;
    /** The mail from the cache or the API. A failed load isn't kept. */
    load(uid: number): Promise<MailResponse>;
    /** Start loading a mail the user is likely to open next. */
    prefetch(uid: number): void;
    drop(uid: number): void;
}

export const MAIL_CONTENT_CACHE: InjectionKey<MailContentCache> = Symbol('mail-content-cache');

export function createMailContentCache(accountId: number, mailboxPath: () => string, maxEntries = 30): MailContentCache {

    type Entry = { request: Promise<MailResponse>; data: MailData | null };

    // insertion order is the eviction order; a hit moves the mail to the end
    const entries = new Map<string, Entry>();
    const keyOf = (uid: number) => `${mailboxPath()}\n${uid}`;

    function fetchMail(uid: number) {
        const key = keyOf(uid);
        const entry = { data: null } as Entry;

        entry.request = (async (): Promise<MailResponse> => {
            const response = await useAPI(api => api.getMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUid({
                path: {
                    mailAccountID: accountId,
                    mailboxPath: mailboxPath(),
                    mailUID: uid,
                }
            }));

            if (response.success) {
                entry.data = response.data;
                return { success: true, data: response.data };
            }

            if (entries.get(key) === entry) entries.delete(key);
            return { success: false, code: response.code, message: response.message };
        })();

        entries.set(key, entry);
        while (entries.size > maxEntries) {
            entries.delete(entries.keys().next().value!);
        }

        return entry;
    }

    function touch(uid: number) {
        const key = keyOf(uid);
        const entry = entries.get(key);
        if (entry) {
            entries.delete(key);
            entries.set(key, entry);
        }
        return entry;
    }

    return {
        peek: (uid) => entries.get(keyOf(uid))?.data ?? null,
        load: (uid) => (touch(uid) ?? fetchMail(uid)).request,
        prefetch: (uid) => {
            if (!entries.has(keyOf(uid))) fetchMail(uid);
        },
        drop: (uid) => {
            entries.delete(keyOf(uid));
        }
    };
}
