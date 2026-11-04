/**
 * "A Claude call has left": the stage shows the calls in flight, and the call's record only exists once
 * it returns. The run sets a listener for its own async scope, so the call sites need no exploration id,
 * and a call made outside a run (scripts, 聞く) announces to nobody.
 */
import { AsyncLocalStorage } from "node:async_hooks";

type Listener = (stage: string, startedAt: string) => void;
const scope = new AsyncLocalStorage<Listener>();

export const withCallNotice = <T>(listener: Listener, fn: () => Promise<T>): Promise<T> => scope.run(listener, fn);

/** `startedAt` is the same instant as the call's record, which is how the two are paired on the stage. */
export function callStarted(stage: string, startedAt: Date): void {
  scope.getStore()?.(stage, startedAt.toISOString());
}
