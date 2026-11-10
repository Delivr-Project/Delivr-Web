import { ModifiableAbstractStore } from "~/utils/abstractStore";
import type { SpecialUseMapping } from "~/utils/types";

/** Resolved special-use folders (Trash, Archive, …) of one mail account. */
class SpecialUseStore extends ModifiableAbstractStore<SpecialUseMapping> {

    private _mapping?: ComputedRef<SpecialUseMapping | null>;

    constructor(protected readonly mailAccountID: number) {
        super(`specialUse_${mailAccountID}`, {
            enableAutoFetchIfEmpty: true
        });
    }

    protected override async fetchData() {
        if (!useAppCookies().sessionToken.get().value) {
            return null;
        }

        const response = await useAPI((api) => api.getMailAccountsByMailAccountIdSpecialUse({
            path: { mailAccountID: this.mailAccountID }
        }), true);

        return response.success ? response.data : null;
    }

    /** Reactive, synchronously readable mapping; `null` until loaded. */
    public get mapping(): ComputedRef<SpecialUseMapping | null> {
        this._mapping ??= computed(() => this.useRaw().value);
        return this._mapping;
    }

    /** Replaces the local state, e.g. with the result of a successful `PUT`. */
    override async update(mapping: SpecialUseMapping) {
        this.useRaw().value = mapping;
    }

}

export function useSpecialUseStore(mailAccountID: number) {
    return new SpecialUseStore(mailAccountID);
}
