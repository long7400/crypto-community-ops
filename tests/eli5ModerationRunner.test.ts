import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTelegramMessagePayload } from "../src/communityManager/plugins/communityManager/moderation/normalizer";
import { TelegramModerationAdapter } from "../src/communityManager/plugins/communityManager/moderation/telegramAdapter";
import { ModerationRunner } from "../src/communityManager/plugins/communityManager/moderation/moderationRunner";
import { telegramModerationEvaluator } from "../src/communityManager/plugins/communityManager/moderation/telegramModerationEvaluator";
import { callTelegramApi } from "../src/communityManager/plugins/communityManager/moderation/telegramErrors";

describe("callTelegramApi", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should retry once when Telegram returns 429", async () => {
		const operation = vi
			.fn()
			.mockRejectedValueOnce({
				response: { error_code: 429, parameters: { retry_after: 1 } },
			})
			.mockResolvedValueOnce("ok");

		const resultPromise = callTelegramApi(operation, "retry test");

		await vi.advanceTimersByTimeAsync(1000);

		await expect(resultPromise).resolves.toBe("ok");
		expect(operation).toHaveBeenCalledTimes(2);
	});

	it("should rethrow immediately when Telegram returns 400", async () => {
		const error = {
			response: { error_code: 400, description: "bad request" },
		};
		const operation = vi.fn().mockRejectedValue(error);

		await expect(callTelegramApi(operation, "bad request")).rejects.toBe(error);
		expect(operation).toHaveBeenCalledTimes(1);
	});
});

describe("normalizeTelegramMessagePayload", () => {
	it("should normalize raw Telegram message payloads when Telegram provides chat and sender data", () => {
		const message = normalizeTelegramMessagePayload({
			worldId: "world-1",
			roomId: "room-1",
			originalMessage: {
				message_id: 42,
				date: 1710000000,
				message_thread_id: 123,
				text: "hello group",
				chat: { id: -100123, type: "supergroup", title: "Group" },
				from: {
					id: 777,
					first_name: "Ada",
					username: "ada_dev",
					is_bot: false,
				},
			},
		} as any);

		expect(message).toEqual(
			expect.objectContaining({
				platform: "telegram",
				communityId: "-100123",
				channelId: "-100123",
				channelType: "supergroup",
				threadId: "123",
				roomId: "room-1",
				worldId: "world-1",
				messageId: "42",
				userId: "777",
				username: "ada_dev",
				displayName: "Ada",
				text: "hello group",
				createdAt: 1710000000000,
			}),
		);
	});

	it("should normalize Telegram memories created by plugin-telegram 1.6.4 when sender and room context are hydrated", () => {
		const message = normalizeTelegramMessagePayload({
			message: {
				id: "memory-1",
				roomId: "room-1",
				entityId: "entity-1",
				content: {
					text: "gm builders",
					source: "telegram",
				},
				metadata: {
					fromId: "-100123",
					sourceId: "42",
					entityUserName: "ada_dev",
					entityName: "Ada",
				},
				createdAt: 1710000000000,
			},
			state: {
				data: {
					room: {
						worldId: "world-1",
						channelId: "-100123",
						serverId: "-100123",
						metadata: { threadId: "123" },
					},
				},
			},
		} as any);

		expect(message).toEqual(
			expect.objectContaining({
				platform: "telegram",
				communityId: "-100123",
				channelId: "-100123",
				threadId: "123",
				roomId: "room-1",
				worldId: "world-1",
				messageId: "42",
				username: "ada_dev",
				displayName: "Ada",
				text: "gm builders",
			}),
		);
	});

	it("should return null when Telegram messages come from bots or have no text", () => {
		expect(
			normalizeTelegramMessagePayload({
				worldId: "world-1",
				roomId: "room-1",
				originalMessage: {
					message_id: 43,
					date: 1710000000,
					chat: { id: -100123, type: "supergroup" },
					from: { id: 999, first_name: "Bot", is_bot: true },
				},
			} as any),
		).toBeNull();
	});
});

