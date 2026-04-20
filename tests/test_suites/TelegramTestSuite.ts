import { vi } from "vitest";

export function createTelegramWorld(settings: Record<string, unknown> = {}) {
	return {
		id: "world-1",
		metadata: {
			settings,
		},
	};
}

export function createTelegramRuntimeMock(overrides: Record<string, any> = {}) {
	const { adapter: adapterOverrides, ...runtimeOverrides } = overrides;
	const eventHandlers = new Map<string, (...args: any[]) => any>();
	const telegramSendMessage = vi.fn().mockResolvedValue(undefined);
	const telegramRestrictChatMember = vi.fn().mockResolvedValue(undefined);

	const runtime: any = {
		agentId: "agent-id",
		character: {
			name: "Eli5",
			settings: {
				secrets: {},
			},
		},
		adapter: {
			getWorld: vi.fn(),
			getEntityById: vi.fn(),
			...(adapterOverrides ?? {}),
		},
		registerEvent: vi.fn(
			(eventName: string, handler: (...args: any[]) => any) => {
				eventHandlers.set(eventName, handler);
			},
		),
		getService: vi.fn((serviceName: string) => {
			if (serviceName === "telegram") {
				return {
					messageManager: {
						sendMessage: telegramSendMessage,
					},
					bot: {
						telegram: {
							restrictChatMember: telegramRestrictChatMember,
						},
					},
				};
			}

			return undefined;
		}),
		useModel: vi.fn(),
		updateWorld: vi.fn().mockResolvedValue(undefined),
		ensureRoomExists: vi.fn().mockResolvedValue(undefined),
		createMemory: vi.fn().mockResolvedValue(undefined),
		getRoom: vi.fn(),
		...runtimeOverrides,
	};

	return {
		runtime,
		eventHandlers,
		telegramSendMessage,
		telegramRestrictChatMember,
	};
}
