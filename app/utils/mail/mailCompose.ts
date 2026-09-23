import { MailAddressUtils } from './mailAddress';

/**
 * Pure helpers for composing mail: reply / forward prefills (recipients, subject,
 * threading headers, quoted body) and conversions between the editor's HTML and
 * the plain-text part sent alongside it.
 */
export namespace MailComposeUtils {

    type Address = MailAddressUtils.Address;

    export type Mode = 'new' | 'draft' | 'reply' | 'replyAll' | 'forward';

    /** The parts of an existing mail a reply or forward is built from. */
    export interface SourceMail {
        from?: Address;
        to: Address[];
        cc: Address[];
        replyTo?: Address[];
        subject?: string;
        date?: number;
        messageId?: string;
        references?: string | string[];
    }

    export interface Prefill {
        to: Address[];
        cc: Address[];
        bcc: Address[];
        subject: string;
        html: string;
        inReplyTo?: string;
        references?: string[];
    }

    export interface ReplyOptions {
        /** The user's own addresses (account + identities); left out of the recipients. */
        ownAddresses: string[];
        replyAll: boolean;
        /** The original body as safe HTML, quoted below the reply. */
        quotedHtml: string;
        formatTimestamp: (timestamp: number) => string;
    }

    export interface ForwardOptions {
        /** The original body as safe HTML, included below the forward header. */
        quotedHtml: string;
        formatTimestamp: (timestamp: number) => string;
    }

    /** Prefix a subject once, so replying to "Re: x" doesn't produce "Re: Re: x". */
    export function prefixSubject(prefix: 'Re' | 'Fwd', subject: string | undefined): string {
        const base = (subject ?? '').trim();
        const existing = prefix === 'Re' ? /^re:/i : /^(fwd?|fw):/i;
        if (existing.test(base)) return base;
        return base ? `${prefix}: ${base}` : `${prefix}:`;
    }

    /** The `References` chain for a reply: the original's references plus its Message-ID. */
    export function referencesFor(source: SourceMail): string[] | undefined {
        const existing = typeof source.references === 'string'
            ? source.references.split(/\s+/)
            : source.references ?? [];
        const ids = [...existing, source.messageId]
            .map(id => id?.trim())
            .filter((id): id is string => !!id);
        const unique = [...new Set(ids)];
        return unique.length > 0 ? unique : undefined;
    }

    export function buildReply(source: SourceMail, options: ReplyOptions): Prefill {
        const own = new Set(options.ownAddresses.map(address => address.trim().toLowerCase()));
        const isOwn = (address: Address) => own.has(address.address.trim().toLowerCase());

        const target = source.replyTo?.length ? source.replyTo : source.from ? [source.from] : [];
        // Replying to your own mail (e.g. from Sent) continues with its recipients.
        const replyingToSelf = target.length > 0 && target.every(isOwn);

        const to = MailAddressUtils.dedupe(
            replyingToSelf ? source.to.filter(address => !isOwn(address))
                : options.replyAll ? [...target, ...source.to.filter(address => !isOwn(address))]
                    : target
        );

        const taken = new Set(to.map(address => address.address.trim().toLowerCase()));
        const cc = options.replyAll
            ? MailAddressUtils.dedupe(source.cc.filter(address =>
                !isOwn(address) && !taken.has(address.address.trim().toLowerCase())
            ))
            : [];

        return {
            to,
            cc,
            bcc: [],
            subject: prefixSubject('Re', source.subject),
            html: `<p></p><p>${escapeHtml(quoteHeader(source, options.formatTimestamp))}</p>`
                + `<blockquote>${options.quotedHtml || '<p></p>'}</blockquote>`,
            inReplyTo: source.messageId,
            references: referencesFor(source)
        };
    }

