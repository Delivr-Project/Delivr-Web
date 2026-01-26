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

    // 1. The public read-only refs (Computed)
    readonly data: Ref<TReturn | null>;
    readonly loading: Ref<boolean>;

    // 2. Internal pointers (Plain class properties, NOT refs themselves)
    protected _activeDataRef: Ref<TReturn | null> | null = null;
    protected _activeLoadingRef: Ref<boolean> | null = null;

    // 3. The "Signal" - determines which pointer we are looking at
    protected _linkSignal = ref(0);

    protected refreshFunction?: () => Promise<void>;
    protected clearFunction?: () => void;

    constructor(
        protected readonly name: string,
        protected readonly handler: () => Promise<TReturn>,
        immediateFNInit: boolean
    ) {
        // Initialize the computed properties ONCE
        this.data = computed({
            get: () => {
                // Track the signal
                this._linkSignal.value;
                // Return the value of whatever ref we are currently pointing to
                return this._activeDataRef?.value ?? null;
            },
            set: (newValue) => {
                if (this._activeDataRef) {
                    // This updates the actual Ref returned by useLazyAsyncData
                    this._activeDataRef.value = newValue;
                }
            }
        });

        this.loading = computed(() => {
            this._linkSignal.value;
            return this._activeLoadingRef?.value ?? false;
        });

        if (immediateFNInit) {
            this.init();
        }
    }

    public init() {

        // Do not re-run init if already initialized to avoid replacing refs unnecessarily
        if (this.refreshFunction) return;

        const { data, refresh, clear, pending } = useLazyAsyncData<TReturn>(this.name, this.handler, {
            immediate: false
        });

        // 4. Update the internal pointers (Point to the new refs)
        // We cast 'data' because Nuxt types can sometimes be 'TReturn | null' or just 'TReturn'
        this._activeDataRef = data as Ref<TReturn | null>;
        this._activeLoadingRef = pending;

        this.refreshFunction = refresh;
        this.clearFunction = clear;

        // 5. Trigger the signal. The computed properties will now re-evaluate 
        // and find the new _activeDataRef.
        this._linkSignal.value++;
    }

    async fetchData() {

        if (!this.refreshFunction) {
            this.init();
        }
        if (!this.refreshFunction) {
            throw new Error("Failed to initialize refresh function.");
        }

        await this.refreshFunction!();

        // console.log("after refresh source:", this._activeDataRef?.value); 
        // console.log("after refresh target:", this.data.value); // This will now be CORRECT

        return this.data;
    }

    async clearData() {
        this.clearFunction?.();
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
