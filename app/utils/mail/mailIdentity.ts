import { MailAddressUtils } from './mailAddress';

/**
 * The rules around a mail account's sender identities: which addresses it can
 * send from, which of them the composer preselects, and what may be removed.
 *
 * The API enforces the same invariant (an account always keeps at least one
 * identity, and is created with one) — this is its counterpart in the UI, so
 * the user is told before a request is refused.
 */
export namespace MailIdentityUtils {

    export interface Identity {
        id: number;
        display_name: string;
        email_address: string;
        is_default: boolean;
    }

    /** The account fields a sender list is derived from. */
    export interface Account {
        display_name?: string;
        smtp_username: string;
    }

    /** A mail account without an identity has no address to send from. */
    export const MIN_IDENTITIES = 1;

    export function canDelete(identities: readonly Identity[]): boolean {
        return identities.length > MIN_IDENTITIES;
    }

    export function toAddress(identity: Identity): MailAddressUtils.Address {
        return {
            name: identity.display_name || undefined,
            address: identity.email_address
        };
    }

    /**
     * The account's own address, i.e. its SMTP login — but only when that login
     * is an address at all; plenty of servers use a bare user name.
     */
    export function accountAddress(account: Account): MailAddressUtils.Address | null {
        if (!MailAddressUtils.isValid(account.smtp_username)) return null;
        return {
            name: account.display_name || undefined,
            address: account.smtp_username
        };
    }

    /**
     * Addresses offered in the composer's "From" list: the default identity
     * first, then the account's own address, then the remaining identities.
     * Duplicates are collapsed, so an identity for the account address wins over
     * the bare login.
     */
    export function senderAddresses(account: Account, identities: readonly Identity[]): MailAddressUtils.Address[] {
        const own = accountAddress(account);

        const senders = MailAddressUtils.dedupe([
            ...identities.filter((identity) => identity.is_default).map(toAddress),
            ...(own ? [own] : []),
            ...identities.filter((identity) => !identity.is_default).map(toAddress)
        ]);

        // An account with neither identities nor an address-shaped login still
        // needs something to show; the login is the only candidate left.
        return senders.length > 0
            ? senders
            : [{ name: account.display_name || undefined, address: account.smtp_username }];
    }

    /**
     * An identity of the same address would show up as an indistinguishable
     * second sender, so the UI rejects it before the API stores it.
     */
    export function findDuplicate(
        identities: readonly Identity[],
        emailAddress: string,
        exceptID?: number
    ): Identity | undefined {
        return identities.find((identity) =>
            identity.id !== exceptID && MailAddressUtils.isSame(identity.email_address, emailAddress));
    }

    /**
     * The identity to offer an account that has none yet, built from its own
     * address. `null` when the account has no usable address, or already has an
     * identity for it.
     */
    export function suggestionFor(
        account: Account,
        identities: readonly Identity[] = []
    ): { display_name: string; email_address: string } | null {
        const own = accountAddress(account);
        if (!own) return null;
        if (findDuplicate(identities, own.address)) return null;

        return { display_name: own.name || own.address, email_address: own.address };
    }

}