    export function buildForward(source: SourceMail, options: ForwardOptions): Prefill {
        const header = [
            '---------- Forwarded message ----------',
            source.from ? `From: ${MailAddressUtils.format(source.from)}` : undefined,
            source.date ? `Date: ${options.formatTimestamp(source.date)}` : undefined,
            `Subject: ${source.subject?.trim() || '(No subject)'}`,
            source.to.length > 0 ? `To: ${source.to.map(MailAddressUtils.format).join(', ')}` : undefined,
            source.cc.length > 0 ? `Cc: ${source.cc.map(MailAddressUtils.format).join(', ')}` : undefined,
        ].filter((line): line is string => !!line);

        return {
            to: [],
            cc: [],
            bcc: [],
            subject: prefixSubject('Fwd', source.subject),
            html: `<p></p><p>${header.map(escapeHtml).join('<br>')}</p><p></p>${options.quotedHtml}`,
            references: referencesFor(source)
        };
    }

    /** "On <date>, <sender> wrote:" line above a quoted reply. */
    export function quoteHeader(source: SourceMail, formatTimestamp: (timestamp: number) => string): string {
        const sender = source.from ? MailAddressUtils.format(source.from) : 'Unknown sender';
        return source.date ? `On ${formatTimestamp(source.date)}, ${sender} wrote:` : `${sender} wrote:`;
    }

    export function escapeHtml(value: string): string {
        return value.replace(/[&<>"']/g, char =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string)
        );
    }

    /** Plain text as editor HTML: blank lines separate paragraphs, single line breaks stay breaks. */
    export function textToHtml(text: string): string {
        return text
            .replace(/\r\n?/g, '\n')
            .split(/\n{2,}/)
            .filter(paragraph => paragraph.trim().length > 0)
            .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    /** Whether editor HTML contains no visible text (an empty editor is `<p></p>`). */
    export function isBlankHtml(html: string): boolean {
        return htmlToText(html).trim().length === 0;
    }

    const QUOTE_STYLE = 'margin:0 0 0 0.8ex;border-left:2px solid #ccc;padding-left:1ex';

    /**
     * Editor HTML → the HTML part of a mail, so recipients see what the editor
     * showed: blocks get no extra margins (each line is a paragraph, blank lines
     * are empty ones), empty paragraphs get an explicit break because mail
     * clients collapse them, and quotes get a quote bar.
     */
    export function toEmailHtml(html: string): string {
        const withBreaks = html.replace(/<p(\s[^>]*)?><\/p>/g, '<p$1><br></p>');
        const blocks = addStyle(withBreaks, ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol'], 'margin:0');
        return addStyle(blocks, ['blockquote'], QUOTE_STYLE);
    }

    /** Prepend a CSS declaration to the `style` of every opening tag named in `tags`. */
    function addStyle(html: string, tags: string[], declaration: string): string {
        const pattern = new RegExp(`<(${tags.join('|')})(\\s[^>]*)?>`, 'g');
        return html.replace(pattern, (_match, tag: string, attributes: string = '') => {
            const existing = attributes.match(/\sstyle="([^"]*)"/);
            if (!existing) return `<${tag}${attributes} style="${declaration}">`;
            return `<${tag}${attributes.replace(existing[0], ` style="${declaration};${existing[1]}"`)}>`;
        });
    }

    /** The reverse of {@link toEmailHtml} for loading a saved draft into the editor. */
    export function fromEmailHtml(html: string): string {
        return html.replace(/<p(\s[^>]*)?>\s*<br\s*\/?>\s*<\/p>/gi, '<p$1></p>');
    }

    const ENTITIES: Record<string, string> = {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
    };

    function decodeEntities(value: string): string {
        return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity: string) => {
            if (entity[0] === '#') {
                const code = entity[1]?.toLowerCase() === 'x'
                    ? parseInt(entity.slice(2), 16)
                    : parseInt(entity.slice(1), 10);
                return Number.isFinite(code) ? String.fromCodePoint(code) : match;
            }
            return ENTITIES[entity.toLowerCase()] ?? match;
        });
    }