describe("TelegramModerationAdapter", () => {
	it("should send warning messages through the Telegram message manager when warn is called", async () => {
		const sendMessage = vi.fn().mockResolvedValue([]);
		const runtime: any = {
			getService: () => ({ messageManager: { sendMessage } }),
		};
		const adapter = new TelegramModerationAdapter(runtime);

		await adapter.warn("-100123", "Please keep it respectful.");

		expect(sendMessage).toHaveBeenCalledWith("-100123", {
			text: "Please keep it respectful.",
		});
	});

	it("should restrict a user when mute is requested with valid bot permissions", async () => {
		const restrictChatMember = vi.fn().mockResolvedValue(true);
		const getChatMember = vi.fn().mockResolvedValue({
			status: "administrator",
			can_restrict_members: true,
		});
		const runtime: any = {
			getService: () => ({
				bot: {
					botInfo: { id: 999 },
					telegram: { restrictChatMember, getChatMember },
				},
			}),
		};
		const adapter = new TelegramModerationAdapter(runtime);

		await adapter.mute("-100123", "777", { durationSeconds: 3600 });

		expect(restrictChatMember).toHaveBeenCalledWith(
			"-100123",
			"777",
			expect.objectContaining({
				permissions: expect.objectContaining({ can_send_messages: false }),
				until_date: expect.any(Number),
			}),
		);
		expect(getChatMember).toHaveBeenCalledWith("-100123", 999);
	});

	it("should reject mute when the Telegram bot cannot restrict members", async () => {
		const runtime: any = {
			getService: () => ({
				bot: {
					botInfo: { id: 999 },
					telegram: {
						getChatMember: vi.fn().mockResolvedValue({ status: "member" }),
						restrictChatMember: vi.fn(),
					},
				},
			}),
		};
		const adapter = new TelegramModerationAdapter(runtime);

		await expect(
			adapter.mute("-100123", "777", { durationSeconds: 3600 }),
		).rejects.toThrow("Telegram bot cannot restrict members");
	});
});

describe("telegramModerationEvaluator", () => {
	it("should run for plugin-created Telegram memories when evaluator validation succeeds", async () => {
		const message: any = {
			content: { source: "telegram", text: "hello" },
			metadata: { chatId: "-100123" },
		};

		await expect(
			telegramModerationEvaluator.validate({} as any, message, {} as any),
		).resolves.toBe(true);
		expect(telegramModerationEvaluator.alwaysRun).toBe(true);
	});
});

