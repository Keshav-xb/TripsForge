import { useEffect } from "react";
import { useLocation } from "wouter";

function scrollToRouteStart() {
  const hash = window.location.hash;
  if (hash) {
    const targetId = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ block: "start", behavior: "auto" });
      return;
    }
  }

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export default function RouteScrollRestoration() {
  const [location] = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(scrollToRouteStart);
    const handleHashChange = () => {
      window.requestAnimationFrame(scrollToRouteStart);
    };
    const handleAnchorClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const targetUrl = new URL(anchor.href, window.location.href);
      if (targetUrl.origin !== window.location.origin || targetUrl.pathname !== window.location.pathname || !targetUrl.hash) return;
      window.requestAnimationFrame(() => {
        if (window.location.hash !== targetUrl.hash) window.history.replaceState(null, "", `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
        scrollToRouteStart();
      });
    };
    window.addEventListener("hashchange", handleHashChange);
    document.addEventListener("click", handleAnchorClick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", handleHashChange);
      document.removeEventListener("click", handleAnchorClick);
    };
  }, [location]);

  return null;
}
