/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect } from 'bun:test';
import { MailAddressUtils } from '../app/utils/mail/mailAddress.ts';
import { MailComposeUtils } from '../app/utils/mail/mailCompose.ts';

describe('MailAddressUtils', () => {

    test('splits lists on commas, semicolons and line breaks, but not inside quotes or angle brackets', () => {
        expect(MailAddressUtils.splitList('a@x.com, "Doe, Jane" <jane@x.com>; <odd,box@x.com>\nb@x.com,,'))
            .toEqual(['a@x.com', '"Doe, Jane" <jane@x.com>', '<odd,box@x.com>', 'b@x.com']);
    });

    test('treats apostrophes in names as literal, not as quotes', () => {
        expect(MailAddressUtils.splitList("O'Brien <ob@x.com>, jane@x.com"))
            .toEqual(["O'Brien <ob@x.com>", 'jane@x.com']);
        // format() leaves such a name unquoted, so its output has to split back apart.
        const formatted = MailAddressUtils.format({ name: "O'Brien", address: 'ob@x.com' });
        expect(MailAddressUtils.splitList(`${formatted}, jane@x.com`)).toHaveLength(2);
    });

    test('parses bare addresses, named addresses, quoted names and mailto links', () => {
        expect(MailAddressUtils.parse(' a@x.com ')).toEqual({ address: 'a@x.com' });
        expect(MailAddressUtils.parse('Jane Doe <jane@x.com>')).toEqual({ name: 'Jane Doe', address: 'jane@x.com' });
        expect(MailAddressUtils.parse('"Doe, \\"JD\\" Jane" <jane@x.com>')).toEqual({ name: 'Doe, "JD" Jane', address: 'jane@x.com' });
        expect(MailAddressUtils.parse('<jane@x.com>')).toEqual({ address: 'jane@x.com' });
        expect(MailAddressUtils.parse('mailto:jane@x.com')).toEqual({ address: 'jane@x.com' });
    });

    test('validates addresses loosely', () => {
        expect(MailAddressUtils.isValid('jane@mail.example.com')).toBe(true);
        expect(MailAddressUtils.isValid('jane@localhost')).toBe(false);
        expect(MailAddressUtils.isValid('jane@example.')).toBe(false);
        expect(MailAddressUtils.isValid('jane doe@example.com')).toBe(false);
        expect(MailAddressUtils.isValid('Jane <jane@example.com>')).toBe(false);
    });

    test('formats addresses, quoting names with special characters', () => {
        expect(MailAddressUtils.format({ address: 'a@x.com' })).toBe('a@x.com');
        expect(MailAddressUtils.format({ name: 'Jane Doe', address: 'jane@x.com' })).toBe('Jane Doe <jane@x.com>');
        expect(MailAddressUtils.format({ name: 'Doe, "JD"', address: 'jane@x.com' })).toBe('"Doe, \\"JD\\"" <jane@x.com>');
        // Formatting round-trips through parsing.
        const tricky = { name: 'Doe, "JD"', address: 'jane@x.com' };
        expect(MailAddressUtils.parse(MailAddressUtils.format(tricky))).toEqual(tricky);
    });

    test('dedupes case-insensitively, keeping the first occurrence', () => {
        expect(MailAddressUtils.dedupe([
            { name: 'Jane', address: 'Jane@x.com' },
            { address: 'jane@X.com' },
            { address: 'b@x.com' }
        ])).toEqual([{ name: 'Jane', address: 'Jane@x.com' }, { address: 'b@x.com' }]);
    });
});

