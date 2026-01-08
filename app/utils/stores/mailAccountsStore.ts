import type { MailAccount, Mailbox } from "~/utils/types";

export class MailAccountsStore {

    private static readonly mailAccounts = useAPILazyAsyncRequest("/mail-accounts", async () => {
        if (!useAppCookies().sessionToken.get().value) {
            return null;
        }
        const response = await useAPI((api) => api.getMailAccounts({}));
        if (!response.success) {
            return null;
        }
        
        return response.data satisfies MailAccount[];
    });

    private static currentSelectedMailAccountID: Ref<number | null> = ref(null);
    private static currentSelectedMailAccount: ComputedRef<MailAccount | null> = computed(() => {
        const accounts = this.mailAccounts.data.value;
        if (!accounts || !this.currentSelectedMailAccountID.value) {
            return null;
        }
        return accounts.find(acc => acc.id === this.currentSelectedMailAccountID.value) || null;
    });

    private static readonly currentMailAccountsMailboxes = useAPILazyAsyncRequest(`/mail-accounts/mailboxes`, async () => {
        if (!useAppCookies().sessionToken.get().value || !this.currentSelectedMailAccountID.value) {
            return null;
        }
        const response = await useAPI((api) => api.getMailAccountsMailAccountIdMailboxes({
            path: {
                mailAccountID: this.currentSelectedMailAccountID.value as number
            }
        }));
        if (!response.success) {
            return null;
        }
        console.log("Fetched mailboxes for account ID", this.currentSelectedMailAccountID.value, response.data);
        return response.data satisfies Mailbox[];
    });

    static {
        watch(this.currentSelectedMailAccountID, async (newVal, oldVal) => {
            if (newVal !== oldVal) {
                this.currentMailAccountsMailboxes.data.value = null;
                await this.currentMailAccountsMailboxes.fetchData();
            }
        });
    }

    static async use() {
        await this.fetchAndSetIfNeeded();
        return this.mailAccounts.data satisfies Ref<MailAccount[] | null>;
    }

    static async fetchAndSetIfNeeded() {
        // Truely when array is empty
        if (!Array.isArray(this.mailAccounts.data.value)) {
            await this.refresh();
        }
    }

    static async refresh() {
        await this.mailAccounts.fetchData();
        if (!this.currentSelectedMailAccountID.value) {
            this.currentSelectedMailAccountID.value = (await this.getDefaultMailAccount())?.id || null;
        }
        await this.currentMailAccountsMailboxes.fetchData();
    }

    static async getDefaultMailAccount() {
        if (!this.isValid(this.mailAccounts.data)) {
            return null;
        }
        for (const account of this.mailAccounts.data.value) {
            if (account.is_default) {
                return account;
            }
        }
        return this.mailAccounts.data.value[0] || null;
    }

    static async getByID(mailAccountID: number) {
        return useAwaitedComputed(async () => {
            if (!this.isValid(this.mailAccounts.data)) {
                return null;
            }
            return this.mailAccounts.data.value.find(acc => acc.id === mailAccountID) || null;
        })
    }

    static async update(updates: Partial<MailAccount[]>) {
        await this.fetchAndSetIfNeeded();
        const current = await this.use();
        if (!current) {
            console.error("Cannot update mail accounts: no accounts available.");
            return;
        }
        for (const [key, value] of Object.entries(updates)) {
            (current.value as any)[key] = value;
        }
    }

    static clear() {
        this.mailAccounts.data.value = [] as MailAccount[];
    }

    static isValid(data: Ref<MailAccount[] | null>): data is Ref<MailAccount[]> {
        return !!data.value && Array.isArray(data.value);
    }

    static useSelected() {
        return this.currentSelectedMailAccount;
    }

    static setSelected(mailAccountID: number | null) {
        this.currentSelectedMailAccountID.value = mailAccountID;
    }

    static async useMailboxesOfSelected() {
        return this.currentMailAccountsMailboxes.data satisfies Ref<Mailbox[] | null>;
    }

    static get isLoading() {
        return this.mailAccounts.loading;
    }

}
