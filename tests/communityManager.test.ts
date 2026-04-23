// tests/communityManager.test.ts

import type { IAgentRuntime } from "@elizaos/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { communityManager } from "../src/communityManager/index";
import { CommunityManagerService } from "../src/communityManager/plugins/communityManager/communityService";
import { CommunityManagerTestSuite } from "./test_suites/CommunityManagerTestSuite";

describe("CommunityManagerTestSuite", () => {
	let mockScenarioService: any;
	let mockRuntime: IAgentRuntime;

	beforeEach(() => {
		mockScenarioService = {
			createWorld: vi.fn().mockResolvedValue("world-id"),
			createRoom: vi.fn().mockResolvedValue("room-id"),
			addParticipant: vi.fn().mockResolvedValue(true),
			sendMessage: vi.fn().mockResolvedValue(true),
			waitForCompletion: vi.fn().mockResolvedValue(true),
		};

		mockRuntime = {
			getService: vi.fn().mockReturnValue(mockScenarioService),
			agentId: "agent-id",
		} as unknown as IAgentRuntime;
	});

	describe("Core Functionality", () => {
		it("should resolve conflicts", async () => {
			const testSuite = new CommunityManagerTestSuite();
			const test = testSuite.tests.find(
				(t) => t.name === "Test Conflict Resolution",
			);

			await expect(test?.fn(mockRuntime)).resolves.toBeUndefined();
			expect(mockScenarioService.createWorld).toHaveBeenCalledWith(
				"Conflict Test",
				"Test Owner",
			);
			expect(mockScenarioService.createRoom).toHaveBeenCalledWith(
				"world-id",
				"general",
			);
			expect(mockScenarioService.sendMessage).toHaveBeenCalledWith(
				mockRuntime,
				"world-id",
				"room-id",
				"There's a user causing disruptions in the general channel",
			);
		});

		it("should handle new user onboarding", async () => {
			const testSuite = new CommunityManagerTestSuite();
			const test = testSuite.tests.find(
				(t) => t.name === "Test New User Onboarding",
			);

			await expect(test?.fn(mockRuntime)).resolves.toBeUndefined();
			expect(mockScenarioService.createRoom).toHaveBeenCalledWith(
				"world-id",
				"welcome",
			);
			expect(mockScenarioService.sendMessage).toHaveBeenCalledWith(
				mockRuntime,
				"world-id",
				"room-id",
				"Hi everyone, I'm new here!",
			);
		});

		it("should perform moderation actions", async () => {
			const testSuite = new CommunityManagerTestSuite();
			const test = testSuite.tests.find(
				(t) => t.name === "Test Moderation Actions",
			);

			await expect(test?.fn(mockRuntime)).resolves.toBeUndefined();
			expect(mockScenarioService.createWorld).toHaveBeenCalledWith(
				"Moderation Test",
				"Test Owner",
			);
			expect(mockScenarioService.waitForCompletion).toHaveBeenCalledWith(10000);
		});

		it("should drive community engagement", async () => {
			const testSuite = new CommunityManagerTestSuite();
			const test = testSuite.tests.find(
				(t) => t.name === "Test Community Engagement",
			);

			await expect(test?.fn(mockRuntime)).resolves.toBeUndefined();
			expect(mockScenarioService.sendMessage).toHaveBeenCalledWith(
				mockRuntime,
				"world-id",
				"room-id",
				"Let's plan the next community event",
			);
		});
	});

	describe("Error Handling", () => {
		it("should throw when missing scenario service", async () => {
			const brokenRuntime = {
				...mockRuntime,
				getService: vi.fn().mockReturnValue(undefined),
			};

			const testSuite = new CommunityManagerTestSuite();
			const test = testSuite.tests.find(
				(t) => t.name === "Test Conflict Resolution",
			);

			await expect(test?.fn(brokenRuntime)).rejects.toThrow(
				"Scenario service not found",
			);
		});

		it("should validate response timing", async () => {
			mockScenarioService.waitForCompletion.mockResolvedValue(false);

			const testSuite = new CommunityManagerTestSuite();
			const test = testSuite.tests.find(
				(t) => t.name === "Test New User Onboarding",
			);

			await expect(test?.fn(mockRuntime)).rejects.toThrow(
				"Agent did not complete onboarding in time",
			);
		});
	});

	describe("Character Compliance", () => {
		it("should not register Twitter runtime plugins when the project has no Twitter surface", () => {
			expect(communityManager.character.plugins).not.toContain(
				"@elizaos/plugin-twitter",
			);
		});

		it("should ignore off-topic messages", async () => {
			const testSuite = new CommunityManagerTestSuite();
			const test = testSuite.tests.find(
				(t) => t.name === "Test Community Engagement",
			);

			await test?.fn(mockRuntime);
			const messageContent = mockScenarioService.sendMessage.mock.calls[0][3];
			expect(messageContent).not.toContain("token price");
			expect(messageContent).not.toContain("marketing");
		});

		it("should maintain concise responses", async () => {
			const testSuite = new CommunityManagerTestSuite();
			const test = testSuite.tests.find(
				(t) => t.name === "Test Conflict Resolution",
			);

			await test?.fn(mockRuntime);
			const messageCalls = mockScenarioService.sendMessage.mock.calls;
			messageCalls.forEach((call: any[]) => {
				const message = call[3];
				expect(message.split(" ").length).toBeLessThan(20);
			});
		});
	});
});

