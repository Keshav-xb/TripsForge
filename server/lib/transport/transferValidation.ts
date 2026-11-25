import {
  isLegFresh,
  parseOffsetTimestamp,
  validateNormalizedLeg,
  type NormalizedServiceLeg,
  type TransportMode,
} from "./providerContract.js";

export type TransferAssessment =
  | { status: "feasible"; transferMinutes: number; requiredMinutes: number; message: string }
  | { status: "impossible"; transferMinutes: number; requiredMinutes: number; message: string }
  | { status: "unverified"; message: string };

const MIN_TRANSFER_MINUTES: Record<TransportMode, number> = {
  flight: 90,
  train: 20,
  bus: 20,
  ferry: 45,
  car: 0,
  walk: 0,
};

export function assessNormalizedTransfer(
  incoming: NormalizedServiceLeg,
  outgoing: NormalizedServiceLeg,
): TransferAssessment {
  const incomingValidation = validateNormalizedLeg(incoming);
  const outgoingValidation = validateNormalizedLeg(outgoing);
  if (!incomingValidation.valid || !outgoingValidation.valid) {
    return { status: "unverified", message: "One or both provider legs failed normalized-leg validation." };
  }
  if (!isLegFresh(incoming) || !isLegFresh(outgoing)) {
    return { status: "unverified", message: "One or both provider records are future-dated or outside their stated validity window." };
  }
  if (incoming.toNodeId !== outgoing.fromNodeId) {
    return { status: "unverified", message: "The legs do not share the exact same canonical transfer node." };
  }
  const arrival = parseOffsetTimestamp(incoming.arrivalAt);
  const departure = parseOffsetTimestamp(outgoing.departureAt);
  if (arrival === undefined || departure === undefined) {
    return { status: "unverified", message: "A real timezone-aware arrival and departure timestamp are required to assess this transfer." };
  }
  const transferMinutes = (departure - arrival) / 60_000;
  const requiredMinutes = Math.max(MIN_TRANSFER_MINUTES[incoming.mode], MIN_TRANSFER_MINUTES[outgoing.mode]);
  if (transferMinutes < requiredMinutes || transferMinutes > 12 * 60) {
    return {
      status: "impossible",
      transferMinutes,
      requiredMinutes,
      message: transferMinutes < requiredMinutes
        ? "The available transfer time is below the conservative minimum buffer."
        : "The layover exceeds the supported 12-hour connection window.",
    };
  }
  return {
    status: "feasible",
    transferMinutes,
    requiredMinutes,
    message: "The provider timestamps and exact node identity satisfy the configured transfer-time rule. This is not an operator guarantee.",
  };
}
