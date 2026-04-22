import { describe, expect, it } from "vitest";
import {
	DEFAULT_COMMUNITY_MODERATION_SETTINGS,
	mergeCommunityModerationSettings,
} from "../src/communityManager/plugins/communityManager/moderation/defaults";
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
