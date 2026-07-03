/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect } from 'bun:test';
import { MailPaginationUtils } from '../app/utils/mail.ts';

describe('MailPaginationUtils.computeDisplayRange', () => {

    test('returns null for an empty list', () => {
        expect(MailPaginationUtils.computeDisplayRange(1, 25, 0)).toBeNull();
    });

    test('computes the range for the first page', () => {
        expect(MailPaginationUtils.computeDisplayRange(1, 25, 25)).toEqual({ start: 1, end: 25 });
    });

    test('computes the range for a later page', () => {
        expect(MailPaginationUtils.computeDisplayRange(3, 25, 25)).toEqual({ start: 51, end: 75 });
    });

    test('computes a partial range for the last (short) page', () => {
        expect(MailPaginationUtils.computeDisplayRange(3, 25, 7)).toEqual({ start: 51, end: 57 });
    });

    test('always starts at 1 and ends at the item count when page size is "all"', () => {
        expect(MailPaginationUtils.computeDisplayRange(1, 'all', 137)).toEqual({ start: 1, end: 137 });
    });

    test('ignores currentPage when page size is "all"', () => {
        // currentPage is always reset to 1 when switching to "all", but the
        // range calculation itself should not depend on it either way.
        expect(MailPaginationUtils.computeDisplayRange(5, 'all', 137)).toEqual({ start: 1, end: 137 });
    });

});

describe('MailPaginationUtils.hasNextPage', () => {

    test('true when the page is fully filled', () => {
        expect(MailPaginationUtils.hasNextPage(25, 25)).toBe(true);
    });

    test('false when the page is short (last page)', () => {
        expect(MailPaginationUtils.hasNextPage(25, 10)).toBe(false);
    });

    test('false when the list is empty', () => {
        expect(MailPaginationUtils.hasNextPage(25, 0)).toBe(false);
    });

    test('always false for page size "all", regardless of item count', () => {
        expect(MailPaginationUtils.hasNextPage('all', 500)).toBe(false);
    });

});

describe('MailPaginationUtils.hasPrevPage', () => {

    test('false on the first page', () => {
        expect(MailPaginationUtils.hasPrevPage(25, 1)).toBe(false);
    });

    test('true on later pages', () => {
        expect(MailPaginationUtils.hasPrevPage(25, 2)).toBe(true);
    });

    test('always false for page size "all", even if currentPage is stale', () => {
        expect(MailPaginationUtils.hasPrevPage('all', 3)).toBe(false);
    });

});

describe('MailPaginationUtils.fetchAllPages', () => {

    test('concatenates full chunks until a short chunk ends the loop', async () => {
        const chunks = [
            Array.from({ length: 100 }, (_, i) => i),
            Array.from({ length: 100 }, (_, i) => 100 + i),
            Array.from({ length: 37 }, (_, i) => 200 + i),
        ];

        const calls: Array<{ offset: number; limit: number }> = [];
        const result = await MailPaginationUtils.fetchAllPages(100, async (offset, limit) => {
            calls.push({ offset, limit });
            return chunks[calls.length - 1] ?? [];
        });

        expect(result.length).toBe(237);
        expect(result[0]).toBe(0);
        expect(result[236]).toBe(236);
        expect(calls).toEqual([
            { offset: 0, limit: 100 },
            { offset: 100, limit: 100 },
            { offset: 200, limit: 100 },
        ]);
    });

    test('issues one extra call when the total is an exact multiple of the chunk size', async () => {
        const calls: number[] = [];
        const result = await MailPaginationUtils.fetchAllPages(100, async (offset) => {
            calls.push(offset);
            return offset === 0 ? Array.from({ length: 100 }, (_, i) => i) : [];
        });

        expect(result.length).toBe(100);
        expect(calls).toEqual([0, 100]);
    });

    test('returns an empty array when the mailbox itself is empty', async () => {
        const result = await MailPaginationUtils.fetchAllPages(100, async () => []);
        expect(result).toEqual([]);
    });

    test('stops and returns what was collected so far when a chunk fetch fails', async () => {
        const calls: number[] = [];
        const result = await MailPaginationUtils.fetchAllPages(100, async (offset) => {
            calls.push(offset);
            if (offset === 0) return Array.from({ length: 100 }, (_, i) => i);
            return null; // simulates a failed request
        });

        expect(result.length).toBe(100);
        expect(calls).toEqual([0, 100]);
    });

});
