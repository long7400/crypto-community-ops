import {
  ChannelType,
  createUniqueUuid,
  type Entity,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  Service,
  type UUID,
  type World,
} from "@elizaos/core";
import dedent from "dedent";
import { mergeCommunityModerationSettings } from "./moderation/defaults";
import { ServiceType } from "./types";

export class CommunityManagerService extends Service {
  static serviceType = ServiceType.COMMUNITY_MANAGER;
  capabilityDescription = "community manager";

  private handleDiscordUserJoined = this.onDiscordUserJoined.bind(this);
  private handleTelegramUserJoined = this.onTelegramUserJoined.bind(this);

  constructor(protected runtime: IAgentRuntime) {
    super(runtime);

    this.addEventListener(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<CommunityManagerService> {
    const service = new CommunityManagerService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    const service = runtime.getService(ServiceType.COMMUNITY_MANAGER);
    if (service) {
      await service.stop();
    }
  }

  async stop(): Promise<void> {}

  getDiscordGreetChannelId(world: World, guild): string | null {
    if (!world) {
      logger.warn("World not found!");
      return null;
    }
    const shouldGreetUser =
      world.metadata?.settings?.["SHOULD_GREET_NEW_PERSONS"]?.value;
    const greetChannel = world.metadata?.settings?.["GREETING_CHANNEL"]?.value;

    if (
      !(
        shouldGreetUser === true ||
        String(shouldGreetUser).toLowerCase() === "true" ||
        String(shouldGreetUser).toLowerCase() === "yes"
      )
    ) {
      return null;
    }

    if (greetChannel) {
      // Try to get channel by ID
      const channel = guild.channels.cache.get(greetChannel);
      if (channel?.isTextBased()) return channel.id;

      // Try to match by name if not found by ID
      const foundByName = guild.channels.cache.find(
        (ch) => ch.isTextBased() && ch.name === greetChannel,
      );
      if (foundByName) return foundByName.id;

      logger.warn(`Greet channel "${greetChannel}" not found by ID or name.`);
    }

    // Fallback: pick any text-based channel
    const fallback = guild.channels.cache.find((ch) => ch.isTextBased());
    if (fallback) return fallback.id;

    return null;
  }

  async getGreetingMessage(
    runtime: IAgentRuntime,
    userName: string,
    greetingMessage?: string,
  ) {
    const basePrompt = dedent`
      You're a helpful assistant generating welcome messages for new users.

      Please create a warm and friendly welcome message for a new user named "${userName}".

      ${
        greetingMessage
          ? `Here are some keywords or ideas the server owner would like to include: "${greetingMessage}".`
          : ""
      }

      Make sure the message feels personal and inviting.
      Return only the welcome message as a raw string. Do not wrap it in JSON or add any labels.
    `;

    const message = await runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt: basePrompt,
    });

    function extractString(value: unknown): string {
      let result = "";

      function traverse(node: unknown): void {
        if (typeof node === "string") {
          result += node;
        } else if (Array.isArray(node)) {
          for (const item of node) {
            traverse(item);
          }
        } else if (typeof node === "object" && node !== null) {
          for (const val of Object.values(node)) {
            traverse(val);
          }
        }
      }

      traverse(value);
      return result.trim();
    }

    return typeof message === "string" ? message : extractString(message);
  }

  async onDiscordUserJoined(params) {
    const runtime = params.runtime;
    const member = params.member;
    const entityId = params.entityId;
    const guild = params.guild;
    const worldId = params.worldId;

    const world = await runtime.adapter.getWorld(worldId);

    const greetChannelId = this.getDiscordGreetChannelId(world, guild);

    if (world && greetChannelId) {
      const greetingMsgSettings =
        world.metadata?.settings["GREETING_MESSAGE"]?.value;
      const channel = guild.channels.cache.get(greetChannelId);
      if (channel?.isTextBased()) {
        let greetingMessage = await this.getGreetingMessage(
          runtime,
          `<@${member.id}>`,
          greetingMsgSettings,
        );

        //Replace any plain member ID with a proper Discord mention format, but skip ones already formatted
        if (greetingMessage) {
          greetingMessage = greetingMessage.replace(
            new RegExp(`(?<!<@)${member.id}(?!>)`, "g"),
            `<@${member.id}>`,
          );
        }

        const welcomeText =
          greetingMessage ||
          `Welcome <@${member.id}>! I'm ${runtime.character.name}, the community manager. Feel free to introduce yourself!`;

        await channel.send(welcomeText);

        const roomId = createUniqueUuid(runtime, greetChannelId);

        await runtime.ensureRoomExists({
          id: roomId,
          source: "discord",
          type: ChannelType.GROUP,
          channelId: greetChannelId,
          serverId: guild.id,
          worldId: worldId,
        });

        // Create memory of the initial message
        await runtime.createMemory(
          {
            agentId: runtime.agentId,
            entityId,
            roomId: roomId,
            content: {
              text: welcomeText,
              actions: ["GREET_NEW_PERSON"],
            },
            createdAt: Date.now(),
          },
          "messages",
        );
      } else {
        logger.warn(
          `Channel ${greetChannelId} is not a text-based channel or not found.`,
        );
      }
    }
  }

