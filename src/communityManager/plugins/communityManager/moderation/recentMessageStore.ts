import { createUniqueUuid, type IAgentRuntime, type UUID } from "@elizaos/core";
import type { ModerationMessage } from "./types";

export class RecentMessageStore {
	constructor(private readonly runtime: IAgentRuntime) {}

	async getRecentMessages(message: ModerationMessage): Promise<ModerationMessage[]> {
		const memories = await this.runtime.getMemories({
			roomId: this.getRoomId(message),
			tableName: "messages",
			count: 100,
		} as any);
		return memories
			.filter((memory: any) => memory.content?.type === "COMMUNITY_RECENT_MESSAGE")
			.map((memory: any) => memory.content.message as ModerationMessage)
			.filter((recent) => Date.now() - recent.createdAt < 60_000);
	}

	async record(message: ModerationMessage): Promise<void> {
		await this.runtime.createMemory(
			{
				agentId: this.runtime.agentId,
				entityId: this.runtime.agentId,
				roomId: this.getRoomId(message),
				content: { type: "COMMUNITY_RECENT_MESSAGE", message },
				createdAt: message.createdAt,
			},
			"messages",
		);
	}

	private getRoomId(message: ModerationMessage): UUID {
		const scope = [
			message.platform,
			message.communityId,
			message.channelId,
			message.threadId ?? "main",
		].join(":");
		return createUniqueUuid(this.runtime, `community-recent-${scope}`);
	}
}
