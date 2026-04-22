import { createUniqueUuid, type IAgentRuntime, type UUID } from "@elizaos/core";
import type { ModerationAuditRecord } from "./types";

export class ModerationAuditStore {
  constructor(private readonly runtime: IAgentRuntime) {}

  async record(record: ModerationAuditRecord): Promise<void> {
    await this.runtime.createMemory(
      {
        id: createUniqueUuid(this.runtime, record.id),
        agentId: this.runtime.agentId,
        entityId: this.runtime.agentId,
        roomId: this.getAuditRoomId(record),
        content: {
          type: "COMMUNITY_MODERATION_AUDIT",
          ...record,
        },
        metadata: { type: "MODERATION" },
        createdAt: record.createdAt,
      },
      "messages",
    );
  }

  private getAuditRoomId(
    record: Pick<
      ModerationAuditRecord,
      "platform" | "communityId" | "channelId" | "threadId"
    >,
  ): UUID {
    const scope = [
      record.platform,
      record.communityId,
      record.channelId,
      record.threadId ?? "main",
    ].join(":");
    return createUniqueUuid(
      this.runtime,
      `community-moderation-audit-${scope}`,
    );
  }
}
