import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify with strict settings suitable for rendering email HTML.
 * 
 * - Strips all JavaScript (scripts, event handlers, javascript: URIs)
 * - Allows safe HTML tags and attributes for email rendering
 * - Removes dangerous elements like `<form>`, `<object>`, `<embed>`, etc.
 */
export function useSanitizeHtml(html: string): string {
    if (!import.meta.client) {
        // On SSR, return empty — HTML emails should only render client-side
        return '';
    }

    return DOMPurify.sanitize(html, {
        // Allow only safe tags for email rendering
        ALLOWED_TAGS: [
            // Structure
            'div', 'span', 'p', 'br', 'hr',
            // Headings
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            // Text formatting
            'b', 'i', 'u', 'em', 'strong', 'small', 'sub', 'sup', 's', 'strike', 'del', 'ins', 'mark',
            // Lists
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            // Links & images
            'a', 'img',
            // Tables
            'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
            // Semantic
            'blockquote', 'pre', 'code', 'abbr', 'address', 'cite', 'q',
            // Layout (common in email HTML)
            'center', 'font',
        ],
        ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'width', 'height',
            'style', 'class', 'id', 'dir', 'lang',
            'colspan', 'rowspan', 'cellpadding', 'cellspacing', 'border',
            'align', 'valign', 'bgcolor', 'color', 'size', 'face',
            'target', 'rel',
        ],
        // Force all links to open in new tab
        ADD_ATTR: ['target'],
        // Forbid dangerous URI schemes
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
        // Remove contents of dangerous elements (not just the tags)
        KEEP_CONTENT: true,
        // Forbid forms, iframes, scripts etc.
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'meta', 'link', 'base'],
    });
}
