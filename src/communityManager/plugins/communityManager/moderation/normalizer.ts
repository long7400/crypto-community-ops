import type { ModerationMessage } from "./types";

export function normalizeTelegramMessagePayload(
  payload: any,
): ModerationMessage | null {
  if (payload?.message?.content?.source === "telegram") {
    return normalizeTelegramMemoryPayload(payload);
  }

  const originalMessage = payload?.originalMessage ?? payload?.message;
  const chat = originalMessage?.chat ?? payload?.chat;
  const from = originalMessage?.from ?? payload?.from;
  const text =
    typeof originalMessage?.text === "string"
      ? originalMessage.text
      : typeof originalMessage?.caption === "string"
        ? originalMessage.caption
        : "";

  if (!chat?.id || !from?.id || from.is_bot || text.trim().length === 0) {
    return null;
  }

  const messageId = String(originalMessage?.message_id ?? payload?.messageId);
  if (!messageId || messageId === "undefined") {
    return null;
  }

  return {
    platform: "telegram",
    communityId: String(chat.id),
    channelId: String(chat.id),
    channelType: chat.type,
    threadId:
      typeof originalMessage?.message_thread_id === "number"
        ? String(originalMessage.message_thread_id)
        : undefined,
    roomId: String(payload.roomId),
    worldId: String(payload.worldId),
    messageId,
    userId: String(from.id),
    username: from.username,
    displayName: from.first_name || from.username || String(from.id),
    text: text.trim(),
    createdAt:
      typeof originalMessage?.date === "number"
        ? originalMessage.date * 1000
        : Date.now(),
    raw: payload,
  };
}

export function normalizeTelegramMemoryPayload(
  payload: any,
): ModerationMessage | null {
  const memory = payload.message ?? payload;
  const room = payload.state?.data?.room;
  const text = memory.content?.text;
  const channelId =
    room?.channelId ??
    room?.serverId ??
    memory.metadata?.chatId ??
    memory.metadata?.fromId ??
    undefined;
  const communityId = room?.serverId ?? channelId;
  const worldId = room?.worldId ?? payload.worldId;
  const messageId =
    memory.metadata?.sourceId ?? memory.metadata?.messageId ?? memory.id;

  if (!channelId || !communityId || !worldId || !memory.roomId || !messageId) {
    return null;
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    return null;
  }

  return {
    platform: "telegram",
    communityId: String(communityId),
    channelId: String(channelId),
    channelType: room?.type ?? memory.metadata?.chatType,
    threadId: room?.metadata?.threadId ?? memory.metadata?.threadId,
    roomId: String(memory.roomId),
    worldId: String(worldId),
    messageId: String(messageId),
    userId: String(memory.metadata?.fromId ?? memory.entityId),
    username: memory.metadata?.entityUserName ?? memory.metadata?.username,
    displayName:
      memory.metadata?.displayName ??
      memory.metadata?.entityName ??
      memory.metadata?.entityUserName ??
      memory.metadata?.username ??
      String(memory.entityId),
    text: text.trim(),
    createdAt: memory.createdAt ?? Date.now(),
    raw: payload,
  };
}
