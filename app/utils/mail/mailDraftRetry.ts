/**
 * How often a failed draft autosave retries itself.
 *
 * A save that keeps failing must not turn into an endless background request
 * loop: the draft is still held in the composer and the save status shows the
 * error, so a server that is down is better waited out than polled. Each
 * failure is worth {@link MailDraftRetryUtils.MAX_AUTOMATIC_RETRIES} automatic
 * attempts, and the budget is earned back by a successful save or by the user
 * editing on — which is a new attempt rather than a retry of the one that
 * failed.
 */
export namespace MailDraftRetryUtils {

    export const MAX_AUTOMATIC_RETRIES = 1;

    export interface Budget {
        /**
         * Whether the failure that just happened may be retried automatically,
         * spending one attempt if so. A failure that isn't retryable at all (the
         * server rejected the content, and would again) never spends one.
         */
        take(retryable: boolean): boolean;
        /** Give the full budget back, after a successful save or a fresh edit. */
        reset(): void;
        /** Attempts still available, for tests and debugging. */
        readonly left: number;
    }

    export function budget(max = MAX_AUTOMATIC_RETRIES): Budget {
        let left = max;
        return {
            take(retryable: boolean): boolean {
                if (!retryable || left <= 0) return false;
                left--;
                return true;
            },
            reset(): void {
                left = max;
            },
            get left(): number {
                return left;
            }
        };
    }

}
