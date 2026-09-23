import type {
    PostMailAccountsByMailAccountIdMailboxesByMailboxPathMailsData,
    PostMailAccountsByMailAccountIdMailboxesByMailboxPathMailsResponses,
    PutMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUidResponses
} from '~/api-client';
import { client } from '~/api-client/client.gen';
import type { MailAddressUtils } from '~/utils/mail/mailAddress';
import { MailComposeUtils } from '~/utils/mail/mailCompose';
import type { MailData } from '~/utils/types';

type Address = MailAddressUtils.Address;
type ApiMail = PostMailAccountsByMailAccountIdMailboxesByMailboxPathMailsData['body'];
type CreatedDraft = PostMailAccountsByMailAccountIdMailboxesByMailboxPathMailsResponses[200]['data'];
type UpdatedDraft = PutMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUidResponses[200]['data'];

export type StoredAttachment = MailData['attachments'][number];
export type MailPriority = 'normal' | 'high' | 'low';

/**
 * An attachment as shown in the composer: already part of the stored draft
 * (`storedId` addresses it there), or a local file waiting for the next save.
 */
export type ComposeAttachment = {
    key: string;
    filename: string;
    contentType: string;
    size: number;
} & ({ kind: 'stored'; storedId: number } | { kind: 'pending'; file: File });

export interface DraftContent {
    from: Address | null;
    to: Address[];
    cc: Address[];
    bcc: Address[];
    subject: string;
    /** Editor HTML. */
    html: string;
    priority: MailPriority;
    inReplyTo?: string;
    references?: string[];
}

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Everything the composer starts from (a new message, a reply, a stored draft…). */
export interface MailComposeSetup {
    mode: MailComposeUtils.Mode;
    /** Mailbox the draft is stored in. */
    draftsPath: string;
    /** No Drafts folder was found, so drafts go to `draftsPath` (the Inbox) instead. */
    draftsFallback?: boolean;
    /** Addresses the mail can be sent from; the first one is the default. */
    senders: Address[];
    content: DraftContent;
    storedAttachments?: StoredAttachment[];
    pendingFiles?: File[];
    draftUid?: number | null;
}

export interface UseMailDraftOptions {
    accountId: number;
    /** Mailbox the draft is stored in. */
    draftsPath: string;
    content: DraftContent;
    /** Attachments of the stored draft being edited. */
    storedAttachments?: StoredAttachment[];
    /** Local files to attach (e.g. the originals of a forwarded mail). */
    pendingFiles?: File[];
    /** UID of the stored draft being edited, if any. */
    draftUid?: number | null;
    /** Autosave after this much inactivity (ms). */
    autosaveDelay?: number;
    /** …but at the latest this long after the first unsaved change (ms). */
    autosaveMaxWait?: number;
}

export type DraftSendResult =
    | { ok: true; savedToSent: boolean }
    | { ok: false; error: string };

type SaveResult = { uid: number | null; attachments: StoredAttachment[] };

type ApiEnvelope<T> =
    | { success: true; code: number; message: string; data: T }
    | { success: false; code: number; message: string; data?: unknown };

/** A save the server rejected; `retryable` is false for requests that would fail the same way again. */
class DraftSaveError extends Error {
    constructor(message: string, readonly code: number, readonly retryable: boolean) {
        super(message);
    }
}

const RETRY_DELAY = 15_000;

let attachmentKeyCounter = 0;
function nextAttachmentKey(): string {
    return `attachment-${++attachmentKeyCounter}`;
}

function storedEntry(attachment: StoredAttachment): ComposeAttachment {
    return {
        key: nextAttachmentKey(),
        kind: 'stored',
        storedId: attachment.id,
        filename: attachment.filename || 'attachment',
        contentType: attachment.contentType,
        size: attachment.size
    };
}

function pendingEntry(file: File): ComposeAttachment {
    return {
        key: nextAttachmentKey(),
        kind: 'pending',
        file,
        filename: file.name || 'attachment',
        contentType: file.type || 'application/octet-stream',
        size: file.size
    };
}

/**
 * State and persistence of one draft in the composer.
 *
 * Changes are autosaved to the Drafts mailbox after a short pause in typing.
 * Saves are serialized: the first creates the draft, later ones replace it via
 * the API's update route (which keeps its stored attachments, adds uploads and
 * drops removed ones), so attachments are uploaded once rather than per save.
 * Nothing is stored before the first edit, so opening a reply and leaving
 * again doesn't leave a draft behind.
 */
