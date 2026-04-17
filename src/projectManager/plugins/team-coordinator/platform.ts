import type { IAgentRuntime, Service } from "@elizaos/core";

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

export async function getDiscordClient(
  runtime: IAgentRuntime,
): Promise<ReadinessResult<DiscordClientLike>> {
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

export async function requireDiscordClient(
  runtime: IAgentRuntime,
): Promise<DiscordClientLike> {
  const result = await getDiscordClient(runtime);
  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.client;
}

export async function getTelegramBot(
  runtime: IAgentRuntime,
): Promise<ReadinessResult<TelegramBotLike>> {
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
