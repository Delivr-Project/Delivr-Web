export interface MailDragPayload {
    accountId: number
    sourceMailboxPath: string
    uids: number[]
}

export function useMailDragState() {
    return useState<MailDragPayload | null>('mail-drag-state', () => null);
}
