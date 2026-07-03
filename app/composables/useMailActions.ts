export function useMailActions(accountId: number) {
    const toast = useToast();

    function reportFailure(title: string, message?: string) {
        toast.add({
            title,
            description: message || 'An unknown error occurred.',
            color: 'error'
        });
    }

    async function deleteMail(mailboxPath: string, uid: number, permanent: boolean): Promise<boolean> {
        const response = await useAPI(api => api.deleteMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUid({
            path: { mailAccountID: accountId, mailboxPath, mailUID: uid },
            query: { permanent }
        }));
        if (!response.success) {
            reportFailure('Failed to delete email', response.message);
            return false;
        }
        return true;
    }

    async function moveMail(mailboxPath: string, uid: number, targetMailbox: string): Promise<boolean> {
        const response = await useAPI(api => api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMailsByMailUidMove({
            path: { mailAccountID: accountId, mailboxPath, mailUID: uid },
            body: { targetMailbox }
        }));
        if (!response.success) {
            reportFailure('Failed to move email', response.message);
            return false;
        }
        return true;
    }

    async function bulkDelete(mailboxPath: string, uids: number[], permanent: boolean): Promise<boolean> {
        const response = await useAPI(api => api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMailsBulkDelete({
            path: { mailAccountID: accountId, mailboxPath },
            body: { uids, permanent }
        }));
        if (!response.success) {
            reportFailure('Failed to delete emails', response.message);
            return false;
        }
        return true;
    }

    async function bulkMove(mailboxPath: string, uids: number[], targetMailbox: string): Promise<boolean> {
        const response = await useAPI(api => api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMailsBulkMove({
            path: { mailAccountID: accountId, mailboxPath },
            body: { uids, targetMailbox }
        }));
        if (!response.success) {
            reportFailure('Failed to move emails', response.message);
            return false;
        }
        return true;
    }

    async function bulkCopy(mailboxPath: string, uids: number[], targetMailbox: string): Promise<boolean> {
        const response = await useAPI(api => api.postMailAccountsByMailAccountIdMailboxesByMailboxPathMailsBulkCopy({
            path: { mailAccountID: accountId, mailboxPath },
            body: { uids, targetMailbox }
        }));
        if (!response.success) {
            reportFailure('Failed to copy emails', response.message);
            return false;
        }
        return true;
    }

    return { deleteMail, moveMail, bulkDelete, bulkMove, bulkCopy };
}
