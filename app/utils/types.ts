import type { GetAccountResponses, GetMailAccountsByMailAccountIdMailboxesResponses, GetMailAccountsResponses, PostMailAccountsData } from '~/api-client';

export namespace UtilityTypes {

    export type SomePartial<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

}

export type UserInfo = GetAccountResponses["200"]["data"];

export type MailAccount = GetMailAccountsResponses["200"]["data"][number];
export type NewMailAccount = NonNullable<PostMailAccountsData["body"]>;

export type Mailbox = GetMailAccountsByMailAccountIdMailboxesResponses["200"]["data"][number];

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
    start: Date
    end: Date
}
