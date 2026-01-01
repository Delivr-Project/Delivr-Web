
export namespace UtilityTypes {

    export type SomePartial<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

}

import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

export interface User {
    id: number
    name: string
    email: string
    avatar?: AvatarProps
}

export interface Mail {
    id: number
    unread?: boolean
    from: User
    subject: string
    body: string
    date: string
    hasAttachment?: boolean;
    isHTML?: boolean;
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

export interface MailAccount {
    id: number;
    created_at: number;
    smtp_host: string;
    smtp_port: number;
    smtp_username: string;
    smtp_encryption: "SSL" | "STARTTLS" | "NONE";
    imap_host: string;
    imap_port: number;
    imap_username: string;
    imap_encryption: "SSL" | "STARTTLS" | "NONE";
}


export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
    start: Date
    end: Date
}