describe('MailComposeUtils', () => {

    const formatTimestamp = (timestamp: number) => new Date(timestamp).toISOString();
    const source: MailComposeUtils.SourceMail = {
        from: { name: 'Alice', address: 'alice@x.com' },
        to: [{ address: 'me@x.com' }, { name: 'Bob', address: 'bob@x.com' }],
        cc: [{ address: 'carol@x.com' }, { address: 'ME@x.com' }, { address: 'bob@x.com' }],
        subject: 'Quarterly plan',
        date: Date.UTC(2026, 8, 1, 12, 0),
        messageId: '<m2@x.com>',
        references: '<m0@x.com> <m1@x.com>'
    };

    test('prefixes subjects once', () => {
        expect(MailComposeUtils.prefixSubject('Re', 'Plan')).toBe('Re: Plan');
        expect(MailComposeUtils.prefixSubject('Re', 'RE: Plan')).toBe('RE: Plan');
        expect(MailComposeUtils.prefixSubject('Fwd', 'Fw: Plan')).toBe('Fw: Plan');
        expect(MailComposeUtils.prefixSubject('Fwd', 'Re: Plan')).toBe('Fwd: Re: Plan');
        expect(MailComposeUtils.prefixSubject('Re', undefined)).toBe('Re:');
    });

    test('replies to the sender with threading headers and the quoted original', () => {
        const reply = MailComposeUtils.buildReply(source, {
            ownAddresses: ['me@x.com'], replyAll: false, quotedHtml: '<p>Original</p>', formatTimestamp
        });

        expect(reply.to).toEqual([{ name: 'Alice', address: 'alice@x.com' }]);
        expect(reply.cc).toEqual([]);
        expect(reply.subject).toBe('Re: Quarterly plan');
        expect(reply.inReplyTo).toBe('<m2@x.com>');
        expect(reply.references).toEqual(['<m0@x.com>', '<m1@x.com>', '<m2@x.com>']);
        expect(reply.html).toBe(
            '<p></p><p>On 2026-09-01T12:00:00.000Z, Alice &lt;alice@x.com&gt; wrote:</p><blockquote><p>Original</p></blockquote>'
        );
    });

    test('replies to Reply-To instead of the sender when present', () => {
        const reply = MailComposeUtils.buildReply({ ...source, replyTo: [{ address: 'list@x.com' }] }, {
            ownAddresses: ['me@x.com'], replyAll: false, quotedHtml: '', formatTimestamp
        });
        expect(reply.to).toEqual([{ address: 'list@x.com' }]);
    });

    test('reply all adds the other recipients without the user or duplicates', () => {
        const reply = MailComposeUtils.buildReply(source, {
            ownAddresses: ['me@x.com'], replyAll: true, quotedHtml: '', formatTimestamp
        });
        expect(reply.to).toEqual([{ name: 'Alice', address: 'alice@x.com' }, { name: 'Bob', address: 'bob@x.com' }]);
        expect(reply.cc).toEqual([{ address: 'carol@x.com' }]);
    });

    test('replying to your own mail continues with its recipients', () => {
        const sent = { ...source, from: { address: 'me@x.com' }, to: [{ address: 'dave@x.com' }], cc: [{ address: 'erin@x.com' }] };
        expect(MailComposeUtils.buildReply(sent, { ownAddresses: ['me@x.com'], replyAll: false, quotedHtml: '', formatTimestamp }).to)
            .toEqual([{ address: 'dave@x.com' }]);
        const all = MailComposeUtils.buildReply(sent, { ownAddresses: ['me@x.com'], replyAll: true, quotedHtml: '', formatTimestamp });
        expect(all.to).toEqual([{ address: 'dave@x.com' }]);
        expect(all.cc).toEqual([{ address: 'erin@x.com' }]);
    });

    test('forwards with an escaped header block and no recipients', () => {
        const forward = MailComposeUtils.buildForward(source, { quotedHtml: '<p>Original</p>', formatTimestamp });
        expect(forward.to).toEqual([]);
        expect(forward.subject).toBe('Fwd: Quarterly plan');
        expect(forward.inReplyTo).toBeUndefined();
        expect(forward.html).toBe(
            '<p></p><p>---------- Forwarded message ----------<br>From: Alice &lt;alice@x.com&gt;<br>'
            + 'Date: 2026-09-01T12:00:00.000Z<br>Subject: Quarterly plan<br>To: me@x.com, Bob &lt;bob@x.com&gt;<br>'
            + 'Cc: carol@x.com, ME@x.com, bob@x.com</p><p></p><p>Original</p>'
        );
    });

    test('converts plain text to editor HTML', () => {
        expect(MailComposeUtils.textToHtml('Hi <b>,\r\nline two\n\n\nNew paragraph'))
            .toBe('<p>Hi &lt;b&gt;,<br>line two</p><p>New paragraph</p>');
    });

    test('converts editor HTML to a readable plain-text part', () => {
        const html = '<p>Hello <strong>team</strong>,</p>'
            + '<p>See <a href="https://delivr.dev/plan">the plan</a> and <a href="https://x.com">https://x.com</a>.<br>Thanks!</p>'
            + '<ul><li><p>First</p></li><li><p>Second</p><ol><li><p>Nested</p></li></ol></li></ul>'
            + '<h2>Next &amp; last</h2>'
            + '<p></p><p>On Mon, Alice wrote:</p><blockquote><p>Quoted</p><p>Second&nbsp;line</p></blockquote>'
            + '<p>Bye</p>';

        expect(MailComposeUtils.htmlToText(html)).toBe([
            'Hello team,',
            '',
            'See the plan (https://delivr.dev/plan) and https://x.com.',
            'Thanks!',
            '',
            '- First',
            '- Second',
            '  1. Nested',
            '',
            'Next & last',
            '',
            'On Mon, Alice wrote:',
            '',
            '> Quoted',
            '>',
            '> Second line',
            '',
            'Bye'
        ].join('\n'));
    });

    test('styles mail HTML like the editor, and round-trips blank lines back to editor HTML', () => {
        const editorHtml = '<p>Hi</p><p></p><p style="text-align: center"></p><pre>code</pre>'
            + '<blockquote><p>Quote</p></blockquote><ul><li><p>Item</p></li></ul>';
        const mailHtml = MailComposeUtils.toEmailHtml(editorHtml);

        expect(mailHtml).toBe(
            '<p style="margin:0">Hi</p><p style="margin:0"><br></p><p style="margin:0;text-align: center"><br></p><pre>code</pre>'
            + '<blockquote style="margin:0 0 0 0.8ex;border-left:2px solid #ccc;padding-left:1ex"><p style="margin:0">Quote</p></blockquote>'
            + '<ul style="margin:0"><li><p style="margin:0">Item</p></li></ul>'
        );
        // Blank lines become empty paragraphs again; the editor drops the margin styles itself.
        expect(MailComposeUtils.fromEmailHtml(mailHtml)).toBe(mailHtml
            .replace('<p style="margin:0"><br></p>', '<p style="margin:0"></p>')
            .replace('<p style="margin:0;text-align: center"><br></p>', '<p style="margin:0;text-align: center"></p>'));
    });

    test('leaves out-of-range numeric entities alone instead of throwing', () => {
        expect(MailComposeUtils.htmlToText('<p>&#1114112; &#x110000; &#128512;</p>')).toBe('&#1114112; &#x110000; \u{1F600}');
    });

    test('detects blank editor content', () => {
        expect(MailComposeUtils.isBlankHtml('<p></p>')).toBe(true);
        expect(MailComposeUtils.isBlankHtml('<p> </p><p><br></p>')).toBe(true);
        expect(MailComposeUtils.isBlankHtml('<p>x</p>')).toBe(false);
    });
});

