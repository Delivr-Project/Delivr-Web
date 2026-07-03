/**
 * Helpers for fetching mail attachments from the Delivr API.
 *
 * Attachments are streamed from the API on demand (the server never stores or
 * caches them). On the client we likewise only hold a transient `blob:` object
 * URL, which is revoked immediately after use — nothing is persisted here either.
 *
 * We use a direct authenticated `fetch` rather than the generated SDK because the
 * endpoint returns a binary body, and because an `<img src>`/download needs the
 * bytes as a Blob rather than parsed JSON.
 */

export interface AttachmentRef {
    accountId: number;
    mailboxPath: string;
    mailUid: number;
    attachmentId: number;
}

function buildAttachmentUrl(ref: AttachmentRef, download: boolean): string {
    const apiUrl = useRuntimeConfig().public.apiUrl;
    const base = apiUrl.replace(/\/$/, '');
    const path =
        `/mail-accounts/${ref.accountId}` +
        `/mailboxes/${encodeURIComponent(ref.mailboxPath)}` +
        `/mails/${ref.mailUid}` +
        `/attachments/${ref.attachmentId}`;
    return `${base}${path}${download ? '?download=true' : ''}`;
}

/**
 * Fetch a single attachment's content as a Blob, authenticated with the current
 * session token. Throws if the request fails or the user is not authenticated.
 */
async function fetchAttachmentBlob(ref: AttachmentRef, download: boolean): Promise<Blob> {
    const token = useAppCookies().sessionToken.get().value;
    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(buildAttachmentUrl(ref, download), {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch attachment (status ${response.status})`);
    }

    return await response.blob();
}

export function useMailAttachments() {
    const toast = useToast();

    /**
     * Download an attachment to the user's device. Fetches the bytes with the
     * `attachment` disposition, then triggers a browser download via a transient
     * object URL that is revoked right after.
     */
    async function downloadAttachment(ref: AttachmentRef, filename?: string): Promise<void> {
        try {
            const blob = await fetchAttachmentBlob(ref, true);
            const url = URL.createObjectURL(blob);
            try {
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = filename || 'attachment';
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
            } finally {
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            toast.add({
                title: 'Download failed',
                description: (e as Error).message || 'Could not download the attachment.',
                color: 'error'
            });
        }
    }

    /**
     * Open an attachment inline in a new browser tab (e.g. to preview a PDF or
     * image). The object URL is revoked after a short delay so the new tab has
     * time to load it.
     */
    async function openAttachment(ref: AttachmentRef): Promise<void> {
        try {
            const blob = await fetchAttachmentBlob(ref, false);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            // Give the new tab time to load before releasing the object URL.
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (e) {
            toast.add({
                title: 'Preview failed',
                description: (e as Error).message || 'Could not open the attachment.',
                color: 'error'
            });
        }
    }

    return { downloadAttachment, openAttachment };
}
