import { createUniqueUuid, type IAgentRuntime, type UUID } from "@elizaos/core";
import type { ModerationCategory, ViolationState } from "./types";

type ViolationKey = {
	platform: "telegram" | "discord";
	communityId: string;
	channelId: string;
	threadId?: string;
	userId: string;
	category: ModerationCategory;
};

export class ModerationViolationStore {
	constructor(private readonly runtime: IAgentRuntime) {}

	async getState(key: ViolationKey): Promise<ViolationState> {
		const roomId = this.getStorageRoomId(key);
		const memories = await this.runtime.getMemories({
			roomId,
			tableName: "messages",
			count: 100,
		} as any);
		const found = memories
			.filter(
				(memory: any) =>
					memory.content?.type === "COMMUNITY_VIOLATION_STATE" &&
					memory.content?.platform === key.platform &&
					memory.content?.communityId === key.communityId &&
					memory.content?.channelId === key.channelId &&
					memory.content?.threadId === key.threadId &&
					memory.content?.userId === key.userId &&
					memory.content?.category === key.category,
			)
			.sort(
				(a: any, b: any) =>
					(b.content?.state?.lastViolationAt ?? 0) -
					(a.content?.state?.lastViolationAt ?? 0),
			)[0];

		return (
			found?.content?.state ?? {
				platform: key.platform,
				communityId: key.communityId,
				channelId: key.channelId,
				threadId: key.threadId,
				userId: key.userId,
				category: key.category,
				count: 0,
				lastViolationAt: 0,
			}
		);
	}

	async recordViolation(state: ViolationState): Promise<ViolationState> {
		const next: ViolationState = {
			...state,
			count: state.count + 1,
			lastViolationAt: Date.now(),
		};
		await this.runtime.createMemory(
			{
				agentId: this.runtime.agentId,
				entityId: this.runtime.agentId,
				roomId: this.getStorageRoomId(state),
				content: {
					type: "COMMUNITY_VIOLATION_STATE",
					platform: state.platform,
					communityId: state.communityId,
					channelId: state.channelId,
					threadId: state.threadId,
					userId: state.userId,
					category: state.category,
					state: next,
				},
				createdAt: Date.now(),
			},
			"messages",
		);
		return next;
	}

	private getStorageRoomId(
		key: Pick<ViolationKey, "platform" | "communityId" | "channelId" | "threadId">,
	): UUID {
		const scope = [
			key.platform,
			key.communityId,
			key.channelId,
			key.threadId ?? "main",
		].join(":");
		return createUniqueUuid(this.runtime, `community-violations-${scope}`);
	}
}
