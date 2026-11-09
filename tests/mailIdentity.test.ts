/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect } from 'bun:test';
import { MailIdentityUtils } from '../app/utils/mail/mailIdentity.ts';

type Identity = MailIdentityUtils.Identity;

function identity(overrides: Partial<Identity> & Pick<Identity, 'id' | 'email_address'>): Identity {
    return {
        display_name: overrides.email_address,
        is_default: false,
        ...overrides
    };
}

describe('MailIdentityUtils', () => {

    describe('canDelete', () => {

        test('keeps the last identity of an account', () => {
            expect(MailIdentityUtils.canDelete([])).toBe(false);
            expect(MailIdentityUtils.canDelete([identity({ id: 1, email_address: 'a@x.com' })])).toBe(false);
        });

        test('allows removing one while another remains', () => {
            expect(MailIdentityUtils.canDelete([
                identity({ id: 1, email_address: 'a@x.com' }),
                identity({ id: 2, email_address: 'b@x.com' })
            ])).toBe(true);
        });

    });

    describe('senderAddresses', () => {

        const account = { display_name: 'Work', smtp_username: 'login@x.com' };

        test('puts the default identity first, then the account address, then the rest', () => {
            const senders = MailIdentityUtils.senderAddresses(account, [
                identity({ id: 1, email_address: 'other@x.com', display_name: 'Other' }),
                identity({ id: 2, email_address: 'main@x.com', display_name: 'Main', is_default: true })
            ]);

            expect(senders).toEqual([
                { name: 'Main', address: 'main@x.com' },
                { name: 'Work', address: 'login@x.com' },
                { name: 'Other', address: 'other@x.com' }
            ]);
        });

        test('leaves out an SMTP login that is not an address', () => {
            const senders = MailIdentityUtils.senderAddresses(
                { display_name: 'Work', smtp_username: 'login-name-only' },
                [identity({ id: 1, email_address: 'main@x.com', display_name: 'Main', is_default: true })]
            );

            expect(senders).toEqual([{ name: 'Main', address: 'main@x.com' }]);
        });

        test('prefers the identity over the bare login for the same address', () => {
            const senders = MailIdentityUtils.senderAddresses(account, [
                identity({ id: 1, email_address: 'login@x.com', display_name: 'Named Login', is_default: true })
            ]);

            expect(senders).toEqual([{ name: 'Named Login', address: 'login@x.com' }]);
        });

        test('falls back to the login when there is nothing else to send from', () => {
            expect(MailIdentityUtils.senderAddresses({ display_name: 'Work', smtp_username: 'login-name-only' }, []))
                .toEqual([{ name: 'Work', address: 'login-name-only' }]);
        });

    });

    describe('formatLabel', () => {

        test('puts the description in front of the address', () => {
            expect(MailIdentityUtils.formatLabel({ name: 'John Doe', address: 'john@company.com' }, 'Business'))
                .toBe('(Business) John Doe <john@company.com>');
        });

        test('shows the plain address without a description', () => {
            const address = { name: 'John Doe', address: 'john@mymail.com' };
            expect(MailIdentityUtils.formatLabel(address)).toBe('John Doe <john@mymail.com>');
            expect(MailIdentityUtils.formatLabel(address, null)).toBe('John Doe <john@mymail.com>');
        });

    });

    describe('descriptionsByAddress', () => {

        test('keys the descriptions by lowercased address and skips identities without one', () => {
            expect(MailIdentityUtils.descriptionsByAddress([
                identity({ id: 1, email_address: 'John@MyMail.com', description: 'Private' }),
                identity({ id: 2, email_address: 'john@company.com', description: 'Business' }),
                identity({ id: 3, email_address: 'other@x.com', description: null }),
                identity({ id: 4, email_address: 'plain@x.com' })
            ])).toEqual({
                'john@mymail.com': 'Private',
                'john@company.com': 'Business'
            });
        });

        test('keeps the description out of the sender addresses', () => {
            const senders = MailIdentityUtils.senderAddresses(
                { smtp_username: 'login' },
                [identity({ id: 1, email_address: 'john@mymail.com', description: 'Private', is_default: true })]
            );
            expect(senders).toEqual([{ name: 'john@mymail.com', address: 'john@mymail.com' }]);
        });

    });

    describe('findDuplicate', () => {

        const identities = [
            identity({ id: 1, email_address: 'a@x.com' }),
            identity({ id: 2, email_address: 'b@x.com' })
        ];

        test('matches regardless of case and surrounding whitespace', () => {
            expect(MailIdentityUtils.findDuplicate(identities, '  A@X.com ')?.id).toBe(1);
            expect(MailIdentityUtils.findDuplicate(identities, 'c@x.com')).toBeUndefined();
        });

        test('ignores the identity currently being edited', () => {
            expect(MailIdentityUtils.findDuplicate(identities, 'a@x.com', 1)).toBeUndefined();
            expect(MailIdentityUtils.findDuplicate(identities, 'a@x.com', 2)?.id).toBe(1);
        });

    });

    describe('suggestionFor', () => {

        test('offers the account address, named after the account', () => {
            expect(MailIdentityUtils.suggestionFor({ display_name: 'Work', smtp_username: 'login@x.com' }))
                .toEqual({ display_name: 'Work', email_address: 'login@x.com' });
        });

        test('falls back to the address itself when the account has no name', () => {
            expect(MailIdentityUtils.suggestionFor({ smtp_username: 'login@x.com' }))
                .toEqual({ display_name: 'login@x.com', email_address: 'login@x.com' });
        });

        test('offers nothing when the login is not an address', () => {
            expect(MailIdentityUtils.suggestionFor({ display_name: 'Work', smtp_username: 'login-name-only' }))
                .toBeNull();
        });

        test('offers nothing once that address has an identity', () => {
            expect(MailIdentityUtils.suggestionFor(
                { display_name: 'Work', smtp_username: 'login@x.com' },
                [identity({ id: 1, email_address: 'LOGIN@x.com' })]
            )).toBeNull();
        });

    });

});