describe('MailComposeUtils signatures', () => {

    const SIG = '<p>Jane Doe</p>';
    const block = (html: string) => `<div data-delivr-signature="">${html}</div>`;

    test('wraps, finds and reads back a signature', () => {
        const body = MailComposeUtils.withSignature('<p>Hi</p>', SIG);
        expect(body).toBe(`<p>Hi</p>${block(SIG)}`);
        expect(MailComposeUtils.hasSignatureBlock(body)).toBe(true);
        expect(MailComposeUtils.readSignature(body)).toBe(SIG);
    });

    test('reports no signature for a body without a block', () => {
        expect(MailComposeUtils.readSignature('<p>Hi</p>')).toBeNull();
        expect(MailComposeUtils.hasSignatureBlock('<p>Hi</p>')).toBe(false);
    });

    test('replaces an existing block instead of adding a second one', () => {
        const body = MailComposeUtils.withSignature(MailComposeUtils.withSignature('<p>Hi</p>', SIG), '<p>Jane · Work</p>');
        expect(body).toBe(`<p>Hi</p>${block('<p>Jane · Work</p>')}`);
    });

    test('sits above a reply quote, including its "wrote:" line', () => {
        const reply = '<p></p><p>On 23 Sep 2026, Bob &lt;bob@x.com&gt; wrote:</p><blockquote><p>original</p></blockquote>';
        const body = MailComposeUtils.withSignature(reply, SIG);
        expect(body).toBe(
            `<p></p>${block(SIG)}<p>On 23 Sep 2026, Bob &lt;bob@x.com&gt; wrote:</p><blockquote><p>original</p></blockquote>`
        );
    });

    test('sits above a forwarded message header', () => {
        const forward = '<p></p><p>---------- Forwarded message ----------<br>From: Bob</p><p></p><p>original</p>';
        const body = MailComposeUtils.withSignature(forward, SIG);
        expect(body.indexOf('data-delivr-signature')).toBeLessThan(body.indexOf('Forwarded message'));
        expect(body.startsWith('<p></p><div')).toBe(true);
    });

    test('goes below a quote-less body, where the message ends', () => {
        expect(MailComposeUtils.withSignature('<p>Hi</p><p>Bye</p>', SIG))
            .toBe(`<p>Hi</p><p>Bye</p>${block(SIG)}`);
    });

    test('compares fragments ignoring the whitespace the editor moves around', () => {
        expect(MailComposeUtils.isSameHtml('<p>Jane</p>\n  <p>Doe</p>', '<p>Jane</p><p>Doe</p>')).toBe(true);
        expect(MailComposeUtils.isSameHtml('<p>Jane</p>', '<p>Joe</p>')).toBe(false);
    });

    test('drops an empty signature block from the sent mail, but keeps a real one', () => {
        expect(MailComposeUtils.toEmailHtml(`<p>Hi</p>${block('<p></p>')}`))
            .toBe('<p style="margin:0">Hi</p>');

        const sent = MailComposeUtils.toEmailHtml(`<p>Hi</p>${block(SIG)}`);
        expect(sent).toContain('data-delivr-signature');
        expect(sent).toContain('Jane Doe');
    });

    test('keeps a signature that only contains formatting', () => {
        const sent = MailComposeUtils.toEmailHtml(`<p>Hi</p>${block('<p><strong>Jane</strong></p>')}`);
        expect(sent).toContain('Jane');
    });

    test('a signature survives the draft round trip', () => {
        const body = MailComposeUtils.withSignature('<p></p>', SIG);
        const stored = MailComposeUtils.toEmailHtml(body);
        const reopened = MailComposeUtils.fromEmailHtml(stored);
        expect(MailComposeUtils.isSameHtml(MailComposeUtils.readSignature(reopened) ?? '', SIG)).toBe(true);
    });

    test('the plain-text alternative carries the signature text', () => {
        const text = MailComposeUtils.htmlToText(MailComposeUtils.toEmailHtml(`<p>Hi</p>${block(SIG)}`));
        expect(text).toContain('Hi');
        expect(text).toContain('Jane Doe');
    });

});

