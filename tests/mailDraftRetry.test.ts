/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect } from 'bun:test';
import { MailDraftRetryUtils } from '../app/utils/mail/mailDraftRetry.ts';

describe('MailDraftRetryUtils.budget', () => {

    test('retries a transient failure once', () => {
        const budget = MailDraftRetryUtils.budget();

        expect(budget.take(true)).toBe(true);
    });

    test('does not keep retrying an outage that never recovers', () => {
        const budget = MailDraftRetryUtils.budget();

        expect(budget.take(true)).toBe(true);
        // Every further failure of the same save stops here, so a server that
        // stays down is waited out instead of polled forever.
        for (let attempt = 0; attempt < 10; attempt++) {
            expect(budget.take(true)).toBe(false);
        }
    });

    test('never spends an attempt on a failure that would repeat', () => {
        const budget = MailDraftRetryUtils.budget();

        expect(budget.take(false)).toBe(false);
        expect(budget.left).toBe(MailDraftRetryUtils.MAX_AUTOMATIC_RETRIES);
        // …and the budget is still there for a transient one.
        expect(budget.take(true)).toBe(true);
    });

    test('a successful save or a fresh edit earns the budget back', () => {
        const budget = MailDraftRetryUtils.budget();

        expect(budget.take(true)).toBe(true);
        expect(budget.take(true)).toBe(false);

        budget.reset();

        expect(budget.left).toBe(MailDraftRetryUtils.MAX_AUTOMATIC_RETRIES);
        expect(budget.take(true)).toBe(true);
        expect(budget.take(true)).toBe(false);
    });

    test('resetting an unspent budget does not stack attempts', () => {
        const budget = MailDraftRetryUtils.budget();

        budget.reset();
        budget.reset();

        expect(budget.take(true)).toBe(true);
        expect(budget.take(true)).toBe(false);
    });

});
