import type { CookieOptions } from "#app";

type CookieOptionsWithoutReadonly<T> = CookieOptions<T> & {
    readonly?: false;
}

class AppCookie<T extends string | null | undefined> {

    constructor(
        protected readonly name: string,
        protected readonly options?: CookieOptionsWithoutReadonly<T>
    ) {}

    get() {
        return useCookie(this.name);
    }

    set(value: T) {
        useCookie(this.name, this.options as CookieOptionsWithoutReadonly<T> | undefined).value = value;
    }

}

class AppCookieHandler {

    private constructor() {}

    private static readonly cookies = {

        sessionToken: new AppCookie<string | null>("dla_session_token"),

    } as const;

    static getCookies() {
        return AppCookieHandler.cookies;
    }

}


export function useAppCookies() {
    return AppCookieHandler.getCookies();
}
