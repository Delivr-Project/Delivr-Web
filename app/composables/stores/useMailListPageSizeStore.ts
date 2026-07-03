import { ModifiableAbstractStore } from "~/utils/abstractStore";
import type { MailPaginationUtils } from "~/utils/mail";

export type MailListPageSize = MailPaginationUtils.PageSize;

export interface MailListPageSizeData {
    pageSize: MailListPageSize;
}

const DEFAULT_PAGE_SIZE: MailListPageSize = 25;

/**
 * Account-scoped, backend-persisted preference for how many mails are shown
 * per page in a mailbox list. Backed by `/account/preferences/mail-list-page-size`.
 */
class MailListPageSizeStore extends ModifiableAbstractStore<MailListPageSizeData> {

    constructor() {
        super("mailListPageSize", {
            enableAutoFetchIfEmpty: true
        });
    }

    protected override async fetchData() {
        try {
            if (!useAppCookies().sessionToken.get().value) {
                return null;
            }
            const response = await useAPI((api) => api.getAccountPreferencesMailListPageSize({}));

            if (!response.success) {
                return null;
            }

            return {
                pageSize: response.data.pageSize ?? DEFAULT_PAGE_SIZE
            } satisfies MailListPageSizeData;

        } catch (error) {
            console.error("Error fetching mail list page size:", error);
            return null;
        }
    }

    override async update(updates: MailListPageSizeData) {
        this.useRaw().value = updates;
        await this.persist(updates);
    }

    private async persist(data: MailListPageSizeData) {
        const response = await useAPI((api) => api.putAccountPreferencesMailListPageSize({ body: data }));
        if (!response.success) {
            console.error("Failed to persist mail list page size:", response.message);
        }
    }

}

export function useMailListPageSizeStore() {
    return new MailListPageSizeStore();
}
