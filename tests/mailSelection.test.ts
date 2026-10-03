/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect } from 'bun:test';
import { MailSelectionUtils } from '../app/utils/mail/mailSelection.ts';

// List order as shown (newest first), so UIDs are deliberately not sorted.
const order = [50, 42, 37, 30, 12];

describe('MailSelectionUtils.range', () => {

    test('selects from the anchor down to the target', () => {
        expect(MailSelectionUtils.range(order, 42, 30)).toEqual([42, 37, 30]);
    });

    test('works upwards too', () => {
        expect(MailSelectionUtils.range(order, 12, 37)).toEqual([37, 30, 12]);
    });

    test('is just the target without a usable anchor', () => {
        expect(MailSelectionUtils.range(order, null, 37)).toEqual([37]);
        // e.g. the anchor was deleted in the meantime
        expect(MailSelectionUtils.range(order, 999, 37)).toEqual([37]);
    });

    test('is empty for a target that is not in the list', () => {
        expect(MailSelectionUtils.range(order, 42, 999)).toEqual([]);
    });

});

describe('MailSelectionUtils.selectRange', () => {

    test('Shift replaces the selection with the range', () => {
        const next = MailSelectionUtils.selectRange(order, new Set([12]), 50, 37, false);
        expect([...next].sort((a, b) => a - b)).toEqual([37, 42, 50].sort((a, b) => a - b));
    });

    test('Ctrl/Cmd+Shift adds the range to the selection', () => {
        const next = MailSelectionUtils.selectRange(order, new Set([12]), 50, 42, true);
        expect([...next].sort((a, b) => a - b)).toEqual([12, 42, 50].sort((a, b) => a - b));
    });

    test('does not mutate the current selection', () => {
        const selection = new Set([12]);
        MailSelectionUtils.selectRange(order, selection, 50, 42, true);
        expect([...selection]).toEqual([12]);
    });

});

describe('MailSelectionUtils.toggle', () => {

    test('adds and removes a single mail', () => {
        const added = MailSelectionUtils.toggle(new Set([50]), 42);
        expect([...added]).toEqual([50, 42]);
        expect([...MailSelectionUtils.toggle(added, 50)]).toEqual([42]);
    });

});

describe('MailSelectionUtils.move', () => {

    test('steps through the list and stops at its ends', () => {
        expect(MailSelectionUtils.move(order, 42, 1)).toBe(37);
        expect(MailSelectionUtils.move(order, 42, -1)).toBe(50);
        expect(MailSelectionUtils.move(order, 50, -1)).toBe(50);
        expect(MailSelectionUtils.move(order, 12, 1)).toBe(12);
    });

    test('starts at the first row going down, the last going up', () => {
        expect(MailSelectionUtils.move(order, null, 1)).toBe(50);
        expect(MailSelectionUtils.move(order, null, -1)).toBe(12);
        expect(MailSelectionUtils.move(order, 999, 1)).toBe(50);
    });

    test('has nothing to move to in an empty list', () => {
        expect(MailSelectionUtils.move([], null, 1)).toBeNull();
    });

});