describe('MailComposeUtils signature comparison after a draft round trip', () => {

    test('a stored signature still matches the one the editor gives back', () => {
        const signature = '<p>Jane Doe</p><p><a href="https://example.com">example.com</a></p>';
        const body = MailComposeUtils.withSignature('<p>Hi</p>', signature);

        // Saved as a draft, then reopened: mail HTML in, editor HTML out.
        const reopened = MailComposeUtils.fromEmailHtml(MailComposeUtils.toEmailHtml(body));

        expect(MailComposeUtils.isSameHtml(MailComposeUtils.readSignature(reopened) ?? '', signature)).toBe(true);
    });

    test('an edited signature is not mistaken for the stored one', () => {
        const signature = '<p>Jane Doe</p>';
        const edited = MailComposeUtils.withSignature('<p>Hi</p>', '<p>Jane Doe, on holiday</p>');

        expect(MailComposeUtils.isSameHtml(MailComposeUtils.readSignature(edited) ?? '', signature)).toBe(false);
    });

    test('keeps a style the user set, dropping only the mail-client margins', () => {
        expect(MailComposeUtils.isSameHtml('<p style="margin:0;text-align: center">x</p>', '<p style="text-align: center">x</p>')).toBe(true);
        expect(MailComposeUtils.isSameHtml('<p style="text-align: center">x</p>', '<p>x</p>')).toBe(false);
    });

});
