import type { CookieOptions } from "#app";
import type { H3Event } from "h3";

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

    getServerSide(event: H3Event) {
        return getCookie(event, this.name);
    }

    set(value: T) {
        useCookie(this.name, this.options as CookieOptionsWithoutReadonly<T> | undefined).value = value;
    }

}


export function useAppCookies() {
    return {

        sessionToken: new AppCookie<string | null>("dla_session_token"),
        
    } as const;
}
