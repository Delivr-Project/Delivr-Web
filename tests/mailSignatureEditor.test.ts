/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Window } from 'happy-dom';
import { Node, mergeAttributes, generateHTML, generateJSON } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { MailComposeUtils } from '../app/utils/mail/mailCompose.ts';

/**
 * The signature only survives in the body because `MailComposeEditor` registers
 * a node for it — TipTap unwraps elements it has no node for, and an unwrapped
 * signature can never be found again when the sender changes. These tests keep
 * that node honest; they mirror the extension the editor sets up.
 */

const MailSignature = Node.create({
    name: 'mailSignature',
    group: 'block',
    content: 'block+',
    defining: true,
    parseHTML() {
        return [{ tag: `div[${MailComposeUtils.SIGNATURE_ATTRIBUTE}]` }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { [MailComposeUtils.SIGNATURE_ATTRIBUTE]: '' }), 0];
    }
});

const extensions = [StarterKit, TextAlign.configure({ types: ['heading', 'paragraph'] }), MailSignature];

/** What the editor gives back for a piece of content. */
function throughEditor(html: string, used = extensions): string {
    return generateHTML(generateJSON(html, used), used);
}

let window: Window;

beforeAll(() => {
    // TipTap parses HTML through the DOM, which bun doesn't provide by itself.
    window = new Window();
    Object.assign(globalThis, {
        window,
        document: window.document,
        DOMParser: window.DOMParser,
        Node: window.Node
    });
});

afterAll(async () => {
    await window.happyDOM?.close();
});

describe('the signature block in the editor', () => {

    const body = MailComposeUtils.withSignature('<p>Hi</p>', '<p>Jane Doe</p>');

    test('survives a round trip through the editor', () => {
        const result = throughEditor(body);

        expect(MailComposeUtils.hasSignatureBlock(result)).toBe(true);
        expect(MailComposeUtils.isSameHtml(MailComposeUtils.readSignature(result) ?? '', '<p>Jane Doe</p>')).toBe(true);
    });

    test('would be lost without the node — which is why it exists', () => {
        const withoutNode = throughEditor(body, [StarterKit]);

        expect(withoutNode).toContain('Jane Doe');
        expect(MailComposeUtils.hasSignatureBlock(withoutNode)).toBe(false);
    });

    test('keeps the text above it and the quote below it in place', () => {
        const reply = MailComposeUtils.withSignature(
            '<p>My answer</p><p>On 23 Sep 2026, Bob wrote:</p><blockquote><p>original</p></blockquote>',
            '<p>Jane Doe</p>'
        );
        const result = throughEditor(reply);

        expect(result.indexOf('My answer')).toBeLessThan(result.indexOf('Jane Doe'));
        expect(result.indexOf('Jane Doe')).toBeLessThan(result.indexOf('wrote:'));
        expect(result.indexOf('wrote:')).toBeLessThan(result.indexOf('<blockquote'));
    });

    test('a signature the editor normalised still matches the stored one, so it can be swapped', () => {
        const stored = '<p>Jane Doe</p><p><em>Delivr</em></p>';
        const result = throughEditor(MailComposeUtils.withSignature('<p></p>', stored));

        expect(MailComposeUtils.isSameHtml(MailComposeUtils.readSignature(result) ?? '', stored)).toBe(true);
    });

    test('a draft round trip leaves the signature recognisable', () => {
        const saved = MailComposeUtils.toEmailHtml(throughEditor(body));
        const reopened = throughEditor(MailComposeUtils.fromEmailHtml(saved));

        expect(MailComposeUtils.isSameHtml(MailComposeUtils.readSignature(reopened) ?? '', '<p>Jane Doe</p>')).toBe(true);
    });

});
