const safeAppOrigin = () => {
  const configured = import.meta.env.VITE_APP_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.origin;
      }
    } catch {
      // Fall through to the current page origin when a deployment variable is malformed.
    }
  }

  return window.location.origin;
};

export function accountRedirectUrl(options: { next?: string; mode?: "reset" } = {}) {
  const redirect = new URL("/account", safeAppOrigin());

  if (options.next) redirect.searchParams.set("next", options.next);
  if (options.mode) redirect.searchParams.set("mode", options.mode);

  return redirect.toString();
}
