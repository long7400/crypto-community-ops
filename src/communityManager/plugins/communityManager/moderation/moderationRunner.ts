import {
  createUniqueUuid,
  type IAgentRuntime,
  type Memory,
} from "@elizaos/core";
import {
  formatCommunityModerationSettingsSummary,
  parseTelegramModerationAdminCommand,
} from "./adminConfig";
import { isTelegramModerationAdmin } from "./adminAuth";
import { ModerationAuditStore } from "./auditStore";
import type { ModerationEnforcementPort } from "./enforcementPort";
import { classifyMessageWithLlm } from "./llmClassifier";
import { normalizeTelegramMemoryPayload } from "./normalizer";
import { decideModerationAction } from "./policyEngine";
import { RecentMessageStore } from "./recentMessageStore";
import { classifyMessageWithRules } from "./ruleClassifier";
import { CommunityModerationSettingsRepository } from "./settingsRepository";
import { TelegramModerationAdapter } from "./telegramAdapter";
import type { ModerationPlatform } from "./types";
import { ModerationViolationStore } from "./violationStore";

export class ModerationRunner {
  constructor(private readonly runtime: IAgentRuntime) {}

  async handleMemory(memory: Memory): Promise<void> {
    const message = normalizeTelegramMemoryPayload(memory, {
      room: await this.getTelegramRoom(memory),
      telegramUserId: await this.getTelegramUserId(memory),
    });
    if (!message || message.channelType === "private" || !message.text.trim()) {
      return;
    }

    const settingsRepository = new CommunityModerationSettingsRepository(
      this.runtime,
    );
    const settings = await settingsRepository.getForWorld(
      message.worldId as any,
    );
    if (!this.isChannelAllowedByRuntime(message.channelId)) {
      return;
    }
    if (
      settings.platforms.telegram.allowedChatIds.length > 0 &&
      !settings.platforms.telegram.allowedChatIds.includes(message.channelId)
    ) {
      return;
    }

    const adapter = this.getEnforcementAdapter(message.platform);
    const adminCommand = parseTelegramModerationAdminCommand(message.text);
    if (adminCommand.type !== "ignore") {
      const allowed = await isTelegramModerationAdmin(
        this.runtime,
        message,
        settings,
      );
      if (!allowed) {
        await adapter.warn(
          message.channelId,
          "Only Telegram group admins can change Eli5 moderation settings.",
        );
        return;
      }
      const next =
        adminCommand.type === "patch-settings"
          ? await settingsRepository.saveForWorld(
              message.worldId as any,
              adminCommand.patch,
            )
          : settings;
      await adapter.warn(
        message.channelId,
        formatCommunityModerationSettingsSummary(next),
      );
      return;
    }

    if (settings.platforms.telegram.exemptUserIds.includes(message.userId)) {
      return;
    }

    const recentStore = new RecentMessageStore(this.runtime);
    const recentMessages = await recentStore.getRecentMessages(message);
    await recentStore.record(message);

    const deterministic = classifyMessageWithRules(
      message,
      settings,
      recentMessages,
    );
    const classification =
      deterministic.category === "safe"
        ? await classifyMessageWithLlm(this.runtime, message)
        : deterministic;

    const violationStore = new ModerationViolationStore(this.runtime);
    const state = await violationStore.getState({
      platform: message.platform,
      communityId: message.communityId,
      channelId: message.channelId,
      threadId: message.threadId,
      userId: message.userId,
      category:
        classification.category === "safe" ? "spam" : classification.category,
    });
    const decision = decideModerationAction(settings, classification, state);

    if (
      !decision.dryRun &&
      (decision.action === "warn" || decision.action === "mute")
    ) {
      await violationStore.recordViolation(state);
    }
    if (!decision.dryRun && decision.action === "warn") {
      await adapter.warn(
        message.channelId,
        settings.moderation.warningTemplate
          .replace("{displayName}", message.displayName)
          .replace("{offenseCount}", String(decision.offenseCount)),
      );
    }
    if (!decision.dryRun && decision.action === "mute") {
      await adapter.mute(message.channelId, message.userId, {
        durationSeconds: decision.durationSeconds,
        permanent: decision.permanent,
      });
    }

    await new ModerationAuditStore(this.runtime).record({
      id: createUniqueUuid(
        this.runtime,
        `${message.platform}-${message.communityId}-${message.channelId}-${message.messageId}-${Date.now()}`,
      ),
      platform: message.platform,
      communityId: message.communityId,
      channelId: message.channelId,
      threadId: message.threadId,
      userId: message.userId,
      messageId: message.messageId,
      category: decision.category,
      severity: decision.severity,
      confidence: decision.confidence,
      action: decision.action,
      durationSeconds: decision.durationSeconds,
      permanent: decision.permanent,
      dryRun: decision.dryRun,
      reason: decision.reason,
      createdAt: Date.now(),
    });
  }

  private isChannelAllowedByRuntime(channelId: string): boolean {
    const raw = this.runtime.getSetting?.("TELEGRAM_ALLOWED_CHATS");
    if (!raw) {
      return true;
    }
    try {
      const allowed = Array.isArray(raw) ? raw : JSON.parse(String(raw));
      return allowed.map(String).includes(channelId);
    } catch {
      return false;
    }
  }

  private getEnforcementAdapter(
    platform: ModerationPlatform,
  ): ModerationEnforcementPort {
    if (platform === "telegram") {
      return new TelegramModerationAdapter(this.runtime);
    }
    throw new Error(`Unsupported moderation platform: ${platform}`);
  }

  private async getTelegramRoom(memory: Memory): Promise<any | undefined> {
    if (!memory.roomId || typeof this.runtime.getRoom !== "function") {
      return undefined;
    }

    return await this.runtime.getRoom(memory.roomId as any);
  }

  private async getTelegramUserId(memory: Memory): Promise<string | undefined> {
    const entityId = (memory as any).entityId;
    if (!entityId || typeof this.runtime.getEntityById !== "function") {
      return undefined;
    }

    const entity = await this.runtime.getEntityById(entityId as any);
    const telegramId = (entity as any)?.metadata?.telegram?.id;
    return telegramId == null ? undefined : String(telegramId);
  }
}
