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
