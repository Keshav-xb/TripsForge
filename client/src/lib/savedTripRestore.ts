export function shouldRestoreSavedTrip({
  savedTripId,
  isAuthenticated,
  restoredTripId,
}: {
  savedTripId: string | null;
  isAuthenticated: boolean;
  restoredTripId: string | null;
}) {
  return Boolean(savedTripId && isAuthenticated && restoredTripId !== savedTripId);
}
