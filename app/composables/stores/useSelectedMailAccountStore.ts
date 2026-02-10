import { BasicAbstractStore } from "~/utils/abstractStore";
import { useMailAccountsStore } from "./useMailAccountsStore";
import type { MailAccountWithMailboxes } from "~/utils/types";

class SelectedMailAccountStore {

    protected readonly selectedMailAccountID: Ref<number | null>;

    constructor() {
        this.selectedMailAccountID = useState<number | null>("selectedMailAccountID", () => null);
    }

    public use(): Promise<Ref<MailAccountWithMailboxes | null>> {
        return useAwaitedComputed(async () => {

            const mailAccountsStore = useMailAccountsStore();
            const mailAccounts = await mailAccountsStore.use();

            if (!this.selectedMailAccountID.value === null) {

                if (!Array.isArray(mailAccounts.value) || mailAccounts.value.length === 0) {
                    return null;
                }
                // return default account
                return mailAccounts.value[0] || null;
            }

            return mailAccounts.value!.find(acc => acc.id === this.selectedMailAccountID.value) || null;
        });
    }

    public set(id: number | null) {
        this.selectedMailAccountID.value = id;
    }

}

export function useSelectedMailAccountStore() {
    return new SelectedMailAccountStore();
}
