import DOMPurify, { type Config } from 'dompurify';

/**
 * Regex patterns for dangerous CSS that must be removed.
 * These can be used for tracking, data exfiltration, or code execution.
 */
const DANGEROUS_CSS_PATTERNS = [
    // Block @import - can load external CSS with malicious content
    /@import\s*(?:url\s*\()?[^;]+/gi,
    
    // JavaScript execution vectors
    /expression\s*\([^)]*\)/gi,  // IE expression()
    /-moz-binding\s*:[^;]+/gi,   // Firefox XBL
    /behavior\s*:[^;]+/gi,       // IE HTC behaviors
    
    // Other potentially dangerous patterns
    /-o-link\s*:[^;]+/gi,        // Opera link
    /-o-link-source\s*:[^;]+/gi, // Opera link source
];

/**
 * Allowed URL schemes in CSS url() values.
 * - http/https: Allow external images (user can block at browser level)
 * - data:image/: Allow inline base64 images (common in emails)
 * - cid: Allow Content-ID references for embedded attachments
 */
const SAFE_CSS_URL_SCHEMES = /^(?:https?:\/\/|data:image\/|cid:)/i;

/**
 * Dangerous URL schemes that must be blocked in CSS url() values.
 */
const DANGEROUS_CSS_URL_SCHEMES = /^(?:javascript:|vbscript:|data:(?!image\/))/i;

/**
 * Matches an external/remote resource URL: absolute http(s) or protocol-relative (`//host`).
 * Used to block auto-loading of remote images/tracking pixels until the user opts in.
 */
const REMOTE_URL_PATTERN = /^(?:https?:)?\/\//i;

/**
 * True if the given value references a remote resource anywhere (e.g. inside a `srcset`
 * list where the remote URL may not be at the start of the string).
 */