    /**
     * Convert editor HTML to the plain-text alternative of a mail: paragraphs are
     * separated by blank lines, list items get `-` / `1.` markers, quotes get `>`
     * prefixes and links keep their URL. Written for the editor's own output
     * (paragraphs, headings, lists, quotes, links, breaks), not arbitrary HTML.
     */
    export function htmlToText(html: string): string {
        const lines: string[] = [];
        const lists: { ordered: boolean; count: number }[] = [];
        let text = '';
        let marker = '';
        let quoteDepth = 0;
        let blankLinePending = false;
        let preDepth = 0;
        let skipDepth = 0;
        let link: { href: string; text: string } | null = null;

        const quotePrefix = () => '> '.repeat(quoteDepth);

        // Emit the current line; `force` keeps otherwise empty lines (breaks, pre).
        const pushLine = (force = false) => {
            if (!force && text.trim() === '' && marker === '') return;
            if (blankLinePending && lines.length > 0) lines.push(quotePrefix().trimEnd());
            blankLinePending = false;
            lines.push((quotePrefix() + marker + text).trimEnd());
            text = '';
            marker = '';
        };

        const endBlock = () => {
            pushLine();
            blankLinePending = true;
        };

        const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;

        for (const [, closing, rawName, attributes, rawText] of html.matchAll(TOKEN)) {
            if (rawText !== undefined) {
                if (skipDepth > 0) continue;
                const decoded = decodeEntities(rawText);
                if (preDepth > 0) {
                    decoded.split('\n').forEach((part, index) => {
                        if (index > 0) pushLine(true);
                        text += part;
                    });
                } else {
                    const collapsed = decoded.replace(/\s+/g, ' ');
                    text += text === '' ? collapsed.trimStart() : collapsed;
                }
                if (link) link.text += decoded;
                continue;
            }
            if (!rawName) continue;

            const name = rawName.toLowerCase();
            const isClosing = closing === '/';

            if (name === 'style' || name === 'script') {
                skipDepth += isClosing ? -1 : 1;
                skipDepth = Math.max(0, skipDepth);
                continue;
            }
            if (skipDepth > 0) continue;

            switch (name) {
                case 'br':
                    pushLine(true);
                    break;
                case 'p':
                case 'div':
                case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
                    if (!isClosing) {
                        if (text.trim() !== '') endBlock();
                    } else if (lists.length > 0) {
                        // Paragraphs inside list items don't separate the items.
                        pushLine();
                    } else {
                        endBlock();
                    }
                    break;
                case 'blockquote':
                    pushLine();
                    if (isClosing) {
                        quoteDepth = Math.max(0, quoteDepth - 1);
                        blankLinePending = true;
                    } else {
                        // Separate the quote from what precedes it at the outer
                        // level, rather than with an empty quoted line.
                        if (lines.length > 0) lines.push(quotePrefix().trimEnd());
                        blankLinePending = false;
                        quoteDepth++;
                    }
                    break;
                case 'ul':
                case 'ol':
                    pushLine();
                    if (isClosing) {
                        lists.pop();
                        if (lists.length === 0) blankLinePending = true;
                    } else {
                        if (lists.length === 0 && lines.length > 0) blankLinePending = true;
                        lists.push({ ordered: name === 'ol', count: 0 });
                    }
                    break;
                case 'li':
                    pushLine();
                    if (!isClosing) {
                        const list = lists[lists.length - 1];
                        const indent = '  '.repeat(Math.max(0, lists.length - 1));
                        marker = indent + (list?.ordered ? `${++list.count}. ` : '- ');
                    }
                    break;
                case 'hr':
                    endBlock();
                    text = '---';
                    endBlock();
                    break;
                case 'pre':
                    if (isClosing) {
                        pushLine(true);
                        preDepth = Math.max(0, preDepth - 1);
                        blankLinePending = true;
                    } else {
                        endBlock();
                        preDepth++;
                    }
                    break;
                case 'a':
                    if (!isClosing) {
                        const href = attributes?.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
                        link = { href: decodeEntities(href?.[1] ?? href?.[2] ?? href?.[3] ?? ''), text: '' };
                    } else if (link) {
                        const label = link.text.trim();
                        if (link.href && label !== link.href && `mailto:${label}` !== link.href) {
                            text += ` (${link.href})`;
                        }
                        link = null;
                    }
                    break;
            }
        }

        pushLine();
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }
}
