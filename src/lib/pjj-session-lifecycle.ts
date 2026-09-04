export type CancellableLiveSession = {
  roomName: string;
  status: string;
  actualStart: Date | null;
};

export async function closeProviderRoomForCancellation(
  session: CancellableLiveSession,
  closeRoom: (roomName: string) => Promise<unknown>
) {
  if (session.status !== "LIVE" && !session.actualStart) return { attempted: false };
  await closeRoom(session.roomName);
  return { attempted: true };
}

export async function cancelLiveSessionWithProvider<T>(
  session: CancellableLiveSession,
  markCancelled: () => Promise<T>,
  closeRoom: (roomName: string) => Promise<unknown>
) {
  // Close the authorization gate first. If provider deletion fails, a retry
  // can safely repeat deletion without allowing a fresh token in between.
  const updated = await markCancelled();
  await closeProviderRoomForCancellation(session, closeRoom);
  return updated;
}
