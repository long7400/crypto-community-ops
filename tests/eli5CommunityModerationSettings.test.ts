import { describe, expect, it, vi } from "vitest";
import {
	DEFAULT_COMMUNITY_MODERATION_SETTINGS,
	mergeCommunityModerationSettings,
} from "../src/communityManager/plugins/communityManager/moderation/defaults";
import { isTelegramModerationAdmin } from "../src/communityManager/plugins/communityManager/moderation/adminAuth";
import { parseTelegramModerationAdminCommand } from "../src/communityManager/plugins/communityManager/moderation/adminConfig";
import { CommunityModerationSettingsRepository } from "../src/communityManager/plugins/communityManager/moderation/settingsRepository";

describe("Community moderation settings contracts", () => {
	it("uses dry-run by default and defines the requested mute ladder", () => {
		expect(DEFAULT_COMMUNITY_MODERATION_SETTINGS.version).toBe(1);
		expect(DEFAULT_COMMUNITY_MODERATION_SETTINGS.dryRun).toBe(true);
		expect(DEFAULT_COMMUNITY_MODERATION_SETTINGS.moderation.enabled).toBe(true);
		expect(DEFAULT_COMMUNITY_MODERATION_SETTINGS.platforms.telegram.enabled).toBe(
			true,
		);
		expect(DEFAULT_COMMUNITY_MODERATION_SETTINGS.platforms.discord.enabled).toBe(
			false,
		);
		expect(DEFAULT_COMMUNITY_MODERATION_SETTINGS.moderation.ladder).toEqual([
			{ offense: 1, action: "warn" },
			{ offense: 2, action: "mute", durationSeconds: 3600 },
			{ offense: 3, action: "mute", durationSeconds: 14400 },
			{ offense: 4, action: "mute", permanent: true },
		]);
	});

	it("merges partial settings without dropping defaults", () => {
		const merged = mergeCommunityModerationSettings({
			dryRun: false,
			platforms: {
				telegram: {
					greeting: { enabled: false },
					allowedChatIds: ["-100123"],
				},
			},
			moderation: {
				categories: {
					fomo: { enabled: false },
				},
			},
		});

		expect(merged.dryRun).toBe(false);
		expect(merged.platforms.telegram.greeting.enabled).toBe(false);
		expect(merged.platforms.telegram.greeting.template).toContain("Welcome");
		expect(merged.platforms.telegram.allowedChatIds).toEqual(["-100123"]);
		expect(merged.platforms.discord.enabled).toBe(false);
		expect(merged.moderation.categories.fomo.enabled).toBe(false);
		expect(merged.moderation.categories.fud.enabled).toBe(true);
	});
});

describe("CommunityModerationSettingsRepository", () => {
	it("loads defaults when a world has no moderation settings", async () => {
		const runtime: any = {
			getWorld: async () => ({ id: "world-1", metadata: { settings: {} } }),
		};
		const repo = new CommunityModerationSettingsRepository(runtime);

		const settings = await repo.getForWorld("world-1" as any);

		expect(settings.dryRun).toBe(true);
		expect(settings.moderation.ladder[1].durationSeconds).toBe(3600);
	});

	it("saves moderation settings under world metadata without replacing other settings", async () => {
		const world: any = {
			id: "world-1",
			metadata: {
				settings: {
					SHOULD_GREET_NEW_PERSONS: { value: true },
				},
			},
		};
		const runtime: any = {
			getWorld: async () => world,
			updateWorld: async (updated: any) => {
				Object.assign(world, updated);
			},
		};
		const repo = new CommunityModerationSettingsRepository(runtime);

		await repo.saveForWorld("world-1" as any, { dryRun: false });

		expect(world.metadata.settings.SHOULD_GREET_NEW_PERSONS.value).toBe(true);
		expect(world.metadata.settings.COMMUNITY_MODERATION.value.dryRun).toBe(
			false,
		);
		expect(world.metadata.settings.COMMUNITY_MODERATION.value.version).toBe(1);
	});
});

describe("parseTelegramModerationAdminCommand", () => {
	it("parses dry-run toggle commands", () => {
		expect(parseTelegramModerationAdminCommand("/eli5 dry-run off")).toEqual({
			type: "patch-settings",
			patch: { dryRun: false },
		});
		expect(parseTelegramModerationAdminCommand("/eli5 dry-run on")).toEqual({
			type: "patch-settings",
			patch: { dryRun: true },
		});
	});

	it("parses settings view commands", () => {
		expect(
			parseTelegramModerationAdminCommand("/eli5 moderation settings"),
		).toEqual({
			type: "show-settings",
		});
	});

	it("parses JSON patch commands for full settings control without a dashboard", () => {
		expect(
			parseTelegramModerationAdminCommand(
				'/eli5 moderation set-json {"moderation":{"resetAfterDays":14}}',
			),
		).toEqual({
			type: "patch-settings",
			patch: { moderation: { resetAfterDays: 14 } },
		});
	});

	it("ignores unrelated text", () => {
		expect(parseTelegramModerationAdminCommand("hello")).toEqual({
			type: "ignore",
		});
	});
});

describe("isTelegramModerationAdmin", () => {
	it("allows configured Telegram admin user IDs", async () => {
		await expect(
			isTelegramModerationAdmin(
				{ getService: vi.fn() } as any,
				{ channelId: "-100123", userId: "777" } as any,
				mergeCommunityModerationSettings({
					platforms: { telegram: { adminUserIds: ["777"] } },
				}),
			),
		).resolves.toBe(true);
	});

	it("allows Telegram chat administrators returned by getChatMember", async () => {
		const getChatMember = vi.fn().mockResolvedValue({
			status: "administrator",
			can_restrict_members: true,
		});
		const runtime: any = {
			getService: () => ({
				bot: { telegram: { getChatMember } },
			}),
		};

		await expect(
			isTelegramModerationAdmin(
				runtime,
				{ channelId: "-100123", userId: "777" } as any,
				DEFAULT_COMMUNITY_MODERATION_SETTINGS,
			),
		).resolves.toBe(true);
		expect(getChatMember).toHaveBeenCalledWith("-100123", "777");
	});
});
