import React from "react";
import { Future } from "$/domain/entities/generic/Future";

export type FutureState<D> =
    | { type: "idle" }
    | { type: "loading" }
    | { type: "loaded"; data: D }
    | { type: "error"; error: Error };

/**
 * Runs the Future produced by `factory` whenever any of the `deps` change.
 * Cancels any in-flight request on unmount or when `deps` change, so the component
 * never receives a result from a stale invocation.
 *
 * When `factory` returns `null` the hook resets to the idle state and does not
 * trigger any request — useful for conditional fetches.
 */
export function useFuture<D>(
    factory: () => Future<Error, D> | null,
    deps: React.DependencyList
): FutureState<D> {
    const [state, setState] = React.useState<FutureState<D>>({ type: "idle" });

    React.useEffect(() => {
        const future = factory();
        if (!future) {
            setState({ type: "idle" });
            return;
        }

        setState({ type: "loading" });
        const cancel = future.run(
            data => setState({ type: "loaded", data }),
            error => setState({ type: "error", error })
        );

        return () => {
            cancel?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return state;
}
