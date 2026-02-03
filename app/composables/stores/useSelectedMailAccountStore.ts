import { BasicAbstractStore } from "~/utils/abstractStore";
import { useMailAccountsStore } from "./useMailAccountsStore";

class SelectedMailAccountStore implements BasicAbstractStore<MailAccount | null> {

    private readonly selectedMailAccountID: Ref<number | null>;
    private readonly selectedMailAccount: Ref<MailAccount | null>;
    private readonly selectedMailAccountMailboxes: Ref<Mailbox[] | null>;

    constructor() {
        this.selectedMailAccountID = useState<number | null>("selectedMailAccountID", () => null);
        this.selectedMailAccount = useState<MailAccount | null>("selectedMailAccount", () => null);
        this.selectedMailAccountMailboxes = useState<Mailbox[] | null>("selectedMailAccountMailboxes", () => null);
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

    public setMailAccountID(id: number | null) {
        this.selectedMailAccountID.value = id;
    }

}

export function useSelectedMailAccountStore() {
    return new SelectedMailAccountStore();
}
