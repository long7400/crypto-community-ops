import type { IAgentRuntime, Room, Service } from "@elizaos/core";

export interface DiscordClientLike {
  users?: {
    fetch?: (userId: string) => Promise<unknown>;
  };
  guilds?: {
    cache?: Map<string, unknown> | Record<string, unknown>;
  };
  channels?: {
    fetch?: (channelId: string) => Promise<unknown>;
  };
}

export interface DiscordServiceLike extends Service {
  client?: DiscordClientLike;
}

export interface TelegramBotLike {
  telegram?: {
    sendMessage?: (...args: unknown[]) => Promise<unknown>;
  };
}

export interface TelegramServiceLike extends Service {
  bot?: TelegramBotLike;
}

type ReadinessResult<T> =
  | { ok: true; client: T }
  | { ok: false; error: string };

export function getDiscordClient(
  runtime: IAgentRuntime,
): ReadinessResult<DiscordClientLike> {
  const discordService = runtime.getService("discord") as
    | DiscordServiceLike
    | undefined;

  if (!discordService) {
    return { ok: false, error: "Discord service not found" };
  }

  if (!discordService.client) {
    return { ok: false, error: "Discord client not initialized" };
  }

  return { ok: true, client: discordService.client };
}

export function requireDiscordClient(
  runtime: IAgentRuntime,
): DiscordClientLike {
  const result = getDiscordClient(runtime);
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.client;
}

export function getTelegramBot(
  runtime: IAgentRuntime,
): ReadinessResult<TelegramBotLike> {
  const telegramService = runtime.getService("telegram") as
    | TelegramServiceLike
    | undefined;

  if (!telegramService) {
    return { ok: false, error: "Telegram service not found" };
  }

  if (!telegramService.bot) {
    return { ok: false, error: "Telegram bot not initialized" };
  }

  return { ok: true, client: telegramService.bot };
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

type DiscordChannelLike = {
  guild?: { id?: string };
  guildId?: string;
};

export async function resolveRoomServerId(
  runtime: IAgentRuntime,
  room: Pick<Room, "source" | "serverId" | "channelId"> | undefined,
): Promise<string | undefined> {
  if (!room?.serverId) {
    return undefined;
  }

  if (room.source !== "discord" || !isUuidLike(room.serverId)) {
    return room.serverId;
  }

  const discordResult = getDiscordClient(runtime);
  if (
    !discordResult.ok ||
    !room.channelId ||
    !discordResult.client.channels?.fetch
  ) {
    return room.serverId;
  }

  try {
    const channel = (await discordResult.client.channels.fetch(
      room.channelId,
    )) as DiscordChannelLike | null;

    if (!channel || typeof channel !== "object") {
      return room.serverId;
    }

    return channel.guildId || channel.guild?.id || room.serverId;
  } catch {
    return room.serverId;
  }
}
