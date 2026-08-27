/** Monsoon Atlas signature motif: a compact compass-and-route marginal line used to organize, not decorate, each major page. */
import { cn } from "@/lib/utils";

export default function RouteMotif({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  const stroke = inverse ? "#ffb34b" : "#e6651b";
  const ring = inverse ? "rgba(255,179,75,.32)" : "rgba(230,101,27,.18)";
  return <div aria-hidden="true" className={cn("pointer-events-none select-none", className)}><svg viewBox="0 0 150 360" fill="none" className="h-full w-full"><circle cx="115" cy="50" r="31" stroke={ring} strokeWidth="1.5" /><circle cx="115" cy="50" r="16" stroke={stroke} strokeWidth="1.5" strokeDasharray="3 4" /><path d="M115 20V80M85 50H145" stroke={stroke} strokeWidth="1.5" opacity=".75" /><path d="M28 315C41 244 87 284 74 212C62 147 116 171 105 106" stroke={stroke} strokeWidth="2" strokeDasharray="4 6" /><circle cx="28" cy="315" r="7" fill={stroke} /><circle cx="74" cy="212" r="6" fill="#fffdf8" stroke={stroke} strokeWidth="2" /><circle cx="105" cy="106" r="7" fill={stroke} /></svg></div>;
}
