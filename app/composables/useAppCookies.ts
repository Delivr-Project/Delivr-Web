import type { CookieOptions } from "#app";

type CookieOptionsWithoutReadonly<T> = CookieOptions<T> & {
    readonly?: false;
}

const SESSION_COOKIE_OPTIONS: CookieOptionsWithoutReadonly<string | null> = {
    path: "/",
    secure: true, // allowed on localhost; required in prod
    sameSite: "lax",
    httpOnly: false, // the client must read the token to attach it to the API client
};

class AppCookie<T extends string | null | undefined> {

    constructor(
        protected readonly name: string,
        protected readonly options?: CookieOptionsWithoutReadonly<T>
    ) {}

    get() {
        return useCookie(this.name);
    }

    set(value: T, options?: CookieOptionsWithoutReadonly<T>) {
        const merged = { ...this.options, ...options } as CookieOptionsWithoutReadonly<T> | undefined;
        useCookie(this.name, merged).value = value;
    }

}

export function useAppCookies() {
    return {

        sessionToken: new AppCookie<string | null>("dla_session_token", SESSION_COOKIE_OPTIONS)

    } as const;
}
