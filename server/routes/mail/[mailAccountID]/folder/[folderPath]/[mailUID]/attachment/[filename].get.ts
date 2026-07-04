/**
 * Same-origin, authenticated proxy for viewing a mail attachment.
 *
 * The URL mirrors the email's own view route and ends in the filename, e.g.
 * `/mail/1/folder/INBOX%2FBekannte/68/attachment/Report.pdf`. A browser tab can't
 * send an `Authorization` header and a raw `blob:` URL shows an opaque UUID, so
 * this route authenticates via the session cookie, forwards to the Delivr API with
 * a bearer token, and streams the bytes back — nothing is stored on disk.
 *
 * The URL carries the filename (not the attachment index the API uses), so we first
 * look up the attachment list to resolve the filename to its id, then stream its
 * content. Because this is served from the app's own origin, only inert content
 * types render inline; anything active (HTML, SVG, ...) is forced to download so it
 * cannot execute script in the app origin.
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

function isPreviewable(contentType: string): boolean {
    return PREVIEWABLE_MIME_TYPES.has(contentType.split(';')[0]!.trim().toLowerCase());
}

/** RFC 5987-safe Content-Disposition value (ASCII fallback + UTF-8 filename*). */
function contentDisposition(type: 'inline' | 'attachment', filename: string): string {
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const encoded = encodeURIComponent(filename).replace(/['()*!]/g, c =>
        '%' + c.charCodeAt(0).toString(16).toUpperCase()
    );
    return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export default defineEventHandler(async (event) => {
    const token = getCookie(event, 'dla_session_token');
    if (!token) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const accountId = Number(getRouterParam(event, 'mailAccountID'));
    const uid = Number(getRouterParam(event, 'mailUID'));

    // Router params are not auto-decoded by h3; the folder segment is a single
    // percent-encoded IMAP path (e.g. "INBOX%2FBekannte") and the filename is the
    // visible last segment.
    let mailbox: string;
    let filename: string;
    try {
        mailbox = decodeURIComponent(getRouterParam(event, 'folderPath') || '');
        filename = decodeURIComponent(getRouterParam(event, 'filename') || '');
    } catch {
        throw createError({ statusCode: 400, statusMessage: 'Malformed attachment URL' });
    }

    if (!Number.isFinite(accountId) || !mailbox || !Number.isFinite(uid) || !filename) {
        throw createError({ statusCode: 400, statusMessage: 'Missing or invalid attachment parameters' });
    }

    const apiUrl = useRuntimeConfig(event).public.apiUrl.replace(/\/$/, '');
    const mailBase =
        `${apiUrl}/mail-accounts/${accountId}` +
        `/mailboxes/${encodeURIComponent(mailbox)}` +
        `/mails/${uid}`;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Resolve filename -> attachment id (the API addresses attachments by index).
    const listResponse = await fetch(`${mailBase}/attachments`, { headers: authHeaders });
    if (!listResponse.ok) {
        throw createError({
            statusCode: listResponse.status === 401 ? 401 : listResponse.status === 404 ? 404 : 502,
            statusMessage: 'Failed to load attachments'
        });
    }
    const listJson = await listResponse.json() as { data?: Array<{ id: number; filename?: string }> };
    const match = listJson.data?.find(a => a.filename === filename);
    if (!match) {
        throw createError({ statusCode: 404, statusMessage: 'Attachment not found' });
    }

    const upstream = await fetch(`${mailBase}/attachments/${match.id}`, { headers: authHeaders });
    if (!upstream.ok || !upstream.body) {
        throw createError({
            statusCode: upstream.status === 401 ? 401 : upstream.status === 404 ? 404 : 502,
            statusMessage: 'Failed to fetch attachment'
        });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const disposition = isPreviewable(contentType) ? 'inline' : 'attachment';

    setResponseHeaders(event, {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition(disposition, filename),
        // Never cache attachment bytes at any hop.
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'X-Content-Type-Options': 'nosniff',
    });

    const contentLength = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > 0) {
        setResponseHeader(event, 'Content-Length', contentLength);
    }

    return upstream.body;
});
