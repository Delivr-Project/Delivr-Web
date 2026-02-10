import { BasicAbstractStore } from "~/utils/abstractStore";
import { useMailAccountsStore } from "./useMailAccountsStore";
import type { MailAccountWithMailboxes } from "~/utils/types";

class SelectedMailAccountStore {

    protected readonly selectedMailAccountID: Ref<number | null>;
    protected mailAccountsRef: Ref<MailAccountWithMailboxes[] | null> | null = null;

    constructor() {
        this.selectedMailAccountID = useState<number | null>("selectedMailAccountID", () => null);
    }

    public async use(): Promise<Ref<MailAccountWithMailboxes | null>> {

        if (!this.mailAccountsRef) {
            const mailAccountsStore = useMailAccountsStore();
            this.mailAccountsRef = await mailAccountsStore.use();
        }

        return useAwaitedComputed(async () => {
            console.log("Computing selected mail account with ID:", this.selectedMailAccountID.value);
            console.log("Available mail accounts:", this.mailAccountsRef!.value);

            if (!Array.isArray(this.mailAccountsRef!.value) || this.mailAccountsRef!.value.length === 0) {
                return null;
            }

            if (this.selectedMailAccountID.value === null) {

                // return default account
                return this.mailAccountsRef!.value[0] || null;
            }

            return this.mailAccountsRef!.value.find(acc => acc.id === this.selectedMailAccountID.value) || null;
        });
    }

    public set(id: number | null) {
        this.selectedMailAccountID.value = id;
    }

}

export function useSelectedMailAccountStore() {
    return new SelectedMailAccountStore();
}
