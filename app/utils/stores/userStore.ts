import { reactive } from "vue";
import type { GetAccountResponses } from "@/api-client/types.gen";

type UserInfo = GetAccountResponses["200"]["data"];

export class UserStore {

    private static readonly userInfo = useAPILazyAsyncRequest("/account", async () => {
        if (!useAppCookies().sessionToken.get().value) {
            return null;
        }
        const response = await useAPI((api) => api.getAccount({}));
        if (!response.success) {
            return null;
        }
        return response.data satisfies UserInfo;
    });

    static async use() {
        await this.fetchAndSetIfNeeded();
        return this.userInfo.data satisfies Ref<UserInfo | null>;
    }

    static async fetchAndSetIfNeeded() {
        if (!this.userInfo.data.value?.id) {
            await this.refresh();
        }
    }

    static async refresh() {
        await this.userInfo.fetchData();
    }

    static async update(updates: Partial<UserInfo>) {
        await this.fetchAndSetIfNeeded();
        const current = await this.use();
        if (!current) {
            console.error("Cannot update user info: no user is logged in.");
            return;
        }
        for (const [key, value] of Object.entries(updates)) {
            (current.value as any)[key] = value;
        }
    }

    static clear() {
        this.userInfo.data.value = {} as UserInfo;
    }

    static isValid(userInfo: Ref<UserInfo | null>): userInfo is Ref<UserInfo> {
        return !!userInfo.value && !!userInfo.value.id;
    }

}