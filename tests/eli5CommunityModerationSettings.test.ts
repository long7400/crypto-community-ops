import { describe, expect, it } from "vitest";
import {
	DEFAULT_COMMUNITY_MODERATION_SETTINGS,
	mergeCommunityModerationSettings,
} from "../src/communityManager/plugins/communityManager/moderation/defaults";

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
