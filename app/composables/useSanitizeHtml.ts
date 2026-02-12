import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify with strict settings suitable for rendering email HTML.
 * 
 * - Strips all JavaScript (scripts, event handlers, javascript: URIs)
 * - Allows safe HTML tags and attributes for email rendering
 * - Removes dangerous elements like `<form>`, `<object>`, `<embed>`, etc.
 * - Forces all links to open in new tabs
 */
export function useSanitizeHtml(html: string, options?: { wrapForDarkMode?: boolean }): string {
    if (!import.meta.client) {
        // On SSR, return empty — HTML emails should only render client-side
        return '';
    }

    // Add hook to force target="_blank" on all links
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A') {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });

    const sanitized = DOMPurify.sanitize(html, {

        

        USE_PROFILES: { html: true },
        // Allow only safe tags for email rendering
        // ALLOWED_TAGS: [
        //     // Structure
        //     'div', 'span', 'p', 'br', 'hr',
        //     // Headings
        //     'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        //     // Text formatting
        //     'b', 'i', 'u', 'em', 'strong', 'small', 'sub', 'sup', 's', 'strike', 'del', 'ins', 'mark',
        //     // Lists
        //     'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        //     // Links & images
        //     'a', 'img',
        //     // Tables
        //     'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
        //     // Semantic
        //     'blockquote', 'pre', 'code', 'abbr', 'address', 'cite', 'q',
        //     // Layout (common in email HTML)
        //     'center', 'font',
        // ],
        // ALLOWED_ATTR: [
        //     'href', 'src', 'alt', 'title', 'width', 'height',
        //     'style', 'class', 'id', 'dir', 'lang',
        //     'colspan', 'rowspan', 'cellpadding', 'cellspacing', 'border',
        //     'align', 'valign', 'bgcolor', 'color', 'size', 'face',
        //     'target', 'rel',
        // ],

        // Forbid dangerous URI schemes
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

        // Forbid forms, iframes, scripts etc.
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'meta', 'link', 'base'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onreset', 'onselect', 'onchange', 'onkeydown', 'onkeypress', 'onkeyup'],

        // Remove contents of dangerous elements (not just the tags)
        KEEP_CONTENT: true,
        // Allow ARIA attributes
        ALLOW_ARIA_ATTR: true,
    });

    // Remove the hook to avoid affecting other sanitizations
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
