<script setup lang="ts">
import DOMPurify from 'dompurify';
import MailComposer from '~/components/mail/compose/MailComposer.vue';
import type { DraftContent, MailComposeSetup } from '~/composables/useMailDraft';
import { fetchAttachmentFile } from '~/composables/useMailAttachments';
import { MailAddressUtils } from '~/utils/mail/mailAddress';
import { MailIdentityUtils } from '~/utils/mail/mailIdentity';
import { MailComposeUtils } from '~/utils/mail/mailCompose';
import type { MailAccountWithMailboxes, MailData } from '~/utils/types';

type Address = MailAddressUtils.Address;

/**
 * The composer. What it starts from comes from the query:
 * - `?draft=<uid>[&folder=<path>]` continues a stored draft (Drafts folder by default)
 * - `?reply=<uid>` / `?replyAll=<uid>` / `?forward=<uid>`, with `&folder=<path>`
 *   of the original, starts a reply or forward
 * - otherwise a new message, optionally prefilled with `?to=` and `?subject=`
 */

// The composer keeps its state while the URL follows the stored draft (?draft=…).
definePageMeta({
    key: (route) => route.path,
});

const route = useRoute();
const toast = useToast();

const mailAccount = useSubrouterInjectedData<MailAccountWithMailboxes>('mail_account').inject();
const account = mailAccount.data.value;
const accountId = account.id;
const fallbackRoute = `/mail/${accountId}/folder/inbox`;

useSeoMeta({
    title: 'Compose | Delivr',
    description: 'Compose a new email'
});

const setup = shallowRef<MailComposeSetup | null>(null);
const loadingLabel = ref('Loading…');

function queryValue(name: string): string | null {
    const raw = route.query[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function uidParam(name: string): number | null {
    const value = Number.parseInt(queryValue(name) ?? '', 10);
    return Number.isInteger(value) && value > 0 ? value : null;
}

async function resolveDraftsFolder(): Promise<{ path: string; fallback: boolean }> {
    const response = await useAPI(api => api.getMailAccountsByMailAccountIdSpecialUse({ path: { mailAccountID: accountId } }));
    const path = response.success ? response.data.drafts?.path : undefined;
    return path ? { path, fallback: false } : { path: 'INBOX', fallback: true };
}

/**
 * Addresses to send from — the default identity, the account itself, then the
 * other identities — together with their signatures as editor content, keyed by
 * lowercased address.
 */
async function loadSenders(): Promise<{ senders: Address[]; signatures: Record<string, string> }> {
    const response = await useAPI(api => api.getMailAccountsByMailAccountIdIdentities({ path: { mailAccountID: accountId } }));
    const identities = response.success ? response.data : [];

    const signatures: Record<string, string> = {};
    for (const identity of identities) {
        if (!identity.signature) continue;
        signatures[identity.email_address.trim().toLowerCase()] = sanitizeStoredHtml(identity.signature);
    }

    return { senders: MailIdentityUtils.senderAddresses(account, identities), signatures };
}

async function loadMail(folder: string, uid: number): Promise<MailData | null> {
    const response = await useAPI(api => api.getMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUid({
        path: { mailAccountID: accountId, mailboxPath: folder, mailUID: uid }
    }));
    return response.success ? response.data : null;
}

/**
 * Mail HTML as safe editor content. Quoted originals lose their styling and
 * media (the editor can't show them anyway); drafts keep inline styles, which
 * carry their text alignment.
 */
function toEditorHtml(mail: MailData, keepStyles: boolean): string {
    if (!mail.body?.html) return MailComposeUtils.textToHtml(mail.body?.text ?? '');
    return sanitizeStoredHtml(mail.body.html, keepStyles);
}

function sanitizeStoredHtml(html: string, keepStyles = true): string {
    return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        // The signature marker has to survive, or the composer can't find it again.
        ADD_ATTR: [MailComposeUtils.SIGNATURE_ATTRIBUTE],
        FORBID_TAGS: ['style', 'img', 'picture', 'video', 'audio', 'iframe', 'svg', 'form', 'input', 'button'],
        FORBID_ATTR: keepStyles ? ['class', 'id'] : ['style', 'class', 'id']
    });
}

function referencesOf(mail: MailData): string[] | undefined {
    if (!mail.references) return undefined;
    return typeof mail.references === 'string' ? mail.references.split(/\s+/).filter(Boolean) : mail.references;
}

function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Reply from the address the original was sent to, if it's one of ours. */
function senderAddressedBy(mail: MailData, senders: Address[]): Address | undefined {
    const addressed = new Set([...mail.to, ...mail.cc].map(address => address.address.toLowerCase()));
    return senders.find(sender => addressed.has(sender.address.toLowerCase()));
}

/** The original's attachments as files for a forward; failures are reported, not fatal. */
async function forwardedFiles(mail: MailData, folder: string): Promise<File[]> {
    if (mail.attachments.length === 0) return [];
    loadingLabel.value = `Preparing ${mail.attachments.length} attachment${mail.attachments.length === 1 ? '' : 's'}…`;

    const files = await Promise.all(mail.attachments.map(attachment =>
        fetchAttachmentFile(
            { accountId, mailboxPath: folder, mailUid: mail.uid, attachmentId: attachment.id },
            attachment.filename ?? undefined,
            attachment.contentType
        ).catch(() => null)
    ));

    const failed = files.filter(file => file === null).length;
    if (failed > 0) {
        toast.add({
            title: `${failed} attachment${failed === 1 ? '' : 's'} not included`,
            description: 'They could not be loaded from the original message.',
            color: 'warning'
        });
    }
    return files.filter((file): file is File => file !== null);
}

