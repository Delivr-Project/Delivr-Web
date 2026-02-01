import { BasicAbstractStore, ModifiableAbstractStore } from "~/utils/abstractStore";



class MailAccountsStore extends BasicAbstractStore<MailAccount[]> {

    constructor() {
        super("mailAccounts", {
            enableAutoFetchIfEmpty: true
        });
    }

    protected override async fetchData() {
        try {
            if (!useAppCookies().sessionToken.get().value) {
                return null;
            }
            const response = await useAPI((api) => api.getMailAccounts({}));

            if (!response.success) {
                return null;
            }

            return response.data satisfies MailAccount[];

        } catch (error) {
            console.error("Error fetching mail accounts:", error);
            return null;
        }
    }



}

export function useMailAccountsStore() {
    return new MailAccountsStore();
}