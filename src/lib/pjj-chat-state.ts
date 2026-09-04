export type PjjChatItem = {
  id: string;
  body: string;
  senderName: string;
  senderIdentity: string;
  createdAt: string;
  status?: "pending" | "failed";
};

export const PJJ_CHAT_WINDOW = 200;

export function mergeChatHistory(current: PjjChatItem[], persisted: PjjChatItem[]) {
  const persistedIds = new Set(persisted.map((item) => item.id));
  const transient = current.filter((item) => item.status && !persistedIds.has(item.id));
  return [...persisted, ...transient].slice(-PJJ_CHAT_WINDOW);
}

export function appendPersistedChat(current: PjjChatItem[], message: PjjChatItem) {
  if (current.some((item) => item.id === message.id)) return current;
  return [...current, message].slice(-PJJ_CHAT_WINDOW);
}

export function settlePendingChat(
  current: PjjChatItem[],
  pendingId: string,
  persisted: PjjChatItem
) {
  return [
    ...current.filter((item) => item.id !== pendingId && item.id !== persisted.id),
    persisted,
  ].slice(-PJJ_CHAT_WINDOW);
}

export function markChatFailed(current: PjjChatItem[], pendingId: string) {
  return current.map((item) =>
    item.id === pendingId ? { ...item, status: "failed" as const } : item
  );
}
