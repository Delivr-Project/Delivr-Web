
export namespace UtilityTypes {

    export type SomePartial<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

}

import type { AvatarProps } from '@nuxt/ui'
import type { GetMailAccountsMailAccountIdIdentitiesResponses, GetMailAccountsMailAccountIdMailboxesResponses, GetMailAccountsResponses, PostMailAccountsData } from '~/api-client';

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

export interface User {
    id: number
    name: string
    email: string
    avatar?: AvatarProps
}

export namespace MailRessource {

    export interface IMail {
        uid: number;
        rawHeaders: MailHeaders;
        from?: EmailAddress[];
        to?: EmailAddress[];
        cc?: EmailAddress[];
        bcc?: EmailAddress[];
        subject?: string;
        inReplyTo?: string;
        references?: string | string[];
        date?: number;
        attachments: MailAttachment[];
        body?: MailBody;
    }

    export interface EmailAddress {
        name?: string;
        address: string;
    }

    export interface MailAttachment {
        filename?: string;
        contentType: string;
        size: number;
        content: Buffer;
        contentId?: string;
        contentDisposition?: string;
    }


    export interface MailHeaders {
        [key: string]: string;
    }

    export interface MailBody {
        contentType: MailContentTypes;
        content: string;
    }

    export type MailContentTypes = "text" | "html";

}

export interface Member {
    name: string
    username: string
    role: 'member' | 'owner'
    avatar: AvatarProps
}

export interface Stat {
    title: string
    icon: string
    value: number | string
    variation: number
    formatter?: (value: number) => string
}

export interface Sale {
    id: string
    date: string
    status: SaleStatus
    email: string
    amount: number
}

export interface Notification {
    id: number
    unread?: boolean
    sender: User
    body: string
    date: string
}

export type MailAccount = GetMailAccountsResponses["200"]["data"][number];
export type NewMailAccount = NonNullable<PostMailAccountsData["body"]>;

export type Mailbox = GetMailAccountsMailAccountIdMailboxesResponses["200"]["data"][number];

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
    start: Date
    end: Date
}
