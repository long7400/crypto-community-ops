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

import { initializeOnboarding } from "@elizaos/core";
import { character, communityManager } from "../src/communityManager/index.ts";
import timeoutUser from "../src/communityManager/plugins/communityManager/actions/timeout.ts";
import { CommunityManagerService } from "../src/communityManager/plugins/communityManager/communityService.ts";
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
