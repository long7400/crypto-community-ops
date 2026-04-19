import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@elizaos/core", async () => {
  const actual = await import("@elizaos/core");

  return {
    ...actual,
    composePromptFromState: vi.fn(() => "prompt"),
    createUniqueUuid: vi.fn(
      (_runtime: unknown, value: string) => `uuid:${value}`,
    ),
    initializeOnboarding: vi.fn().mockResolvedValue(undefined),
  };
});

import {
  type IAgentRuntime,
  initializeOnboarding,
  logger,
  stringToUuid,
} from "@elizaos/core";
import { character, communityManager } from "../src/communityManager/index.ts";
import timeoutUser from "../src/communityManager/plugins/communityManager/actions/timeout.ts";
import { CommunityManagerService } from "../src/communityManager/plugins/communityManager/communityService.ts";
import {
  initializeAllSystems,
  startOnboardingDM,
  startTelegramOnboarding,
} from "../src/init.ts";
import {
  createTelegramRuntimeMock,
  createTelegramWorld,
} from "./test_suites/TelegramTestSuite.ts";

describe("Eli5 Telegram E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guards Eli5 telegram plugin loading behind the dedicated token while preserving the secret wiring", () => {
    const secrets = character.settings?.secrets as
      | Record<string, unknown>
      | undefined;

    expect((character.plugins ?? []).includes("@elizaos/plugin-telegram")).toBe(
      Boolean(process.env.COMMUNITY_MANAGER_TELEGRAM_BOT_TOKEN),
    );
    expect(secrets).toHaveProperty("TELEGRAM_BOT_TOKEN");
    expect(secrets?.TELEGRAM_BOT_TOKEN).toBe(
      process.env.COMMUNITY_MANAGER_TELEGRAM_BOT_TOKEN,
    );
  });

  it("documents the Eli5 telegram token as dedicated to avoid 409 conflicts", () => {
    const envExample = readFileSync(
      resolve(process.cwd(), ".env.example"),
      "utf8",
    );

    expect(envExample).toContain("COMMUNITY_MANAGER_TELEGRAM_BOT_TOKEN=");
    expect(envExample).toMatch(/dedicated/i);
    expect(envExample).toMatch(/409 Conflict/i);
  });

  it("sends a deep-link onboarding message when TELEGRAM_WORLD_JOINED includes owner metadata", async () => {
    const { runtime, eventHandlers, telegramSendMessage } =
      createTelegramRuntimeMock();
    const world = createTelegramWorld();
    const init = communityManager.init;
    if (!init) {
      throw new Error("Community manager init is not defined");
    }

    await init(runtime);

    const handler = eventHandlers.get("TELEGRAM_WORLD_JOINED");

    expect(handler).toBeTypeOf("function");
    if (!handler) {
      throw new Error("Missing TELEGRAM_WORLD_JOINED handler");
    }

    await handler({
      world,
      chat: { id: -100123 },
      entities: [
        {
          metadata: {
            telegram: {
              adminTitle: "Owner",
              id: "owner-id",
              username: "ownerUser",
            },
          },
        },
      ],
      botUsername: "eli5_bot",
    });

    expect(initializeOnboarding).toHaveBeenCalledWith(
      runtime,
      world,
      expect.any(Object),
    );
    expect(telegramSendMessage).toHaveBeenCalledWith(-100123, {
      text: "Hello @ownerUser! Could we take a few minutes to get everything set up? Please click this link to start chatting with me: https://t.me/eli5_bot?start=onboarding",
    });
  });

  it("sends a generic onboarding deep-link when TELEGRAM_WORLD_JOINED is missing owner metadata", async () => {
    const { runtime, eventHandlers, telegramSendMessage } =
      createTelegramRuntimeMock();
    const world = createTelegramWorld();
    const init = communityManager.init;
    if (!init) {
      throw new Error("Community manager init is not defined");
    }

    await init(runtime);

    const handler = eventHandlers.get("TELEGRAM_WORLD_JOINED");
    if (!handler) {
      throw new Error("Missing TELEGRAM_WORLD_JOINED handler");
    }

    await handler({
      world,
      chat: { id: -100456 },
      entities: [],
      botUsername: "eli5_bot",
    });

    expect(telegramSendMessage).toHaveBeenCalledWith(-100456, {
      text: "Hello! Could we take a few minutes to get everything set up? Please click this link to start chatting with me: https://t.me/eli5_bot?start=onboarding",
    });
  });

  it("skips the Telegram onboarding deep-link when the telegram service is unavailable", async () => {
    const warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined);
    const runtime = {
      getService: vi.fn().mockReturnValue(undefined),
    } as unknown as IAgentRuntime;

    await expect(
      startTelegramOnboarding(
        runtime,
        createTelegramWorld(),
        { id: -100999 },
        [
          {
            metadata: {
              telegram: {
                adminTitle: "Owner",
                id: "owner-id",
                username: "ownerUser",
              },
            },
          },
        ],
        "eli5_bot",
      ),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      "Telegram service unavailable; skipping onboarding deep link",
    );
  });

  it("derives Discord onboarding world ids from the raw guild id to match plugin-discord", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const getWorld = vi.fn(async (worldId: string) => {
      return worldId === "uuid:discord-guild-1"
        ? { id: worldId, metadata: {} }
        : undefined;
    });
    const ensureWorldExists = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      agentId: "agent-id",
      getWorld,
      ensureWorldExists,
    } as unknown as IAgentRuntime;

    await initializeAllSystems(
      runtime,
      [
        {
          id: "discord-guild-1",
          ownerId: "owner-1",
          name: "Guild One",
        },
      ] as any,
      { settings: {} } as any,
    );

    expect(getWorld).toHaveBeenCalledWith("uuid:discord-guild-1");
    expect(ensureWorldExists).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "uuid:discord-guild-1",
        name: "Guild One",
      }),
    );
  });

  it("stores onboarding DMs with guild UUID aliases compatible with plugin-discord", async () => {
    const ensureRoomExists = vi.fn().mockResolvedValue(undefined);
    const createMemory = vi.fn().mockResolvedValue(undefined);
    const getEntityById = vi.fn().mockResolvedValue({ id: "agent-id" });
    const runtime = {
      agentId: "agent-id",
      ensureRoomExists,
      createMemory,
      getEntityById,
      createEntity: vi.fn().mockResolvedValue(undefined),
      character: { name: "Eli5" },
    } as unknown as IAgentRuntime;
    const send = vi.fn().mockResolvedValue({
      channel: { id: "dm-channel-1" },
      channelId: "dm-channel-1",
    });
    const guild = {
      id: "discord-guild-1",
      ownerId: "owner-1",
      members: {
        fetch: vi.fn().mockResolvedValue({
          id: "owner-1",
          user: { username: "ownerUser" },
          send,
        }),
      },
    } as any;

    await startOnboardingDM(runtime, guild, "uuid:discord-guild-1" as any);

    expect(ensureRoomExists).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "uuid:dm-channel-1",
        channelId: "dm-channel-1",
        messageServerId: stringToUuid("discord-guild-1"),
        serverId: stringToUuid("discord-guild-1"),
        worldId: "uuid:discord-guild-1",
      }),
    );
  });

  it("greets new Telegram members and stores a GREET_NEW_PERSON memory with telegram source", async () => {
    const { runtime, eventHandlers } = createTelegramRuntimeMock({
      adapter: {
        getWorld: vi.fn().mockResolvedValue(
          createTelegramWorld({
            SHOULD_GREET_NEW_PERSONS: { value: true },
            GREETING_MESSAGE: { value: "Be warm and brief." },
          }),
        ),
      },
    });
    const ctx = {
      chat: { id: -100777 },
      reply: vi.fn().mockResolvedValue(undefined),
    };

    runtime.useModel.mockResolvedValue("Welcome Ada Lovelace!");

    await CommunityManagerService.start(runtime);

    const handler = eventHandlers.get("TELEGRAM_ENTITY_JOINED");

    await handler?.({
      runtime,
      entityId: "new-member-entity",
      worldId: "world-1",
      newMember: {
        first_name: "Ada",
        last_name: "Lovelace",
        username: "ada",
      },
      ctx,
    });

    expect(ctx.reply).toHaveBeenCalledWith("Welcome Ada Lovelace!");
    expect(runtime.ensureRoomExists).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "uuid:-100777",
        source: "telegram",
        channelId: "-100777",
        serverId: "-100777",
        worldId: "world-1",
      }),
    );
    expect(runtime.createMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "new-member-entity",
        roomId: "uuid:-100777",
        content: expect.objectContaining({
          text: "Welcome Ada Lovelace!",
          source: "telegram",
          actions: ["GREET_NEW_PERSON"],
        }),
      }),
      "messages",
    );
  });

  it("skips Telegram greeting when SHOULD_GREET_NEW_PERSONS is disabled", async () => {
    const { runtime, eventHandlers } = createTelegramRuntimeMock({
      adapter: {
        getWorld: vi.fn().mockResolvedValue(
          createTelegramWorld({
            SHOULD_GREET_NEW_PERSONS: { value: false },
          }),
        ),
      },
    });
    const ctx = {
      chat: { id: -100778 },
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await CommunityManagerService.start(runtime);

    const handler = eventHandlers.get("TELEGRAM_ENTITY_JOINED");

    await handler?.({
      runtime,
      entityId: "new-member-entity",
      worldId: "world-1",
      newMember: {
        first_name: "Ada",
      },
      ctx,
    });

    expect(ctx.reply).not.toHaveBeenCalled();
    expect(runtime.createMemory).not.toHaveBeenCalled();
  });

  it("restricts resolvable Telegram moderation targets and records moderation memory", async () => {
    const { runtime, telegramRestrictChatMember } = createTelegramRuntimeMock({
      adapter: {
        getEntityById: vi.fn().mockResolvedValue({
          metadata: {
            telegram: {
              id: "telegram-user-99",
            },
          },
        }),
      },
    });
    const callback = vi.fn().mockResolvedValue(undefined);

    runtime.useModel.mockResolvedValue(
      '```json\n{"id":"target-entity","duration":600}\n```',
    );

    const result = await timeoutUser.handler(
      runtime,
      {
        agentId: "agent-id",
        entityId: "reporter-entity",
        roomId: "room-1",
        content: {
          source: "telegram",
          text: "They keep spamming scam links",
        },
      } as any,
      {
        data: {
          room: {
            id: "room-1",
            serverId: "-100999",
          },
        },
      } as any,
      undefined,
      callback,
      [],
    );

    expect(result).toEqual({ success: true });
    expect(telegramRestrictChatMember).toHaveBeenCalledWith(
      "-100999",
      "telegram-user-99",
      expect.objectContaining({
        permissions: expect.objectContaining({
          can_send_messages: false,
          can_send_media_messages: false,
        }),
        until_date: expect.any(Number),
      }),
    );
    expect(runtime.createMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-1",
        content: expect.objectContaining({
          source: "telegram",
          actions: ["TIMEOUT_USER"],
        }),
        metadata: { type: "MODERATION" },
      }),
      "messages",
    );
  });

  it("does not restrict or record moderation memory when the Telegram target cannot be resolved", async () => {
    const { runtime, telegramRestrictChatMember } = createTelegramRuntimeMock({
      adapter: {
        getEntityById: vi.fn().mockResolvedValue({
          metadata: {
            telegram: {},
          },
        }),
      },
    });
    const callback = vi.fn().mockResolvedValue(undefined);

    runtime.useModel.mockResolvedValue(
      '```json\n{"id":"target-entity","duration":300}\n```',
    );

    const result = await timeoutUser.handler(
      runtime,
      {
        agentId: "agent-id",
        entityId: "reporter-entity",
        roomId: "room-1",
        content: {
          source: "telegram",
          text: "They keep spamming scam links",
        },
      } as any,
      {
        data: {
          room: {
            id: "room-1",
            serverId: "-100999",
          },
        },
      } as any,
      undefined,
      callback,
      [],
    );

    expect(result).toEqual({
      success: false,
      error: "Telegram timeout failed",
    });
    expect(telegramRestrictChatMember).not.toHaveBeenCalled();
    expect(runtime.createMemory).not.toHaveBeenCalled();
  });
});
