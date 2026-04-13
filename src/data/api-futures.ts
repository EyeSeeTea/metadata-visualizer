import { Future } from "$/domain/entities/generic/Future";
import { FutureData } from "$/domain/entities/generic/FutureData";

export function promiseToFuture<Data>(
    promiseFactory: (signal: AbortSignal) => Promise<Data>
): FutureData<Data> {
    return Future.fromComputation((resolve, reject) => {
        const controller = new AbortController();
        promiseFactory(controller.signal)
            .then(resolve)
            .catch((err: unknown) => {
                // Once the signal is aborted, any error that comes back is a consequence
                // of that abort. @dhis2/app-runtime's DataEngine surfaces aborts as a
                // generic "An unknown network error occurred" rather than a DOMException
                // with name === "AbortError", so checking the error shape alone is not
                // enough — the signal state is the source of truth.
                if (controller.signal.aborted || isAbortError(err)) {
                    throw Future.cancel();
                }
                if (err instanceof Error) {
                    reject(err);
                } else {
                    console.error("promiseToFuture:uncatched", err);
                    reject(new Error("Unknown error"));
                }
            });
        return () => controller.abort();
    });
}

function isAbortError(error: unknown): boolean {
    return Boolean(
        error &&
            typeof error === "object" &&
            "name" in error &&
            (error as { name: string }).name === "AbortError"
    );
}
