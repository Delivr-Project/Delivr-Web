import { BasicAbstractStore } from "~/utils/abstractStore";
import { useMailAccountsStore } from "./useMailAccountsStore";

// class SelectMailAccountMailboxesStore extends BasicAbstractStore<Mailbox[]> {

//     constructor() {
//         super(`mailAccounts_currentSelected_mailboxes`, {
//             enableAutoFetchIfEmpty: false
//         });
//     }

// }

class SelectedMailAccountStore {

    private selectedMailAccountID: Ref<number | null>;

    constructor() {
        this.selectedMailAccountID = useState<number | null>("selectedMailAccountID", () => null);
    }

    public use() {
        return useAwaitedComputed(async () => {

            const mailAccountsStore = useMailAccountsStore();
            const mailAccounts = await mailAccountsStore.use();

            if (!this.selectedMailAccountID.value === null) {

                if (!Array.isArray(mailAccounts.value) || mailAccounts.value.length === 0) {
                    return null;
                }
                // return default account
                return mailAccounts.value[0];
            }

            return mailAccounts.value!.find(acc => acc.id === this.selectedMailAccountID.value) || null;
        });
    }

}

export function useSelectedMailAccountStore() {
    return new SelectedMailAccountStore();
}
