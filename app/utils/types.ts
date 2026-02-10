import type {
    GetAccountApikeysResponses,
    GetAccountResponses,
    GetMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUidResponses,
    GetMailAccountsByMailAccountIdMailboxesByMailboxPathMailsResponses,
    GetMailAccountsByMailAccountIdMailboxesResponses,
    GetMailAccountsResponses,
    PostAccountApikeysData,
    PostMailAccountsData
} from '~/api-client';

export namespace UtilityTypes {

    export type SomePartial<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

}

export type UserInfo = GetAccountResponses["200"]["data"];

// export type MailAccount = GetMailAccountsResponses["200"]["data"][number];
export type MailAccount = {
    id: number;
    created_at: number;
    display_name: string;
    is_default: boolean;
    smtp_host: string | string | string;
    /**
     * Port
     */
    smtp_port: number;
    smtp_encryption: 'SSL' | 'STARTTLS' | 'NONE';
    smtp_username: string;
    imap_host: string | string | string;
    /**
     * Port
     */
    imap_port: number;
    imap_encryption: 'SSL' | 'STARTTLS' | 'NONE';
    imap_username: string;
}
export type MailAccountWithMailboxes = MailAccount & {
    mailboxes: Mailbox[];
}
export type NewMailAccount = NonNullable<PostMailAccountsData["body"]>;

export type Mailbox = GetMailAccountsByMailAccountIdMailboxesResponses["200"]["data"][number];

export type MailData = GetMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUidResponses["200"]["data"];
export type MailListItem = GetMailAccountsByMailAccountIdMailboxesByMailboxPathMailsResponses["200"]["data"][number];

export type APIKey = GetAccountApikeysResponses["200"]["data"][number];
export type NewAPIKey = NonNullable<PostAccountApikeysData["body"]>;


export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
    start: Date
    end: Date
}
