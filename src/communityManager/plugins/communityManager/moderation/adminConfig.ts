import type { PartialCommunityModerationSettings } from "./types";

export type TelegramModerationAdminCommand =
	| { type: "ignore" }
	| { type: "show-settings" }
	| { type: "patch-settings"; patch: PartialCommunityModerationSettings };

export function parseTelegramModerationAdminCommand(
	text: string,
): TelegramModerationAdminCommand {
	const normalized = text.trim().toLowerCase();
	const raw = text.trim();

	if (normalized === "/eli5 moderation settings") {
		return { type: "show-settings" };
	}

	if (normalized === "/eli5 dry-run off") {
		return { type: "patch-settings", patch: { dryRun: false } };
	}

	if (normalized === "/eli5 dry-run on") {
		return { type: "patch-settings", patch: { dryRun: true } };
	}

	if (normalized === "/eli5 moderation off") {
		return {
			type: "patch-settings",
			patch: { moderation: { enabled: false } },
		};
	}

	if (normalized === "/eli5 moderation on") {
		return {
			type: "patch-settings",
			patch: { moderation: { enabled: true } },
		};
	}

	const setJsonPrefix = "/eli5 moderation set-json ";
	if (raw.toLowerCase().startsWith(setJsonPrefix)) {
		const json = raw.slice(setJsonPrefix.length);
		try {
			return {
				type: "patch-settings",
				patch: JSON.parse(json) as PartialCommunityModerationSettings,
			};
		} catch {
			return { type: "ignore" };
		}
	}

	return { type: "ignore" };
}

export function formatCommunityModerationSettingsSummary(settings: {
	dryRun: boolean;
	moderation: { enabled: boolean };
	platforms: { telegram: { greeting: { enabled: boolean } } };
}): string {
	return [
		"Eli5 Telegram moderation settings:",
		`Dry-run: ${settings.dryRun ? "on" : "off"}`,
		`Moderation: ${settings.moderation.enabled ? "on" : "off"}`,
		`Greeting: ${settings.platforms.telegram.greeting.enabled ? "on" : "off"}`,
	].join("\n");
}
