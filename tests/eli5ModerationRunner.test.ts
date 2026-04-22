import { describe, expect, it } from "vitest";
import { normalizeTelegramMessagePayload } from "../src/communityManager/plugins/communityManager/moderation/normalizer";

describe("normalizeTelegramMessagePayload", () => {
	it("normalizes raw Telegram message payloads", () => {
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

	it("normalizes Telegram memories created by plugin-telegram 1.6.4", () => {
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

	it("returns null for bot messages and non-text messages", () => {
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