describe("ModerationRunner", () => {
	it("should record a dry-run audit when spam is detected", async () => {
		const createMemory = vi.fn().mockResolvedValue(undefined);
		const sendMessage = vi.fn().mockResolvedValue([]);
		const restrictChatMember = vi.fn();
		const runtime: any = {
			agentId: "agent-id",
			getSetting: vi.fn((name: string) =>
				name === "TELEGRAM_ALLOWED_CHATS" ? '["-100123"]' : undefined,
			),
			getWorld: vi.fn().mockResolvedValue({
				id: "world-1",
				metadata: { settings: {} },
			}),
			getMemories: vi.fn().mockResolvedValue([]),
			createMemory,
			getService: vi.fn(() => ({
				messageManager: { sendMessage },
				bot: {
					botInfo: { id: 999 },
					telegram: {
						restrictChatMember,
						getChatMember: vi.fn().mockResolvedValue({
							status: "administrator",
							can_restrict_members: true,
						}),
					},
				},
			})),
			useModel: vi.fn().mockResolvedValue(
				'{"category":"safe","severity":"low","confidence":1,"reason":"safe","signals":[]}',
			),
		};

		await new ModerationRunner(runtime).handleMemory({
			content: {
				source: "telegram",
				text: "buy https://a.example https://b.example https://c.example",
			},
			roomId: "room-1",
			worldId: "world-1",
			metadata: {
				chatId: "-100123",
				chatType: "supergroup",
				messageId: "42",
				fromId: "777",
				displayName: "Ada",
				threadId: "123",
			},
			createdAt: 1710000000000,
		} as any);

		expect(sendMessage).not.toHaveBeenCalled();
		expect(restrictChatMember).not.toHaveBeenCalled();
		expect(createMemory).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					type: "COMMUNITY_MODERATION_AUDIT",
					action: "warn",
					dryRun: true,
					threadId: "123",
				}),
			}),
			"messages",
		);
		expect(createMemory).not.toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					type: "COMMUNITY_VIOLATION_STATE",
				}),
			}),
			"messages",
		);
	});

	it("should skip moderation when allowed chats excludes the current Telegram chat", async () => {
		const createMemory = vi.fn();
		const runtime: any = {
			agentId: "agent-id",
			getSetting: vi.fn((name: string) =>
				name === "TELEGRAM_ALLOWED_CHATS" ? '["-100999"]' : undefined,
			),
			getWorld: vi.fn().mockResolvedValue({
				id: "world-1",
				metadata: { settings: {} },
			}),
			getMemories: vi.fn().mockResolvedValue([]),
			createMemory,
		};

		await new ModerationRunner(runtime).handleMemory({
			content: {
				source: "telegram",
				text: "buy https://a.example https://b.example https://c.example",
			},
			roomId: "room-1",
			worldId: "world-1",
			metadata: {
				chatId: "-100123",
				chatType: "supergroup",
				messageId: "42",
				fromId: "777",
				displayName: "Ada",
			},
		} as any);

		expect(createMemory).not.toHaveBeenCalled();
	});

	it("should deny settings mutation when the sender is not a Telegram admin", async () => {
		const world: any = { id: "world-1", metadata: { settings: {} } };
		const sendMessage = vi.fn().mockResolvedValue([]);
		const runtime: any = {
			agentId: "agent-id",
			getWorld: vi.fn().mockResolvedValue(world),
			updateWorld: vi.fn(async (updated: any) => Object.assign(world, updated)),
			getService: vi.fn(() => ({
				messageManager: { sendMessage },
				bot: {
					telegram: {
						getChatMember: vi.fn().mockResolvedValue({ status: "member" }),
					},
				},
			})),
		};

		await new ModerationRunner(runtime).handleMemory({
			content: { source: "telegram", text: "/eli5 dry-run off" },
			roomId: "room-1",
			worldId: "world-1",
			metadata: {
				chatId: "-100123",
				chatType: "supergroup",
				messageId: "50",
				fromId: "777",
				displayName: "Ada",
			},
		} as any);

		expect(world.metadata.settings.COMMUNITY_MODERATION).toBeUndefined();
		expect(sendMessage).toHaveBeenCalledWith(
			"-100123",
			expect.objectContaining({ text: expect.stringContaining("admins") }),
		);
	});

	it("should resolve the Telegram sender id from entity metadata when plugin-created admin commands use chat-scoped fromId", async () => {
		const world: any = { id: "world-1", metadata: { settings: {} } };
		const sendMessage = vi.fn().mockResolvedValue([]);
		const getChatMember = vi.fn().mockResolvedValue({
			status: "administrator",
		});
		const runtime: any = {
			agentId: "agent-id",
			getWorld: vi.fn().mockResolvedValue(world),
			updateWorld: vi.fn(async (updated: any) => Object.assign(world, updated)),
			getEntityById: vi.fn().mockResolvedValue({
				id: "entity-1",
				metadata: { telegram: { id: "777" } },
			}),
			getService: vi.fn(() => ({
				messageManager: { sendMessage },
				bot: {
					telegram: {
						getChatMember,
					},
				},
			})),
		};

		await new ModerationRunner(runtime).handleMemory({
			id: "memory-1",
			roomId: "room-1",
			entityId: "entity-1",
			worldId: "world-1",
			content: {
				source: "telegram",
				text: "/eli5 dry-run off",
			},
			metadata: {
				fromId: "-100123",
				sourceId: "42",
				entityUserName: "ada_dev",
				entityName: "Ada",
			},
			createdAt: 1710000000000,
		} as any);

		expect(getChatMember).toHaveBeenCalledWith("-100123", "777");
		expect(world.metadata.settings.COMMUNITY_MODERATION.value.dryRun).toBe(
			false,
		);
		expect(sendMessage).toHaveBeenCalledWith(
			"-100123",
			expect.objectContaining({
				text: expect.stringContaining("Dry-run: off"),
			}),
		);
	});

	it("should record Telegram topic scope when plugin-created memories come from forum rooms", async () => {
		const createMemory = vi.fn().mockResolvedValue(undefined);
		const runtime: any = {
			agentId: "agent-id",
			getSetting: vi.fn((name: string) =>
				name === "TELEGRAM_ALLOWED_CHATS" ? '["-100123"]' : undefined,
			),
			getWorld: vi.fn().mockResolvedValue({
				id: "world-1",
				metadata: { settings: {} },
			}),
			getRoom: vi.fn().mockResolvedValue({
				id: "room-1",
				channelId: "-100123-456",
				serverId: "-100123",
				worldId: "world-1",
				metadata: {
					threadId: "456",
					parentChatId: "-100123",
				},
			}),
			getEntityById: vi.fn().mockResolvedValue({
				id: "entity-1",
				metadata: { telegram: { id: "777" } },
			}),
			getMemories: vi.fn().mockResolvedValue([]),
			createMemory,
			getService: vi.fn(() => ({
				messageManager: { sendMessage: vi.fn().mockResolvedValue([]) },
				bot: {
					botInfo: { id: 999 },
					telegram: {
						restrictChatMember: vi.fn(),
						getChatMember: vi.fn().mockResolvedValue({
							status: "administrator",
							can_restrict_members: true,
						}),
					},
				},
			})),
			useModel: vi.fn().mockResolvedValue(
				'{"category":"safe","severity":"low","confidence":1,"reason":"safe","signals":[]}',
			),
		};

		await new ModerationRunner(runtime).handleMemory({
			id: "memory-1",
			roomId: "room-1",
			entityId: "entity-1",
			content: {
				source: "telegram",
				text: "buy https://a.example https://b.example https://c.example",
			},
			metadata: {
				fromId: "-100123",
				sourceId: "42",
				entityUserName: "ada_dev",
				entityName: "Ada",
			},
			createdAt: 1710000000000,
		} as any);

		expect(createMemory).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					type: "COMMUNITY_MODERATION_AUDIT",
					channelId: "-100123",
					threadId: "456",
					userId: "777",
				}),
			}),
			"messages",
		);
	});
});
