export type BusSearchInput = {
  origin: string;
  destination: string;
  travelDate: string;
};

/**
 * Provider contract for timetable-backed bus search.
 *
 * Providers must return source-grounded results in the application contract.
 * Missing fares, timings, or availability must remain absent rather than guessed.
 */
export interface BusSearchProvider<TResult> {
  readonly id: string;
  search(input: BusSearchInput): Promise<TResult>;
}

const providers = new Map<string, BusSearchProvider<unknown>>();

/** Register a transport data source without coupling the search API to its vendor. */
export function registerBusSearchProvider<TResult>(
  provider: BusSearchProvider<TResult>
): void {
  if (!provider.id.trim()) throw new Error("BUS_PROVIDER_ID_REQUIRED");
  if (providers.has(provider.id)) {
    throw new Error(`BUS_PROVIDER_ALREADY_REGISTERED:${provider.id}`);
  }
  providers.set(provider.id, provider as BusSearchProvider<unknown>);
}

/** Run one configured provider. The public API can retain its existing response shape. */
export async function runBusSearchProvider<TResult>(
  providerId: string,
  input: BusSearchInput
): Promise<TResult> {
  const provider = providers.get(providerId);
  if (!provider) throw new Error(`BUS_PROVIDER_NOT_REGISTERED:${providerId}`);
  return (provider as BusSearchProvider<TResult>).search(input);
}

/** Exposed for diagnostics and future provider selection. */
export function listBusSearchProviders(): string[] {
  return [...providers.keys()];
}
