export type BusSearchInput = {
  origin: string;
  destination: string;
  travelDate: string;
};

export interface BusSearchProvider<TResult> {
  readonly id: string;
  /** Higher-priority providers are considered first during discovery. */
  readonly priority?: number;
  /** Return false when this provider cannot serve the requested search. */
  supports?(input: BusSearchInput): boolean;
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

/**
 * Discover configured providers that can handle this request.
 * Providers without a supports predicate remain eligible for backwards compatibility.
 * Stable registration order is retained when priorities are equal.
 */
export function discoverBusSearchProviders(input: BusSearchInput): string[] {
  return Array.from(providers.values())
    .map((provider, index) => ({ provider, index }))
    .filter(({ provider }) => provider.supports?.(input) !== false)
    .sort((a, b) => (b.provider.priority ?? 0) - (a.provider.priority ?? 0) || a.index - b.index)
    .map(({ provider }) => provider.id);
}

/** Run one configured provider. The public API can retain its existing response shape. */
export async function runBusSearchProvider<TResult>(
  providerId: string,
  input: BusSearchInput
): Promise<TResult> {
  const provider = providers.get(providerId);
  if (!provider) throw new Error(`BUS_PROVIDER_NOT_REGISTERED:${providerId}`);
  if (provider.supports?.(input) === false) {
    throw new Error(`BUS_PROVIDER_UNSUPPORTED_SEARCH:${providerId}`);
  }
  return (provider as BusSearchProvider<TResult>).search(input);
}

/** Exposed for diagnostics and future provider selection. */
export function listBusSearchProviders(): string[] {
  return Array.from(providers.keys());
}
