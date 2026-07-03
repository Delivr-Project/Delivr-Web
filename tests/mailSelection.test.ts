/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect } from 'bun:test';
import { MailSelectionUtils } from '../app/utils/mail.ts';

const NONE = { ctrlKey: false, metaKey: false, shiftKey: false };
const CTRL = { ctrlKey: true, metaKey: false, shiftKey: false };
const CMD = { ctrlKey: false, metaKey: true, shiftKey: false };
const SHIFT = { ctrlKey: false, metaKey: false, shiftKey: true };

describe('MailSelectionUtils.computeRange', () => {

    test('returns the forward range inclusive of both ends', () => {
        expect(MailSelectionUtils.computeRange([10, 20, 30, 40, 50], 20, 40)).toEqual([20, 30, 40]);
    });

    test('normalizes a backward range (to comes before from on screen)', () => {
        expect(MailSelectionUtils.computeRange([10, 20, 30, 40, 50], 40, 20)).toEqual([20, 30, 40]);
    });

    test('returns a single-element range when from equals to', () => {
        expect(MailSelectionUtils.computeRange([10, 20, 30], 20, 20)).toEqual([20]);
    });

    test('falls back to just the target when the anchor is no longer on screen', () => {
        expect(MailSelectionUtils.computeRange([10, 20, 30], 999, 20)).toEqual([20]);
    });

    test('falls back to just the target when the target itself is not on screen', () => {
        // Defensive case; resolveClick never actually calls this with an
        // off-screen clickedUid, but computeRange should not misbehave if it did.
        expect(MailSelectionUtils.computeRange([10, 20, 30], 10, 999)).toEqual([999]);
    });

});

describe('MailSelectionUtils.resolveClick — no modifier (existing behavior)', () => {

    test('stays empty when there was no selection, and opens the mail', () => {
        const result = MailSelectionUtils.resolveClick(new Set(), [10, 20, 30], null, 20, NONE);
        expect(result.selection).toEqual(new Set());
        expect(result.anchor).toBe(20);
        expect(result.openMail).toBe(true);
    });

    test('clears an existing multi-selection (a plain click always acts on just one row)', () => {
        const current = new Set([10, 20, 30]);
        const result = MailSelectionUtils.resolveClick(current, [10, 20, 30, 40], null, 40, NONE);
        expect(result.selection).toEqual(new Set());
        expect(result.openMail).toBe(true);
    });

    test('does not mutate the Set instance that was passed in when clearing it', () => {
        const current = new Set([10, 20, 30]);
        MailSelectionUtils.resolveClick(current, [10, 20, 30, 40], null, 40, NONE);
        expect(current).toEqual(new Set([10, 20, 30]));
    });

    test('moves the anchor to the clicked row, for a subsequent Shift+Click', () => {
        const result = MailSelectionUtils.resolveClick(new Set(), [10, 20, 30], 10, 30, NONE);
        expect(result.anchor).toBe(30);
    });

});

describe('MailSelectionUtils.resolveClick — Ctrl/Cmd+Click (toggle one)', () => {

    test('adds an unselected row to the selection', () => {
        const result = MailSelectionUtils.resolveClick(new Set([10]), [10, 20, 30], 10, 20, CTRL);
        expect(result.selection).toEqual(new Set([10, 20]));
        expect(result.anchor).toBe(20);
        expect(result.openMail).toBe(false);
    });

    test('removes an already-selected row from the selection', () => {
        const result = MailSelectionUtils.resolveClick(new Set([10, 20]), [10, 20, 30], 20, 20, CTRL);
        expect(result.selection).toEqual(new Set([10]));
        expect(result.openMail).toBe(false);
    });

    test('Cmd (metaKey) behaves the same as Ctrl', () => {
        const result = MailSelectionUtils.resolveClick(new Set([10]), [10, 20, 30], 10, 20, CMD);
        expect(result.selection).toEqual(new Set([10, 20]));
        expect(result.openMail).toBe(false);
    });

    test('does not mutate the Set instance that was passed in', () => {
        const current = new Set([10]);
        MailSelectionUtils.resolveClick(current, [10, 20, 30], 10, 20, CTRL);
        expect(current).toEqual(new Set([10]));
    });

});

describe('MailSelectionUtils.resolveClick — Shift+Click (range select)', () => {

    test('selects just the clicked row when there is no anchor yet', () => {
        const result = MailSelectionUtils.resolveClick(new Set(), [10, 20, 30], null, 20, SHIFT);
        expect(result.selection).toEqual(new Set([20]));
        expect(result.anchor).toBe(20);
        expect(result.openMail).toBe(false);
    });

    test('selects the forward range from the anchor to the clicked row', () => {
        const result = MailSelectionUtils.resolveClick(new Set([10]), [10, 20, 30, 40, 50], 10, 40, SHIFT);
        expect(result.selection).toEqual(new Set([10, 20, 30, 40]));
    });

    test('selects the backward range when the clicked row is above the anchor', () => {
        const result = MailSelectionUtils.resolveClick(new Set([40]), [10, 20, 30, 40, 50], 40, 10, SHIFT);
        expect(result.selection).toEqual(new Set([10, 20, 30, 40]));
    });

    test('replaces the previous selection rather than adding to it', () => {
        // 999 is selected from some earlier, unrelated action and is outside the new range.
        const result = MailSelectionUtils.resolveClick(new Set([999, 10]), [10, 20, 30, 40], 10, 30, SHIFT);
        expect(result.selection).toEqual(new Set([10, 20, 30]));
    });

    test('keeps the anchor fixed so a second Shift+Click extends from the same origin', () => {
        const first = MailSelectionUtils.resolveClick(new Set(), [10, 20, 30, 40, 50], 10, 30, SHIFT);
        expect(first.anchor).toBe(10);

        const second = MailSelectionUtils.resolveClick(first.selection, [10, 20, 30, 40, 50], first.anchor, 50, SHIFT);
        expect(second.anchor).toBe(10);
        expect(second.selection).toEqual(new Set([10, 20, 30, 40, 50]));
    });

    test('does not open the mail', () => {
        const result = MailSelectionUtils.resolveClick(new Set(), [10, 20, 30], 10, 30, SHIFT);
        expect(result.openMail).toBe(false);
    });

    test('Shift takes precedence when Ctrl and Shift are both held', () => {
        const result = MailSelectionUtils.resolveClick(new Set([10]), [10, 20, 30], 10, 30, { ctrlKey: true, metaKey: false, shiftKey: true });
        expect(result.selection).toEqual(new Set([10, 20, 30]));
    });

});
