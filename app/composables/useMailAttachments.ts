/**
 * Helpers for viewing and downloading mail attachments.
 *
 * - Preview opens a real, same-origin, authenticated URL whose last path segment
 *   is the filename (e.g. `/attachments/Report.pdf?...`), served by the nitro
 *   route in `server/routes/attachments/[filename].get.ts`. That route reads the
 *   session cookie and proxies the bytes from the API, so the tab shows a proper
 *   filename instead of an opaque `blob:` UUID and still requires authentication.
 * - Download fetches the bytes directly from the API with a bearer token (the
 *   generated SDK returns JSON, so it can't be used for a binary body) and saves
 *   them via a transient object URL that is revoked right after. Nothing is
 *   persisted client-side.
 */

export interface AttachmentRef {
    accountId: number;
    mailboxPath: string;
    mailUid: number;
    attachmentId: number;
}

/**
 * MIME types that are safe to render inline. The preview route is same-origin with
 * the app, so opening active content (text/html, image/svg+xml, ...) inline would
 * let it run script in-origin — an XSS vector. Only inert types are allowlisted;
 * everything else is downloaded instead. SVG is deliberately excluded because it
 * can carry scripts. The server route enforces the same allowlist.
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

/** Direct API URL for the attachment's raw bytes (used for downloads via fetch). */
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
 * Same-origin preview URL served by the nitro proxy route. It mirrors the email's
 * view route and ends in the filename (shown in the browser tab), e.g.
 * `/mail/1/folder/INBOX%2FBekannte/68/attachment/Report.pdf`. The server resolves
 * the filename to the attachment and authenticates via the session cookie.
 */
function buildPreviewUrl(ref: AttachmentRef, filename: string): string {
    const folder = encodeURIComponent(ref.mailboxPath);
    const name = encodeURIComponent(filename);
    return `/mail/${ref.accountId}/folder/${folder}/${ref.mailUid}/attachment/${name}`;
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
     * Preview an attachment. Inert types (PDF, raster images) open inline in a new
     * tab at a real, authenticated, filename-bearing URL. Anything else — including
     * active content like HTML or SVG that could execute script in this origin — is
     * downloaded instead. The server route enforces the same allowlist, so this
     * check is only to avoid opening a blank tab that immediately downloads.
     */
    async function openAttachment(ref: AttachmentRef, filename?: string, contentType?: string | null): Promise<void> {
        // The preview URL identifies the attachment by filename, so it needs one.
        // Non-previewable or unnamed attachments fall back to the id-based download.
        if (!isPreviewableType(contentType) || !filename) {
            await downloadAttachment(ref, filename);
            return;
        }

        window.open(buildPreviewUrl(ref, filename), '_blank', 'noopener,noreferrer');
    }

    return { downloadAttachment, openAttachment };
}