async function load() {
    const [drafts, { senders, signatures }] = await Promise.all([resolveDraftsFolder(), loadSenders()]);

    /** The signature of an address, as editor content. */
    const signatureOf = (from: Address | null | undefined) =>
        from ? signatures[from.address.trim().toLowerCase()] ?? '' : '';

    /** Put the sender's signature below the user's text, above any quote. */
    const signed = (html: string, from: Address | null | undefined) => {
        const signature = signatureOf(from);
        return signature ? MailComposeUtils.withSignature(html, signature) : html;
    };

    const blank: DraftContent = {
        from: senders[0] ?? null,
        to: [],
        cc: [],
        bcc: [],
        subject: '',
        html: '',
        priority: 'normal'
    };
    const base = { draftsPath: drafts.path, draftsFallback: drafts.fallback, senders, signatures };

    const folder = queryValue('folder');
    const draftUid = uidParam('draft');
    const replyUid = uidParam('reply') ?? uidParam('replyAll');
    const forwardUid = uidParam('forward');

    if (draftUid !== null) {
        const draftFolder = folder ?? drafts.path;
        const mail = await loadMail(draftFolder, draftUid);
        if (mail) {
            setup.value = {
                ...base,
                mode: 'draft',
                draftsPath: draftFolder,
                draftsFallback: folder === null && drafts.fallback,
                content: {
                    from: mail.from ?? blank.from,
                    to: mail.to,
                    cc: mail.cc,
                    bcc: mail.bcc,
                    subject: mail.subject ?? '',
                    html: MailComposeUtils.fromEmailHtml(toEditorHtml(mail, true)),
                    priority: mail.priority ?? 'normal',
                    inReplyTo: mail.inReplyTo,
                    references: referencesOf(mail)
                },
                storedAttachments: mail.attachments,
                draftUid
            };
            return;
        }
        toast.add({
            title: 'Draft not found',
            description: 'It may have been sent or deleted in the meantime. Starting a new message instead.',
            color: 'warning'
        });
    } else if (replyUid !== null || forwardUid !== null) {
        const sourceFolder = folder ?? 'INBOX';
        const mail = await loadMail(sourceFolder, (replyUid ?? forwardUid)!);
        if (mail) {
            const quotedHtml = toEditorHtml(mail, false);
            const from = senderAddressedBy(mail, senders) ?? blank.from;

            if (forwardUid !== null) {
                const prefill = MailComposeUtils.buildForward(mail, { quotedHtml, formatTimestamp });
                setup.value = {
                    ...base,
                    mode: 'forward',
                    content: { ...blank, ...prefill, from, html: signed(prefill.html, from) },
                    pendingFiles: await forwardedFiles(mail, sourceFolder)
                };
            } else {
                const replyAll = uidParam('replyAll') !== null;
                const prefill = MailComposeUtils.buildReply(mail, {
                    ownAddresses: [...senders.map(sender => sender.address), account.smtp_username],
                    replyAll,
                    quotedHtml,
                    formatTimestamp
                });
                setup.value = {
                    ...base,
                    mode: replyAll ? 'replyAll' : 'reply',
                    content: { ...blank, ...prefill, from, html: signed(prefill.html, from) }
                };
            }
            return;
        }
        toast.add({
            title: 'Message not found',
            description: 'The original message could not be loaded. Starting a new message instead.',
            color: 'warning'
        });
    }

    setup.value = {
        ...base,
        mode: 'new',
        content: {
            ...blank,
            to: MailAddressUtils.parseList(queryValue('to') ?? ''),
            subject: queryValue('subject') ?? '',
            // An empty paragraph keeps the cursor above the signature.
            html: signed('<p></p>', blank.from)
        }
    };
}

onMounted(load);
</script>

<template>
    <MailComposer
        v-if="setup"
        :account-id="accountId"
        :setup="setup"
        :fallback-route="fallbackRoute"
    />

    <UDashboardPanel v-else id="mail-compose" :ui="{ body: 'p-0 sm:p-6 lg:py-8' }">
        <template #header>
            <UDashboardNavbar title="Compose" icon="i-lucide-pen-square" />
        </template>

        <template #body>
            <div class="w-full lg:max-w-4xl mx-auto sm:rounded-xl sm:border border-default bg-default/60 overflow-clip">
                <div class="divide-y divide-default border-b border-default">
                    <div v-for="width in ['w-56', 'w-72', 'w-2/3']" :key="width" class="flex items-center gap-3 px-4 sm:px-6 py-3.5">
                        <USkeleton class="h-4 w-14 shrink-0" />
                        <USkeleton class="h-4" :class="width" />
                    </div>
                </div>
                <div class="px-4 sm:px-6 py-2.5 border-b border-default flex gap-2">
                    <USkeleton v-for="i in 8" :key="i" class="size-7 rounded-md" />
                </div>
                <div class="px-4 sm:px-6 py-5 space-y-3 min-h-72">
                    <USkeleton class="h-4 w-11/12" />
                    <USkeleton class="h-4 w-10/12" />
                    <USkeleton class="h-4 w-7/12" />
                    <p class="text-xs text-dimmed pt-4">{{ loadingLabel }}</p>
                </div>
            </div>
        </template>
    </UDashboardPanel>
</template>
