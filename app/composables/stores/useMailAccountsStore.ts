import { BasicAbstractStore, BasicAbstractStoreWithMetadata, ModifiableAbstractStore } from "~/utils/abstractStore";
import type { MailAccountWithMailboxes } from "~/utils/types";


class MailAccountsStore extends BasicAbstractStoreWithMetadata<MailAccountWithMailboxes[], { loading: boolean }> {

    constructor() {
        super("mailAccounts", {
            enableAutoFetchIfEmpty: true,
            defaultMetadata: {
                loading: false
            }
        });
    }

    protected override async fetchData() {

        const metadata = await this.useMetadata();
        metadata.value.loading = true;

        try {

            if (!useAppCookies().sessionToken.get().value) {
                return null;
            }
            const response = await useAPI((api) => api.getMailAccounts({
                query: {
                    withMailboxes: true
                }
            }));

            if (!response.success) {
                return null;
            }

            return response.data as MailAccountWithMailboxes[];

        } catch (error) {

            console.error("Error fetching mail accounts:", error);
            return null;

        } finally {
            metadata.value.loading = false;
        }
    }

    public get isLoading() {
        const metadata = this.useMetadataRaw();
        return computed(() => metadata.value.loading);
    }


    public async getByID(id: number): Promise<Ref<MailAccountWithMailboxes | null>> {
        return useAwaitedComputed(async () => {

            const mailAccounts = await this.use();

            if (!mailAccounts.value) {
                return null;
            }

            if (!Array.isArray(mailAccounts.value) || mailAccounts.value.length === 0) {
                return null;
            }

            return mailAccounts.value.find(acc => acc.id === id) || null;
        });
    }

}

export function useMailAccountsStore() {
    return new MailAccountsStore();
}