export function useMailDraft(options: UseMailDraftOptions) {
    const {
        accountId,
        draftsPath,
        autosaveDelay = 2_500,
        autosaveMaxWait = 20_000
    } = options;

    const toast = useToast();

    const content = reactive<DraftContent>(JSON.parse(JSON.stringify(options.content)));
    const attachments = ref<ComposeAttachment[]>([
        ...(options.storedAttachments ?? []).map(storedEntry),
        ...(options.pendingFiles ?? []).map(pendingEntry)
    ]);
    /** Attachments of the draft as currently stored on the server. */
    const stored = ref<StoredAttachment[]>([...(options.storedAttachments ?? [])]);

    const draftUid = ref<number | null>(options.draftUid ?? null);
    const status = ref<DraftSaveStatus>(draftUid.value !== null ? 'saved' : 'idle');
    const lastSavedAt = ref<number | null>(null);
    const saveError = ref<string | null>(null);
    const sending = ref(false);
    /** Set once the draft is sent or discarded; nothing is saved after that. */
    const closed = ref(false);

    // Everything that ends up in the stored draft. Attachments are tracked by key,
    // so an uploaded file turning into a stored attachment isn't a change.
    const contentSnapshot = computed(() => JSON.stringify(content));
    const attachmentKeys = computed(() => attachments.value.map(attachment => attachment.key));
    const snapshot = computed(() => `${contentSnapshot.value}\n${attachmentKeys.value.join('|')}`);
    const savedSnapshot = ref(snapshot.value);

    const isEmpty = computed(() =>
        content.to.length === 0 && content.cc.length === 0 && content.bcc.length === 0
        && content.subject.trim() === ''
        && MailComposeUtils.isBlankHtml(content.html)
        && attachments.value.length === 0
    );

    /** There are changes a save would store (an empty new message is never stored). */
    const hasUnsavedChanges = computed(() =>
        !closed.value
        && snapshot.value !== savedSnapshot.value
        && !(draftUid.value === null && isEmpty.value)
    );

    // ── Autosave scheduling ──

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function clearTimers() {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (maxWaitTimer) clearTimeout(maxWaitTimer);
        if (retryTimer) clearTimeout(retryTimer);
        debounceTimer = maxWaitTimer = retryTimer = null;
    }

    function scheduleSave() {
        if (sending.value || !hasUnsavedChanges.value) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void save(), autosaveDelay);
        maxWaitTimer ??= setTimeout(() => void save(), autosaveMaxWait);
    }

    watch(snapshot, () => scheduleSave());
    onScopeDispose(clearTimers);

    // ── Saving ──

    let inFlight: Promise<boolean> | null = null;

    /**
     * Store the current content now. Resolves `true` once the stored draft is up
     * to date. `force` also stores an unchanged draft that doesn't exist yet
     * (sending needs a stored draft).
     */
    async function save(saveOptions: { force?: boolean } = {}): Promise<boolean> {
        if (closed.value) return false;

        if (inFlight) {
            // Let the running save finish, then store whatever changed meanwhile.
            await inFlight;
            return save(saveOptions);
        }

        const needed = hasUnsavedChanges.value || (saveOptions.force === true && draftUid.value === null);
        if (!needed) return status.value !== 'error' || snapshot.value === savedSnapshot.value;

        clearTimers();
        inFlight = performSave();
        try {
            return await inFlight;
        } finally {
            inFlight = null;
        }
    }

    async function performSave(): Promise<boolean> {
        status.value = 'saving';

        const savedContent = contentSnapshot.value;
        let savedKeys = attachmentKeys.value;
        const mail = toApiMail();
        const uploads = attachments.value.filter(attachment => attachment.kind === 'pending');
        const keptIds = new Set(attachments.value.flatMap(attachment =>
            attachment.kind === 'stored' ? [attachment.storedId] : []
        ));
        let kept = stored.value.filter(attachment => keptIds.has(attachment.id));
        const removeIds = stored.value.filter(attachment => !keptIds.has(attachment.id)).map(attachment => attachment.id);

        try {
            let result: SaveResult;
            if (draftUid.value === null) {
                result = await createDraft(mail, uploads);
            } else {
                try {
                    result = await updateDraft(draftUid.value, mail, uploads, removeIds);
                } catch (e) {
                    if (!(e instanceof DraftSaveError) || e.code !== 404) throw e;
                    result = await recreateLostDraft(mail, uploads, kept.length > 0);
                    kept = [];
                    savedKeys = savedKeys.filter(key => uploads.some(upload => upload.key === key));
                }
            }

            applyStoredAttachments(result.attachments, kept, uploads);
            // Without a known UID the next save creates a new draft instead.
            draftUid.value = result.uid;
            savedSnapshot.value = `${savedContent}\n${savedKeys.join('|')}`;
            lastSavedAt.value = Date.now();
            saveError.value = null;
            status.value = 'saved';

            // Pick up anything that changed while this save was running.
            scheduleSave();
            return true;
        } catch (e) {
            status.value = 'error';
            saveError.value = (e as Error).message || 'The draft could not be saved.';
            // Retry transient failures; rejected content only saves again once it changes.
            if (!(e instanceof DraftSaveError) || e.retryable) {
                retryTimer = setTimeout(() => void save(), RETRY_DELAY);
            }
            return false;
        }
    }

    /**
     * The stored draft was deleted or replaced elsewhere (e.g. in another tab).
     * Keep the user's work by saving it as a new draft; attachments that only
     * existed in the lost version can't be carried over.
     */
    async function recreateLostDraft(mail: ApiMail, uploads: ComposeAttachment[], hadStoredAttachments: boolean): Promise<SaveResult> {
        const result = await createDraft(mail, uploads);
        attachments.value = attachments.value.filter(attachment => attachment.kind === 'pending');
        toast.add({
            title: 'Draft was changed elsewhere',
            description: hadStoredAttachments
                ? 'Your message was saved as a new draft, without the attachments of the previous version.'
                : 'Your message was saved as a new draft.',
            color: 'warning'
        });
        return result;
    }

    /**
     * Map the server's attachment list onto the composer's entries. The API keeps
     * the kept attachments in order and appends uploads, so entries keep their
     * keys; if the server reports something else, its list wins.
     */
    function applyStoredAttachments(serverList: StoredAttachment[], kept: StoredAttachment[], uploads: ComposeAttachment[]) {
        stored.value = serverList;

        const expected = [...kept, ...uploads];
        const matches = serverList.length === expected.length && serverList.every((attachment, index) =>
            (attachment.filename || 'attachment') === (expected[index]!.filename || 'attachment')
            && attachment.size === expected[index]!.size
        );
        const uploadedKeys = new Set(uploads.map(upload => upload.key));

        if (!matches) {
            // Keep files added while the save was running; they go out with the next one.
            const addedMeanwhile = attachments.value.filter(attachment =>
                attachment.kind === 'pending' && !uploadedKeys.has(attachment.key)
            );
            attachments.value = [...serverList.map(storedEntry), ...addedMeanwhile];
            return;
        }

        const newIdForStored = new Map(kept.map((attachment, index) => [attachment.id, index]));
        const newIdForUpload = new Map(uploads.map((upload, index) => [upload.key, kept.length + index]));

        attachments.value = attachments.value.map((attachment): ComposeAttachment => {
            if (attachment.kind === 'stored') {
                const storedId = newIdForStored.get(attachment.storedId);
                return storedId === undefined ? attachment : { ...attachment, storedId };
            }
            const storedId = newIdForUpload.get(attachment.key);
            if (storedId === undefined) return attachment;
            const { key, filename, contentType, size } = attachment;
            return { key, filename, contentType, size, kind: 'stored', storedId };
        });
    }

    function toApiMail(): ApiMail {
        const blank = MailComposeUtils.isBlankHtml(content.html);
        return {
            from: content.from ? { ...content.from } : undefined,
            to: content.to.map(address => ({ ...address })),
            cc: content.cc.map(address => ({ ...address })),
            bcc: content.bcc.map(address => ({ ...address })),
            // Always sent (even empty): updates treat missing fields as "unchanged".
            subject: content.subject,
            body: {
                html: blank ? '' : MailComposeUtils.toEmailHtml(content.html),
                text: blank ? '' : MailComposeUtils.htmlToText(content.html)
            },
            priority: content.priority,
            inReplyTo: content.inReplyTo,
            references: content.references
        };
    }

    async function createDraft(mail: ApiMail, uploads: ComposeAttachment[]): Promise<SaveResult> {
        const body = { ...mail, flags: { draft: true, seen: true } };
        const path = { mailAccountID: accountId, mailboxPath: draftsPath };

        const response = uploads.length === 0
            ? await useAPI(api => api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMails({ path, body }))
            : await useAPI(() => client.post<'$fetch', ApiEnvelope<CreatedDraft>>({
                url: '/mail-accounts/{mailAccountID}/mailboxes/{mailboxPath}/mails',
                path,
                body: multipartBody(body, uploads),
                // The generated client defaults to JSON. Leave serialization and the
                // Content-Type to the browser so it adds the multipart boundary.
                bodySerializer: formData => formData,
                headers: { 'Content-Type': null }
            }));

        const data = unwrap<CreatedDraft>(response);
        return { uid: data.uid > 0 ? data.uid : null, attachments: data.attachments };
    }

    async function updateDraft(uid: number, mail: ApiMail, uploads: ComposeAttachment[], removeIds: number[]): Promise<SaveResult> {
        const body = { ...mail, removeAttachments: removeIds.length > 0 ? removeIds : undefined };
        const path = { mailAccountID: accountId, mailboxPath: draftsPath, mailUID: uid };

        const response = uploads.length === 0
            ? await useAPI(api => api.putMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUid({ path, body }))
            : await useAPI(() => client.put<'$fetch', ApiEnvelope<UpdatedDraft>>({
                url: '/mail-accounts/{mailAccountID}/mailboxes/{mailboxPath}/mails/{mailUID}',
                path,
                body: multipartBody(body, uploads),
                bodySerializer: formData => formData,
                headers: { 'Content-Type': null }
            }));

        const data = unwrap<UpdatedDraft>(response);
        return { uid: data.newUid ?? null, attachments: data.attachments ?? stored.value };
    }

    function multipartBody(mail: object, uploads: ComposeAttachment[]): FormData {
        const form = new FormData();
        form.set('mail', JSON.stringify(mail));
        for (const upload of uploads) {
            if (upload.kind === 'pending') form.append('attachments', upload.file, upload.filename);
        }
        return form;
    }

    function unwrap<T>(response: unknown): T {
        const envelope = response as ApiEnvelope<T> | undefined;
        if (envelope?.success) return envelope.data;
        const code = envelope?.code ?? 500;
        // Client errors mean the content itself is rejected; retrying won't help.
        throw new DraftSaveError(envelope?.message || 'The draft could not be saved.', code, code >= 500);
    }

    // ── Baseline ──

    let pristineWindow = true;

    /**
     * Treat the current state as unchanged. Called once the editor has finished
     * initializing: it may normalize the initial content (e.g. add a trailing
     * paragraph), which isn't an edit and must not trigger a save.
     */
    function markPristine() {
        // Too late once a save stored (or replaced) the draft.
        if (!pristineWindow || draftUid.value !== (options.draftUid ?? null)) return;
        pristineWindow = false;
        if (status.value === 'saving') return;
        clearTimers();
        savedSnapshot.value = snapshot.value;
    }

    // ── Attachments ──

    function addFiles(files: Iterable<File>) {
        const added = Array.from(files).map(pendingEntry);
        if (added.length > 0) attachments.value = [...attachments.value, ...added];
    }

    function removeAttachment(key: string) {
        attachments.value = attachments.value.filter(attachment => attachment.key !== key);
    }

    // ── Sending / discarding ──

    async function send(): Promise<DraftSendResult> {
        sending.value = true;
        try {
            const saved = await save({ force: true });
            if (!saved || draftUid.value === null) {
                return { ok: false, error: saveError.value ?? 'The draft could not be saved before sending.' };
            }

            clearTimers();
            const uid = draftUid.value;
            const response = await useAPI(api => api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUidSend({
                path: { mailAccountID: accountId, mailboxPath: draftsPath, mailUID: uid },
                body: { moveToSent: true }
            }));

            if (!response.success) {
                return { ok: false, error: response.message || 'The message could not be sent.' };
            }

            closed.value = true;
            return { ok: true, savedToSent: response.data.savedToSent };
        } finally {
            sending.value = false;
            if (!closed.value) scheduleSave();
        }
    }

    /** Stop saving and delete the stored draft, if there is one. */
    async function discard(): Promise<boolean> {
        closed.value = true;
        clearTimers();
        // A save that is already running still creates or replaces the draft;
        // wait for it so the version it produces is the one deleted.
        if (inFlight) await inFlight;

        if (draftUid.value === null) return true;
        const uid = draftUid.value;
        const response = await useAPI(api => api.deleteMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUid({
            path: { mailAccountID: accountId, mailboxPath: draftsPath, mailUID: uid },
            query: { permanent: true }
        }));

        if (!response.success) {
            closed.value = false;
            return false;
        }
        draftUid.value = null;
        return true;
    }

    return {
        content,
        attachments: computed(() => attachments.value),
        draftUid: readonly(draftUid),
        draftsPath,
        status: readonly(status),
        lastSavedAt: readonly(lastSavedAt),
        saveError: readonly(saveError),
        sending: readonly(sending),
        closed: readonly(closed),
        isEmpty,
        hasUnsavedChanges,
        markPristine,
        addFiles,
        removeAttachment,
        save,
        send,
        discard
    };
}

export type MailDraft = ReturnType<typeof useMailDraft>;
