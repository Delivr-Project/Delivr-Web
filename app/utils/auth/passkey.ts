import {
    browserSupportsWebAuthn,
    browserSupportsWebAuthnAutofill,
    startAuthentication,
    startRegistration,
    WebAuthnAbortService,
    WebAuthnError,
    type PublicKeyCredentialCreationOptionsJSON,
    type PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';
import type { PostAccountPasskeysOptionsResponses, PostAuthPasskeyOptionsResponses } from '~/api-client/types.gen';

// The API spec describes the WebAuthn options only by their challenge; the rest is
// passed through from the server's WebAuthn library unchanged.
type CreationOptions = PostAccountPasskeysOptionsResponses[200]['data']['options'];
type RequestOptions = PostAuthPasskeyOptionsResponses[200]['data']['options'];

export namespace PasskeyUtils {

    export function isSupported() {
        return import.meta.client && browserSupportsWebAuthn();
    }

    export async function create(options: CreationOptions) {
        const response = await startRegistration({ optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON });
        return { ...response, clientExtensionResults: { ...response.clientExtensionResults } };
    }

    export async function supportsAutofill() {
        return isSupported() && await browserSupportsWebAuthnAutofill();
    }

    export async function sign(options: RequestOptions, useBrowserAutofill = false) {
        const response = await startAuthentication({
            optionsJSON: options as PublicKeyCredentialRequestOptionsJSON,
            useBrowserAutofill
        });
        return { ...response, clientExtensionResults: { ...response.clientExtensionResults } };
    }

    export type SignedResponse = Awaited<ReturnType<typeof sign>>;

    export function cancelPending() {
        WebAuthnAbortService.cancelCeremony();
    }

    export function isCancelled(error: unknown) {
        if (error instanceof WebAuthnError) {
            return error.code === 'ERROR_CEREMONY_ABORTED' || (error.cause instanceof Error && error.cause.name === 'NotAllowedError');
        }
        return error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError');
    }

    export function describeError(error: unknown) {
        if (error instanceof WebAuthnError && error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
            return 'This passkey is already registered for your account.';
        }
        if (isCancelled(error)) {
            return 'The passkey prompt was cancelled or timed out.';
        }
        return error instanceof Error && error.message ? error.message : 'The passkey could not be used.';
    }

    export function suggestName(userAgent: string) {
        const browser =
            /Edg\//.test(userAgent) ? 'Edge' :
            /Firefox\//.test(userAgent) ? 'Firefox' :
            /Chrome\//.test(userAgent) ? 'Chrome' :
            /Safari\//.test(userAgent) ? 'Safari' :
            null;

        const platform =
            /iPhone|iPad/.test(userAgent) ? 'iOS' :
            /Android/.test(userAgent) ? 'Android' :
            /Mac OS X/.test(userAgent) ? 'macOS' :
            /Windows/.test(userAgent) ? 'Windows' :
            /Linux/.test(userAgent) ? 'Linux' :
            null;

        if (browser && platform) return `${browser} on ${platform}`;
        return browser ?? platform ?? 'Passkey';
    }

}
