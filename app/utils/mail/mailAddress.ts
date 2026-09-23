/**
 * Parsing and formatting of email addresses as typed or pasted into the
 * composer's recipient fields: bare addresses (`a@b.com`), the `Name <a@b.com>`
 * form, and quoted display names that contain delimiters (`"Doe, Jane" <…>`).
 */
export namespace MailAddressUtils {

    export interface Address {
        name?: string;
        address: string;
    }

    // Deliberately permissive: the mail server has the final say, this only
    // catches obvious typos before a send is attempted.
    const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:".]+$/;

    export function isValid(address: string): boolean {
        return EMAIL_RE.test(address.trim());
    }

    /**
     * Split a recipient list on `,` / `;` (and line breaks), ignoring delimiters
     * inside quoted display names and angle brackets.
     */
    export function splitList(raw: string): string[] {
        const entries: string[] = [];
        let current = '';
        let quote: '"' | null = null;
        let escaped = false;
        let angleDepth = 0;

        for (const char of raw) {
            if (escaped) {
                current += char;
                escaped = false;
                continue;
            }

            if (quote && char === '\\') {
                current += char;
                escaped = true;
                continue;
            }

            if (char === '"' && angleDepth === 0) {
                quote = quote ? null : char;
            } else if (!quote && char === '<') {
                angleDepth++;
            } else if (!quote && char === '>' && angleDepth > 0) {
                angleDepth--;
            }

            if (!quote && angleDepth === 0 && (char === ',' || char === ';' || char === '\n')) {
                entries.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        entries.push(current);
        return entries.map(entry => entry.trim()).filter(entry => entry.length > 0);
    }

    /**
     * Parse one recipient entry. The address is returned even when it is not
     * valid, so the UI can show it for correction; check it with {@link isValid}.
     */
    export function parse(entry: string): Address {
        const trimmed = entry.trim();
        const angle = trimmed.match(/^(.*)<([^<>]*)>\s*$/s);
        if (angle) {
            const name = unquote(angle[1]!.trim());
            const address = stripMailto(angle[2]!.trim());
            return name ? { name, address } : { address };
        }
        return { address: stripMailto(trimmed) };
    }

    export function parseList(raw: string): Address[] {
        return splitList(raw).map(parse);
    }

    /** `Name <address>`, quoting the name when it contains special characters. */
    export function format(address: Address): string {
        const name = address.name?.trim();
        if (!name) return address.address;
        const needsQuotes = /[",;:<>@()[\]\\]/.test(name);
        return needsQuotes
            ? `"${name.replace(/(["\\])/g, '\\$1')}" <${address.address}>`
            : `${name} <${address.address}>`;
    }

    /** Short label for a recipient chip: the display name, else the address. */
    export function label(address: Address): string {
        return address.name?.trim() || address.address;
    }

    export function isSame(a: string, b: string): boolean {
        return a.trim().toLowerCase() === b.trim().toLowerCase();
    }

    /** Drop duplicate addresses (case-insensitive), keeping the first occurrence. */
    export function dedupe(list: Address[]): Address[] {
        const seen = new Set<string>();
        return list.filter(address => {
            const key = address.address.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function unquote(name: string): string {
        const quoted = name.match(/^"(.*)"$/s) ?? name.match(/^'(.*)'$/s);
        return (quoted ? quoted[1]!.replace(/\\(.)/g, '$1') : name).trim();
    }

    function stripMailto(address: string): string {
        return address.replace(/^mailto:/i, '').trim();
    }
}