function referencesRemoteResource(value: string): boolean {
    return /(?:^|[\s,'"(])(?:https?:)?\/\//i.test(value);
}

interface CssSanitizeOptions {
    /** When true, external http(s)/protocol-relative url() values are stripped. */
    blockRemote?: boolean;
    /** Called whenever a remote resource is stripped due to `blockRemote`. */
    onRemoteBlocked?: () => void;
}

/**
 * Sanitizes a single CSS url() value.
 * Returns the url() unchanged if safe, or a blocked comment if dangerous/remote-blocked.
 */
function sanitizeCssUrl(urlMatch: string, options: CssSanitizeOptions): string {
    // Extract the URL from url('...') or url("...") or url(...)
    const urlContent = urlMatch.match(/url\s*\(\s*(['"]?)([^'"()]*)\1\s*\)/i);
    if (!urlContent || !urlContent[2]) {
        return '/* blocked */';
    }

    const url = urlContent[2].trim();

    // Block dangerous schemes
    if (DANGEROUS_CSS_URL_SCHEMES.test(url)) {
        return '/* blocked */';
    }

    // Privacy: when remote-content blocking is active, strip external resources
    // (background images, CSS tracking pixels) but keep inline data:/cid: images.
    if (options.blockRemote && REMOTE_URL_PATTERN.test(url)) {
        options.onRemoteBlocked?.();
        return '/* blocked-remote */';
    }

    // Allow safe schemes
    if (SAFE_CSS_URL_SCHEMES.test(url)) {
        return urlMatch;
    }

    // Allow relative URLs (no scheme) - these are relative to the email context
    if (!url.includes(':') || url.startsWith('#')) {
        return urlMatch;
    }

    // Block unknown schemes
    return '/* blocked */';
}

/**
 * Sanitizes CSS content by removing dangerous patterns.
 * Allows safe url() values for images while blocking XSS vectors (and, optionally,
 * remote resources).
 */
function sanitizeCss(css: string, options: CssSanitizeOptions = {}): string {
    let sanitized = css;

    // First, handle url() values - allow safe ones, block dangerous/remote ones
    sanitized = sanitized.replace(/url\s*\([^)]*\)/gi, (match) => sanitizeCssUrl(match, options));

    // Then remove other dangerous patterns
    for (const pattern of DANGEROUS_CSS_PATTERNS) {
        sanitized = sanitized.replace(pattern, '/* removed */');
    }
    return sanitized;
}

/**
 * DOMPurify configuration for email HTML sanitization.
 * 
 * This is the ONLY sanitization layer - backend passes raw HTML,
 * client sanitizes before rendering using the browser's native DOM parser.
 * This approach is safer as browser DOM parsing matches rendering behavior exactly.
 */
const EMAIL_PURIFY_CONFIG: Config = {
    USE_PROFILES: { html: true },
    
    // Preserve full document structure including <html>, <head>, <body>
    // This is essential for <style> tags in <head> to be preserved
    WHOLE_DOCUMENT: true,

    // Allow <style>, <link> (for fonts), and <meta> tags for email styling
    // CSS is sanitized via hook, dangerous link/meta are filtered via hook
    ADD_TAGS: ['style', 'link', 'meta', 'head', 'body', 'html', 'title'],

    // Allow attributes needed for <link> and <meta>
    ADD_ATTR: ['rel', 'charset', 'http-equiv', 'content', 'name'],

    // Forbid dangerous URI schemes
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

    // Forbid forms, iframes, scripts etc.
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onreset', 'onselect', 'onchange', 'onkeydown', 'onkeypress', 'onkeyup'],

    // Remove contents of dangerous elements (not just the tags)
    KEEP_CONTENT: true,
    // Allow ARIA attributes
    ALLOW_ARIA_ATTR: true,
};

/**
 * Result of sanitizing email HTML.
 */
export interface SanitizeHtmlResult {
    /** The sanitized (and optionally dark-mode-wrapped) HTML. */
    html: string;
    /**
     * True if external/remote images or resources were present and stripped because
     * `blockRemoteContent` was enabled. Drives the "images blocked" banner.
     */
    hasRemoteContent: boolean;
}

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify with strict settings suitable for rendering email HTML.
 *
 * This is the ONLY sanitization layer - raw HTML from backend is sanitized
 * here before rendering. Using browser's native DOM parser ensures parsing
 * behavior matches rendering exactly (no JSDOM quirks).
 *
 * - Strips all JavaScript (scripts, event handlers, javascript: URIs)
 * - Sanitizes CSS (removes url(), @import, expression(), etc.)
 * - Allows safe HTML tags and attributes for email rendering
 * - Removes dangerous elements like `<form>`, `<object>`, `<embed>`, etc.
 * - Forces all links to open in new tabs with noopener noreferrer
 * - Optionally blocks remote images/resources (privacy) via `blockRemoteContent`
 */
export function useSanitizeHtml(
    html: string,
    options?: { wrapForDarkMode?: boolean; blockRemoteContent?: boolean }
): SanitizeHtmlResult {
    if (!import.meta.client) {
        // On SSR, return empty — HTML emails should only render client-side
        return { html: '', hasRemoteContent: false };
    }

    const blockRemote = options?.blockRemoteContent ?? false;
    let remoteBlockedCount = 0;
    const markRemoteBlocked = () => { remoteBlockedCount++; };

    // Hook to sanitize CSS in <style> tags, filter dangerous <link>/<meta> tags
    DOMPurify.addHook('uponSanitizeElement', (node) => {
        const el = node as Element;

        // Sanitize CSS content in <style> tags
        if (el.tagName === 'STYLE' && node.textContent) {
            node.textContent = sanitizeCss(node.textContent, { blockRemote, onRemoteBlocked: markRemoteBlocked });
        }

        // Filter <link> tags - only allow stylesheet links
        if (el.tagName === 'LINK') {
            const rel = el.getAttribute('rel')?.toLowerCase();
            // Only allow stylesheet links (for fonts, etc.)
            if (rel !== 'stylesheet') {
                el.remove();
                return;
            }
        }
        
        // Filter <meta> tags - only allow safe ones
        if (el.tagName === 'META') {
            const httpEquiv = el.getAttribute('http-equiv')?.toLowerCase();
            const name = el.getAttribute('name')?.toLowerCase();
            const charset = el.hasAttribute('charset');
            
            // Block dangerous http-equiv values (especially refresh which can redirect)
            if (httpEquiv && !['content-type', 'x-ua-compatible'].includes(httpEquiv)) {
                el.remove();
                return;
            }
            
            // Allow charset, viewport, and content-type meta tags
            if (!charset && !httpEquiv && name !== 'viewport') {
                el.remove();
                return;
            }
        }
    });

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        const el = node as Element;
        // Force safe link behavior
        if (el.tagName === 'A') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
        }

        // Privacy: strip remote images/resources so nothing is auto-fetched.
        // The original URLs are preserved in data-* attributes; images are simply
        // re-sanitized (blockRemote=false) once the user opts in to loading them.
        if (blockRemote) {
            if (el.tagName === 'IMG') {
                const src = el.getAttribute('src');
                if (src && REMOTE_URL_PATTERN.test(src.trim())) {
                    el.setAttribute('data-blocked-src', src);
                    el.removeAttribute('src');
                    markRemoteBlocked();
                }
                const srcset = el.getAttribute('srcset');
                if (srcset && referencesRemoteResource(srcset)) {
                    el.setAttribute('data-blocked-srcset', srcset);
                    el.removeAttribute('srcset');
                    markRemoteBlocked();
                }
            }

            // Legacy `background` attribute (common in email table layouts).
            const background = el.getAttribute('background');
            if (background && REMOTE_URL_PATTERN.test(background.trim())) {
                el.setAttribute('data-blocked-background', background);
                el.removeAttribute('background');
                markRemoteBlocked();
            }
        }

        // Sanitize inline styles (also strips remote url() when blockRemote is on)
        if (el.hasAttribute('style')) {
            const style = el.getAttribute('style');
            if (style) {
                el.setAttribute('style', sanitizeCss(style, { blockRemote, onRemoteBlocked: markRemoteBlocked }));
            }
        }
    });

    const sanitized = DOMPurify.sanitize(html, EMAIL_PURIFY_CONFIG);

    // Remove hooks to avoid affecting other sanitizations
    DOMPurify.removeHook('uponSanitizeElement');
    DOMPurify.removeHook('afterSanitizeAttributes');

    // Wrap in dark-mode compatible HTML if requested
    const finalHtml = options?.wrapForDarkMode ? wrapEmailHtml(sanitized) : sanitized;

    return { html: finalHtml, hasRemoteContent: remoteBlockedCount > 0 };
}

/**
 * Dark mode CSS styles to inject into email HTML.
 */
const DARK_MODE_STYLES = `
<style data-dark-mode-inject>
    /* Reset and base styles */
    * { box-sizing: border-box; }
    html, body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        overflow-x: hidden;
    }
    body {
        padding: 16px;
        background: transparent;
    }
    
    /* Dark mode detection and styling */
    @media (prefers-color-scheme: dark) {
        html {
            color-scheme: dark;
        }
        body {
            color: #e4e4e7;
        }
        img {
            opacity: 0.95;
        }
        table, div, td, th {
            background-color: inherit !important;
        }
        body, p, div, span, td, th, li, a {
            color: #d4d4d8 !important;
        }
        a {
            color: #60a5fa !important;
        }
        [bgcolor] {
            background-color: #18181b !important;
        }
        [style*="background:#fff"],
        [style*="background: #fff"],
        [style*="background:#FFF"],
        [style*="background: #FFF"],
        [style*="background:white"],
        [style*="background: white"],
        [style*="background-color:#fff"],
        [style*="background-color: #fff"],
        [style*="background-color:#FFF"],
        [style*="background-color: #FFF"],
        [style*="background-color:white"],
        [style*="background-color: white"],
        [style*="background:#ffffff"],
        [style*="background: #ffffff"],
        [style*="background-color:#ffffff"],
        [style*="background-color: #ffffff"] {
            background-color: #18181b !important;
        }
    }
    
    /* Table styling */
    table {
        border-collapse: collapse;
        max-width: 100%;
    }
    img {
        max-width: 100%;
        height: auto;
    }
    /* Blocked remote images: show a subtle placeholder instead of a broken icon */
    img[data-blocked-src],
    img[data-blocked-srcset] {
        min-width: 28px;
        min-height: 28px;
        background: rgba(120, 120, 120, 0.12);
        border: 1px dashed rgba(120, 120, 120, 0.45);
        border-radius: 4px;
    }
    a {
        color: #3b82f6;
        word-break: break-word;
    }
    pre, code {
        font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 13px;
    }
    blockquote {
        margin: 0.5em 0;
        padding-left: 1em;
        border-left: 3px solid #3b82f6;
    }
</style>`;

/**
 * Injects dark mode styles into sanitized email HTML.
 * If the HTML has a <head>, injects styles there. Otherwise wraps in a full document.
 */
export function wrapEmailHtml(content: string): string {
    // Check if content already has a <head> tag
    const headMatch = content.match(/<head[^>]*>/i);
    if (headMatch) {
        // Inject dark mode styles right after <head>
        return content.replace(headMatch[0], headMatch[0] + DARK_MODE_STYLES);
    }
    
    // Check if content has <html> but no <head>
    const htmlMatch = content.match(/<html[^>]*>/i);
    if (htmlMatch) {
        // Inject <head> with dark mode styles right after <html>
        return content.replace(htmlMatch[0], htmlMatch[0] + '<head>' + DARK_MODE_STYLES + '</head>');
    }
    
    // No document structure - wrap in full document
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${DARK_MODE_STYLES}
</head>
<body>
    ${content}
</body>
</html>`;
}
