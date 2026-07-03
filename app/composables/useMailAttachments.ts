/**
 * Helpers for fetching mail attachments from the Delivr API.
 *
 * Attachments are streamed from the API on demand (the server never stores or
 * caches them). On the client we likewise only hold a transient `blob:` object
 * URL: the download path revokes it immediately after the click, while the
 * preview path revokes it on a short timer so the new tab has time to load it.
 * Either way nothing is persisted here.
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

/**
 * MIME types that are safe to render inline in a new tab. A `blob:` URL inherits
 * this app's origin, so opening active content (text/html, image/svg+xml, ...)
 * there would let it run script in-origin — an XSS vector. Only inert types are
 * allowlisted; everything else is downloaded instead of previewed. SVG is
 * deliberately excluded because it can carry scripts.
 */
const PREVIEWABLE_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/x-icon',
    'image/vnd.microsoft.icon',
]);

/** True if the given content type may be safely previewed inline (see allowlist). */
export function isPreviewableType(contentType?: string | null): boolean {
    if (!contentType) return false;
    // Drop any parameters (e.g. "; charset=utf-8") and normalise casing.
    const type = contentType.split(';')[0]!.trim().toLowerCase();
    return PREVIEWABLE_MIME_TYPES.has(type);
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

/** Trigger a browser download for an already-fetched blob via a transient object URL. */
function triggerDownload(blob: Blob, filename?: string): void {
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
            triggerDownload(blob, filename);
        } catch (e) {
            toast.add({
                title: 'Download failed',
                description: (e as Error).message || 'Could not download the attachment.',
                color: 'error'
            });
        }
    }

    /**
     * Preview an attachment. Inert types (PDF, raster images) are opened inline in
     * a new tab; anything else — including active content like HTML or SVG that
     * could execute script in this origin via the `blob:` URL — is downloaded
     * instead. The allowlist is enforced on the fetched blob's actual type.
     */
    async function openAttachment(ref: AttachmentRef, filename?: string): Promise<void> {
        try {
            const blob = await fetchAttachmentBlob(ref, false);

            // Security: never render non-allowlisted types inline (XSS via blob: URL
            // inheriting the app origin). Fall back to a download for those.
            if (!isPreviewableType(blob.type)) {
                triggerDownload(blob, filename);
                return;
            }

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
