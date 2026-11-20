/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect } from 'bun:test';
import { WebAuthnError } from '@simplewebauthn/browser';
import { PasskeyUtils } from '../app/utils/auth/passkey.ts';

describe('PasskeyUtils', () => {

    test('suggests a name from the user agent', () => {
        expect(PasskeyUtils.suggestName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')).toBe('Chrome on Windows');
        expect(PasskeyUtils.suggestName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0')).toBe('Edge on Windows');
        expect(PasskeyUtils.suggestName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iOS');
        expect(PasskeyUtils.suggestName('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36')).toBe('Chrome on Android');
        expect(PasskeyUtils.suggestName('Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0')).toBe('Firefox on Linux');
        expect(PasskeyUtils.suggestName('curl/8.0')).toBe('Passkey');
    });

    test('treats a dismissed prompt as cancelled', () => {
        const notAllowed = new Error('The operation either timed out or was not allowed.');
        notAllowed.name = 'NotAllowedError';

        expect(PasskeyUtils.isCancelled(notAllowed)).toBe(true);
        expect(PasskeyUtils.isCancelled(new WebAuthnError({ message: 'aborted', code: 'ERROR_CEREMONY_ABORTED', cause: new Error('abort') }))).toBe(true);
        expect(PasskeyUtils.isCancelled(new WebAuthnError({ message: 'denied', code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', cause: notAllowed }))).toBe(true);
        expect(PasskeyUtils.isCancelled(new Error('boom'))).toBe(false);
    });

    test('explains a passkey that is already registered', () => {
        const error = new WebAuthnError({ message: 'exists', code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', cause: new Error('InvalidStateError') });

        expect(PasskeyUtils.describeError(error)).toBe('This passkey is already registered for your account.');
        expect(PasskeyUtils.describeError(new Error('Bad domain'))).toBe('Bad domain');
        expect(PasskeyUtils.describeError('weird')).toBe('The passkey could not be used.');
    });
});