  async onTelegramUserJoined(params) {
    const { runtime, entityId, worldId, telegramUser } = params;
    if (typeof telegramUser !== "object" || telegramUser === null) {
      logger.warn(
        "Telegram join event missing telegramUser; skipping greeting",
      );
      return;
    }

    const world = await runtime.adapter.getWorld(worldId);
    if (!world) {
      logger.warn(`World not found for worldId: ${worldId}`);
      return;
    }
    const rawCommunityModerationSettings =
      world.metadata?.settings?.["COMMUNITY_MODERATION"]?.value;
    const telegramModerationSettings =
      typeof rawCommunityModerationSettings === "object" &&
      rawCommunityModerationSettings !== null &&
      !Array.isArray(rawCommunityModerationSettings)
        ? mergeCommunityModerationSettings(
            rawCommunityModerationSettings as any,
          )
        : undefined;
    const legacyShouldGreet =
      world.metadata?.settings?.["SHOULD_GREET_NEW_PERSONS"]?.value;
    const shouldGreetUser =
      telegramModerationSettings?.platforms.telegram.greeting.enabled ??
      legacyShouldGreet;

    if (
      !(
        shouldGreetUser === true ||
        String(shouldGreetUser).toLowerCase() === "true" ||
        String(shouldGreetUser).toLowerCase() === "yes"
      )
    ) {
      return;
    }

    const userName =
      (telegramUser.first_name
        ? telegramUser.first_name +
          (telegramUser.last_name ? ` ${telegramUser.last_name}` : "")
        : telegramUser.username) || "friend";

    const configuredTemplate =
      telegramModerationSettings?.platforms.telegram.greeting.template?.trim();

    const greetingMessage = configuredTemplate
      ? configuredTemplate
          .replace("{displayName}", userName)
          .replace(
            "{username}",
            telegramUser.username ? `@${telegramUser.username}` : userName,
          )
      : await this.getGreetingMessage(
          runtime,
          userName,
          world.metadata?.settings?.["GREETING_MESSAGE"]?.value,
        );

    const welcomeText =
      greetingMessage ||
      `Welcome ${userName}! I'm ${runtime.character.name}, your community manager. Feel free to say hi!`;

    // world.serverId is deprecated; world.messageServerId may also be absent after DB round-trip
    // because the Telegram plugin passes `serverId` (not `messageServerId`) to ensureWorldExists,
    // which only persists `messageServerId`. Resolve chatId from the world's rooms as a fallback.
    let chatId = world.serverId ?? world.messageServerId;
    if (!chatId) {
      const worldRooms = await runtime.getRooms(worldId);
      chatId = (worldRooms ?? []).find(
        (r) => r.source === "telegram",
      )?.channelId;
    }

    if (!chatId) {
      logger.warn(
        "Cannot send greeting: chatId could not be resolved from world or rooms",
      );
      return;
    }

    const telegram = runtime.getService("telegram") as any;
    if (telegram?.messageManager?.sendMessage) {
      try {
        await telegram.messageManager.sendMessage(chatId, {
          text: welcomeText,
        });
      } catch (err) {
        logger.error(`Failed to send greeting in Telegram: ${err}`);
      }
    } else {
      logger.warn("Telegram service unavailable; greeting message skipped");
    }

    const roomId = createUniqueUuid(runtime, chatId);

    await runtime.ensureRoomExists({
      id: roomId,
      source: "telegram",
      type: ChannelType.GROUP,
      channelId: chatId,
      serverId: chatId,
      worldId,
    });

    await runtime.createMemory(
      {
        agentId: runtime.agentId,
        entityId,
        roomId,
        content: {
          source: "telegram",
          text: welcomeText,
          actions: ["GREET_NEW_PERSON"],
        },
        createdAt: Date.now(),
      },
      "messages",
    );
  }

  addEventListener(runtime: IAgentRuntime): void {
    runtime.registerEvent("DISCORD_USER_JOINED", this.handleDiscordUserJoined);
    runtime.registerEvent(
      "TELEGRAM_ENTITY_JOINED",
      this.handleTelegramUserJoined,
    );
  }
}
