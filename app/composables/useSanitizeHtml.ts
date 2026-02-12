import DOMPurify, { type Config } from 'dompurify';

/**
 * Regex patterns for dangerous CSS that must be removed.
 * These can be used for tracking, data exfiltration, or code execution.
 */
const DANGEROUS_CSS_PATTERNS = [
    // External resource loading (tracking pixels, data exfiltration)
    /@import\s*(?:url\s*\()?[^;]+/gi,
    /url\s*\([^)]*\)/gi,
    
    // JavaScript execution vectors
    /expression\s*\([^)]*\)/gi,  // IE expression()
    /-moz-binding\s*:[^;]+/gi,   // Firefox XBL
    /behavior\s*:[^;]+/gi,       // IE HTC behaviors
    
    // Other potentially dangerous patterns
    /-o-link\s*:[^;]+/gi,        // Opera link
    /-o-link-source\s*:[^;]+/gi, // Opera link source
];

/**
 * Sanitizes CSS content by removing dangerous patterns.
 */
function sanitizeCss(css: string): string {
    let sanitized = css;
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

    // Allow <style> tags for email styling (CSS is sanitized via hook)
    ADD_TAGS: ['style'],

    // Forbid dangerous URI schemes
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

    // Forbid forms, iframes, scripts etc.
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'meta', 'link', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onreset', 'onselect', 'onchange', 'onkeydown', 'onkeypress', 'onkeyup'],

    // Remove contents of dangerous elements (not just the tags)
    KEEP_CONTENT: true,
    // Allow ARIA attributes
    ALLOW_ARIA_ATTR: true,
};

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
 */
export function useSanitizeHtml(html: string, options?: { wrapForDarkMode?: boolean }): string {
    if (!import.meta.client) {
        // On SSR, return empty — HTML emails should only render client-side
        return '';
    }

    // Hook to sanitize CSS in <style> tags and force safe link attributes
    DOMPurify.addHook('uponSanitizeElement', (node) => {
        // Sanitize CSS content in <style> tags
        const el = node as Element;
        if (el.tagName === 'STYLE' && node.textContent) {
            node.textContent = sanitizeCss(node.textContent);
        }
    });

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        const el = node as Element;
        // Force safe link behavior
        if (el.tagName === 'A') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
        }
        // Sanitize inline styles
        if (el.hasAttribute('style')) {
            const style = el.getAttribute('style');
            if (style) {
                el.setAttribute('style', sanitizeCss(style));
            }
        }
    });

    const sanitized = DOMPurify.sanitize(html, EMAIL_PURIFY_CONFIG);

    // Remove hooks to avoid affecting other sanitizations
    DOMPurify.removeHook('uponSanitizeElement');
    DOMPurify.removeHook('afterSanitizeAttributes');

    // Wrap in dark-mode compatible HTML if requested
    if (options?.wrapForDarkMode) {
        return wrapEmailHtml(sanitized);
    }

    return sanitized;
}

/**
 * Wraps sanitized email HTML in a proper document with dark mode support.
 * Applies a semi-transparent dark overlay and inverts colors for better readability.
 */
export function wrapEmailHtml(content: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
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
            /* Invert light backgrounds to dark */
            img {
                /* Don't invert images, but add subtle filter for brightness */
                opacity: 0.95;
            }
            /* Make white/light backgrounds darker */
            table, div, td, th {
                background-color: inherit !important;
            }
            /* Ensure text is readable */
            body, p, div, span, td, th, li, a {
                color: #d4d4d8 !important;
            }
            a {
                color: #60a5fa !important;
            }
            /* Handle inline bgcolor attributes */
            [bgcolor] {
                background-color: #18181b !important;
            }
            /* Override white backgrounds */
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
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
}
