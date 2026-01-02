import type { GetMailAccountsResponses } from "~/api-client";

type MailAccount = GetMailAccountsResponses["200"]["data"][0];

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

}
