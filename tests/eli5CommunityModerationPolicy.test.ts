import { describe, expect, it } from "vitest";
import { DEFAULT_COMMUNITY_MODERATION_SETTINGS } from "../src/communityManager/plugins/communityManager/moderation/defaults";
import { classifyMessageWithRules } from "../src/communityManager/plugins/communityManager/moderation/ruleClassifier";

const baseMessage = {
	platform: "telegram" as const,
	communityId: "-100123",
	channelId: "-100123",
	channelType: "supergroup" as const,
	roomId: "room-1",
	worldId: "world-1",
	messageId: "1",
	userId: "777",
	displayName: "Ada",
	text: "hello",
	createdAt: Date.now(),
};

describe("classifyMessageWithRules", () => {
	it("flags obvious link spam", () => {
		const result = classifyMessageWithRules(
			{
				...baseMessage,
				text: "buy now https://a.example https://b.example https://c.example",
			},
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			[],
		);

		expect(result.category).toBe("spam");
		expect(result.signals).toContain("too_many_links");
	});

	it("flags repeated messages from recent user history", () => {
		const result = classifyMessageWithRules(
			baseMessage,
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			[baseMessage, { ...baseMessage, messageId: "0" }],
		);

		expect(result.category).toBe("spam");
		expect(result.signals).toContain("repeated_message");
	});

	it("allows normal messages", () => {
		const result = classifyMessageWithRules(
			baseMessage,
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			[],
		);

		expect(result.category).toBe("safe");
	});

	it("flags message floods within one minute", () => {
		const now = Date.now();
		const recentMessages = Array.from({ length: 8 }, (_, index) => ({
			...baseMessage,
			messageId: String(index),
			text: `message ${index}`,
			createdAt: now - index * 1000,
		}));

		const result = classifyMessageWithRules(
			{ ...baseMessage, createdAt: now },
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			recentMessages,
		);

		expect(result.category).toBe("spam");
		expect(result.signals).toContain("message_flood");
	});
});
