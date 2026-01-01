import * as baseAPIClient from "@/api-client/sdk.gen";

export namespace UseAPITypes {

    export type APIClient = typeof baseAPIClient;

    export type DefaultReturn<TReturn> = TReturn;

    export type UseAPIReturnType<TReturn> = Promise<TReturn | {
        readonly success: false;
        readonly code: 500;
        readonly message: string;
        readonly data: null;
    }>;

    export type AsyncDataReturn<TReturn> = {
        data: Ref<DefaultReturn<TReturn>>;
        loading: Ref<boolean>;
        refresh: () => Promise<void>;
    }

    export type LazyAsyncDataReturn<TReturn> = {
        data: Ref<DefaultReturn<TReturn>>;
        loading: Ref<boolean>;
        refresh: () => Promise<void>;
    }

    export type LazyRequestReturn<TReturn> = LazyRequestWrapper<TReturn>;

    export type LazyAsyncDataRequestReturn<TReturn> = LazyAsyncDataRequestWrapper<TReturn>;

}

class LazyRequestWrapper<TReturn> {

    readonly loading = ref(false);

    constructor(
        protected readonly handler: () => Promise<TReturn>
    ) { }

    async execute(): Promise<TReturn> {
        this.loading.value = true;

        const result = await this.handler();

        this.loading.value = false;
        return result;
    }

}

class LazyAsyncDataRequestWrapper<TReturn> {

    readonly data: Ref<TReturn | null> = ref(null);
    readonly loading: Ref<boolean> = ref(false);

    protected refreshFunction?: () => Promise<void>;

    constructor(
        protected readonly name: string,
        protected readonly handler: () => Promise<TReturn>,
        immediateFNInit: boolean
    ) {
        if (immediateFNInit) {
            this.init();
        }
    }

    public init() {

        const { data, refresh, pending } = useLazyAsyncData<TReturn>(this.name, this.handler, {
            immediate: false
        });

        watch(data, (newData) => {
            this.data.value = newData as TReturn | undefined || null;
        }, { immediate: true });
        
        watch(pending, (newPending) => {
            this.loading.value = newPending;
        }, { immediate: true });

        this.refreshFunction = refresh;
    }

    async fetchData() {

        if (!this.refreshFunction) {
            this.init();
        }
        if (!this.refreshFunction) {
            throw new Error("Failed to initialize refresh function.");
        }
        await this.refreshFunction();
        
        return this.data;
    }
}



export async function useAPI<TReturn>(handler: (api: UseAPITypes.APIClient) => TReturn, disableAuthRedirect = false): UseAPITypes.UseAPIReturnType<TReturn> {

    try {
        if (import.meta.server) {

            const event = useRequestEvent();
            if (!event) {
                return {
                    success: false,
                    code: 500,
                    message: "Failed to retrieve request event on server.",
                    data: null
                } as const;
            }
            const sessionToken = getCookie(event, "dla_session_token");
            updateAPIClient(sessionToken ?? null);
            
            return await handler(baseAPIClient);

        } else if (import.meta.client) {

            const sessionToken = useAppCookies().sessionToken.get();

            if (sessionToken.value) {
                updateAPIClient(sessionToken.value);
            } else {
                updateAPIClient(null);
                if (!disableAuthRedirect) {
                    navigateTo('/auth/login?url=' + encodeURIComponent(useRoute().fullPath));
                }
            }

            const result = await handler(baseAPIClient);

            if ((result as any)?.success === false && (result as any)?.code === 401 && ((result as any)?.message === "Invalid or expired token") || ((result as any)?.message === "Missing or invalid Authorization header")) {
                updateAPIClient(null);
                sessionToken.value = null;
                if (!disableAuthRedirect) {
                    navigateTo('/auth/login?url=' + encodeURIComponent(useRoute().fullPath));
                }
            }
            return result;

        } else {
            throw new Error("Unknown environment");
        }
        
    } catch (error) {
        return {
            success: false,
            code: 500,
            message: (error as Error).message ?? "An unknown error occurred.",
            data: null
        } as const;
    }
}

export async function useAPIAsyncData<TReturn>(name: string, handler: () => Promise<TReturn>) {

    const { data, pending: loading, refresh } = await useAsyncData<TReturn>(name, handler);

    return { data, loading, refresh } as {
        data: Ref<TReturn>;
        loading: Ref<boolean>;
        refresh: () => Promise<void>;
    } satisfies UseAPITypes.AsyncDataReturn<TReturn>;
}

export async function useAPILazyAsyncData<TReturn>(name: string, handler: () => Promise<TReturn>) {

    const { data, pending: loading, refresh } = await useLazyAsyncData<TReturn>(name, handler);

    return { data, loading, refresh } as {
        data: Ref<TReturn>;
        loading: Ref<boolean>;
        refresh: () => Promise<void>;
    } satisfies UseAPITypes.LazyAsyncDataReturn<TReturn>;
}

export function useAPILazyRequest<TReturn>(handler: () => Promise<TReturn>) {
    return new LazyRequestWrapper<TReturn>(handler) satisfies UseAPITypes.LazyRequestReturn<TReturn>;
}

export function useAPILazyAsyncRequest<TReturn>(name: string, handler: () => Promise<TReturn>, immediateFNInit = false) {
    return new LazyAsyncDataRequestWrapper<TReturn>(name, handler, immediateFNInit) satisfies UseAPITypes.LazyAsyncDataRequestReturn<TReturn>;
}