describe("CommunityService - Telegram user join regression", () => {
	it("when TELEGRAM_ENTITY_JOINED emits telegramUser (not newMember), greeting should not throw", async () => {
		const mockRuntime = {
			adapter: {
				getWorld: vi.fn().mockResolvedValue({
					metadata: {
						settings: {
							SHOULD_GREET_NEW_PERSONS: { value: false },
						},
					},
				}),
			},
			character: { name: "TestBot" },
			getEntityById: vi.fn().mockResolvedValue(null),
			createMemory: vi.fn().mockResolvedValue(undefined),
			registerEvent: vi.fn(),
		} as unknown as IAgentRuntime;

		const service = new CommunityManagerService(mockRuntime);

		// Simulate the TELEGRAM_ENTITY_JOINED payload emitted by @elizaos/plugin-telegram
		const payload = {
			runtime: mockRuntime,
			entityId: "entity-1",
			worldId: "world-1",
			source: "telegram",
			// Plugin emits `telegramUser`, NOT `newMember`
			telegramUser: {
				id: 12345,
				username: "testuser",
				first_name: "Test",
			},
		};

		// Should not throw TypeError: undefined is not an object (evaluating 'newMember.first_name')
		await expect(
			service.onTelegramUserJoined(payload as any),
		).resolves.toBeUndefined();
	});

	it("when greeting is enabled, should use telegram.messageManager.sendMessage instead of ctx.reply (ctx is not in payload)", async () => {
		const mockSendMessage = vi.fn().mockResolvedValue(undefined);
		const mockRuntime = {
			adapter: {
				getWorld: vi.fn().mockResolvedValue({
					serverId: "-100123456789",
					metadata: {
						settings: {
							SHOULD_GREET_NEW_PERSONS: { value: true },
						},
					},
				}),
			},
			character: { name: "TestBot" },
			useModel: vi.fn().mockResolvedValue("Hey New, welcome!"),
			getService: vi.fn().mockReturnValue({
				messageManager: { sendMessage: mockSendMessage },
			}),
			ensureRoomExists: vi.fn().mockResolvedValue(undefined),
			createMemory: vi.fn().mockResolvedValue(undefined),
			agentId: "agent-1",
			registerEvent: vi.fn(),
		} as unknown as IAgentRuntime;

		const service = new CommunityManagerService(mockRuntime);

		const payload = {
			runtime: mockRuntime,
			entityId: "entity-3",
			worldId: "world-3",
			source: "telegram",
			// `ctx` is intentionally absent — mirrors real TELEGRAM_ENTITY_JOINED payload
			telegramUser: {
				id: 99999,
				username: "newuser",
				first_name: "New",
			},
		};

		// Must not throw TypeError: undefined is not an object (evaluating 'ctx.reply')
		await expect(
			service.onTelegramUserJoined(payload as any),
		).resolves.toBeUndefined();

		// Must send via telegram service, not ctx
		expect(mockSendMessage).toHaveBeenCalledOnce();
		expect(mockSendMessage).toHaveBeenCalledWith(
			"-100123456789",
			expect.objectContaining({ text: expect.stringContaining("New") }),
		);
	});

	it("when world.serverId is absent (DB round-trip drops deprecated field), chatId is resolved from rooms", async () => {
		const mockSendMessage = vi.fn().mockResolvedValue(undefined);
		const mockRuntime = {
			adapter: {
				getWorld: vi.fn().mockResolvedValue({
					// serverId and messageServerId intentionally absent (simulates DB round-trip issue)
					metadata: {
						settings: {
							SHOULD_GREET_NEW_PERSONS: { value: true },
						},
					},
				}),
			},
			character: { name: "TestBot" },
			useModel: vi.fn().mockResolvedValue("Hey Alice, welcome!"),
			getService: vi.fn().mockReturnValue({
				messageManager: { sendMessage: mockSendMessage },
			}),
			getRooms: vi.fn().mockResolvedValue([
				{ id: "room-1", source: "telegram", channelId: "-100999888777" },
			]),
			ensureRoomExists: vi.fn().mockResolvedValue(undefined),
			createMemory: vi.fn().mockResolvedValue(undefined),
			agentId: "agent-2",
			registerEvent: vi.fn(),
		} as unknown as IAgentRuntime;

		const service = new CommunityManagerService(mockRuntime);

		const payload = {
			runtime: mockRuntime,
			entityId: "entity-4",
			worldId: "world-4",
			source: "telegram",
			telegramUser: {
				id: 11111,
				username: "alice",
				first_name: "Alice",
			},
		};

		await expect(
			service.onTelegramUserJoined(payload as any),
		).resolves.toBeUndefined();

		// chatId resolved from room.channelId
		expect(mockSendMessage).toHaveBeenCalledOnce();
		expect(mockSendMessage).toHaveBeenCalledWith(
			"-100999888777",
			expect.objectContaining({ text: expect.stringContaining("Alice") }),
		);
	});

	it("when telegramUser is missing entirely, handler should warn and return gracefully", async () => {
		const mockRuntime = {
			adapter: { getWorld: vi.fn() },
			registerEvent: vi.fn(),
		} as unknown as IAgentRuntime;

		const service = new CommunityManagerService(mockRuntime);

		const payload = {
			runtime: mockRuntime,
			entityId: "entity-2",
			worldId: "world-2",
			source: "telegram",
			// No telegramUser field — should not crash
		};

		await expect(
			service.onTelegramUserJoined(payload as any),
		).resolves.toBeUndefined();
	});
});
