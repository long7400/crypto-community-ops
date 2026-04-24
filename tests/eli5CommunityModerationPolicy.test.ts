import { describe, expect, it, vi } from "vitest";
import { DEFAULT_COMMUNITY_MODERATION_SETTINGS } from "../src/communityManager/plugins/communityManager/moderation/defaults";
import { parseLlmModerationClassification } from "../src/communityManager/plugins/communityManager/moderation/llmClassifier";
import { decideModerationAction } from "../src/communityManager/plugins/communityManager/moderation/policyEngine";
import { ModerationAuditStore } from "../src/communityManager/plugins/communityManager/moderation/auditStore";
import { classifyMessageWithRules } from "../src/communityManager/plugins/communityManager/moderation/ruleClassifier";
import { mergeCommunityModerationSettings } from "../src/communityManager/plugins/communityManager/moderation/defaults";

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
	it("should flag obvious link spam when a message exceeds the link limit", () => {
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

	it("should flag repeated spam when recent history contains the same text", () => {
		const result = classifyMessageWithRules(
			baseMessage,
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			[baseMessage, { ...baseMessage, messageId: "0" }],
		);

		expect(result.category).toBe("spam");
		expect(result.signals).toContain("repeated_message");
	});

	it("should allow a normal message when no rule matches", () => {
		const result = classifyMessageWithRules(
			baseMessage,
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			[],
		);

		expect(result.category).toBe("safe");
	});

	it("should flag message flood when recent history exceeds the minute threshold", () => {
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

	it("should allow a message when mention count matches the configured maximum", () => {
		const result = classifyMessageWithRules(
			{
				...baseMessage,
				text: "@a @b @c @d @e @f",
			},
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			[],
		);

		expect(result.category).toBe("safe");
	});
});

describe("parseLlmModerationClassification", () => {
	it("parses a valid classifier response", () => {
		const result = parseLlmModerationClassification(
			'```json\n{"category":"toxic","severity":"high","confidence":0.91,"reason":"direct personal abuse","signals":["insult"]}\n```',
		);

		expect(result).toEqual({
			category: "toxic",
			severity: "high",
			confidence: 0.91,
			reason: "direct personal abuse",
			signals: ["insult"],
		});
	});

	it("fails closed to safe on malformed model output", () => {
		const result = parseLlmModerationClassification("not json");

		expect(result.category).toBe("safe");
		expect(result.confidence).toBe(0);
	});

	it("should discard non-string signals when llm output mixes valid and invalid values", () => {
		const result = parseLlmModerationClassification(
			'{"category":"fud","severity":"medium","confidence":0.77,"reason":"panic","signals":["panic",7,null]}',
		);

		expect(result.signals).toEqual(["panic"]);
	});
});

describe("decideModerationAction", () => {
	it("warns on the first enabled violation", () => {
		const decision = decideModerationAction(
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			{
				category: "toxic",
				severity: "medium",
				confidence: 0.9,
				reason: "abusive message",
				signals: ["abuse"],
			},
			{
				platform: "telegram",
				communityId: "-100123",
				channelId: "-100123",
				threadId: "123",
				userId: "777",
				category: "toxic",
				count: 0,
				lastViolationAt: 0,
			},
		);

		expect(decision).toEqual(
			expect.objectContaining({
				action: "warn",
				offenseCount: 1,
				dryRun: true,
			}),
		);
	});

	it("mutes for one hour on the second violation", () => {
		const decision = decideModerationAction(
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			{
				category: "spam",
				severity: "medium",
				confidence: 0.95,
				reason: "link spam",
				signals: ["too_many_links"],
			},
			{
				platform: "telegram",
				communityId: "-100123",
				channelId: "-100123",
				userId: "777",
				category: "spam",
				count: 1,
				lastViolationAt: Date.now(),
			},
		);

		expect(decision.action).toBe("mute");
		expect(decision.durationSeconds).toBe(3600);
		expect(decision.permanent).toBeUndefined();
	});

	it("skips disabled categories", () => {
		const settings = mergeCommunityModerationSettings({
			moderation: {
				categories: {
					fomo: { enabled: false },
				},
			},
		});

		const decision = decideModerationAction(
			settings,
			{
				category: "fomo",
				severity: "high",
				confidence: 0.99,
				reason: "pump message",
				signals: ["pump"],
			},
			{
				platform: "telegram",
				communityId: "-100123",
				channelId: "-100123",
				userId: "777",
				category: "fomo",
				count: 0,
				lastViolationAt: 0,
			},
		);

		expect(decision.action).toBe("skip");
	});

	it("should reset offense count when the previous violation is older than the reset window", () => {
		const decision = decideModerationAction(
			DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			{
				category: "spam",
				severity: "medium",
				confidence: 0.95,
				reason: "link spam",
				signals: ["too_many_links"],
			},
			{
				platform: "telegram",
				communityId: "-100123",
				channelId: "-100123",
				userId: "777",
				category: "spam",
				count: 3,
				lastViolationAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
			},
		);

		expect(decision.offenseCount).toBe(1);
		expect(decision.action).toBe("warn");
	});
});

describe("ModerationAuditStore", () => {
	it("stores audit records as messages with moderation metadata", async () => {
		const createMemory = vi.fn().mockResolvedValue(undefined);
		const runtime: any = {
			agentId: "agent-id",
			createMemory,
		};
		const store = new ModerationAuditStore(runtime);

		await store.record({
			id: "audit-1",
			platform: "telegram",
			communityId: "-100123",
			channelId: "-100123",
			threadId: "123",
			worldId: "world-1",
			userId: "777",
			messageId: "42",
			category: "spam",
			severity: "medium",
			confidence: 0.9,
			action: "warn",
			dryRun: true,
			reason: "link spam",
			createdAt: 1710000000000,
		});

		expect(createMemory).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.objectContaining({
					type: "COMMUNITY_MODERATION_AUDIT",
					action: "warn",
					category: "spam",
					threadId: "123",
				}),
				metadata: { type: "MODERATION" },
			}),
			"messages",
		);
	});
});
