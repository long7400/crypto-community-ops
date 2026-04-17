import { createUniqueUuid, type IAgentRuntime, logger } from "@elizaos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapTeamCoordinator, registerTasksWithRetry } from "./bootstrap";
import { stringifyForLog, toErrorMessage } from "./logging";
import {
  getDiscordClient,
  getTelegramBot,
  requireDiscordClient,
} from "./platform";
import { CheckInService } from "./services/CheckInService";
import { TeamUpdateTrackerService } from "./services/updateTracker";
import {
  filterCheckInScheduleMemories,
  findReportChannelConfigForServer,
  getCheckInSchedulesRoomId,
  getReportChannelConfigRoomId,
  getTeamMembersConfigMemory,
  getTeamMembersRoomId,
} from "./storage";
import { registerTasks } from "./tasks";

describe("team coordinator bootstrap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries task registration until runtime is ready", async () => {
    const registerService = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      registerService,
      getTasks: undefined,
    } as unknown as IAgentRuntime;

    const register = vi
      .fn<(...args: any[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const promise = registerTasksWithRetry(runtime, register, {
      retries: 3,
      delayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    (runtime as IAgentRuntime & { getTasks: any }).getTasks = vi
      .fn()
      .mockResolvedValue([]);
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(register).toHaveBeenCalledTimes(1);
  });

  it("logs targeted readiness diagnostics when runtime.getTasks is unavailable", async () => {
    const debugSpy = vi
      .spyOn(logger, "debug")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: undefined,
    } as unknown as IAgentRuntime;
    const register = vi.fn().mockResolvedValue(undefined);

    const promise = registerTasksWithRetry(runtime, register, {
      retries: 2,
      delayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(register).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      "runtime.getTasks not yet available (attempt 1/2), will retry",
    );
    expect(debugSpy).toHaveBeenCalledWith(
      "runtime.getTasks not yet available (attempt 2/2), will retry",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "runtime.getTasks never became available; team coordinator tasks were not registered",
    );
  });

  it("keeps terminal registration failure logging when task registration throws after readiness", async () => {
    const warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: vi.fn().mockResolvedValue([]),
    } as unknown as IAgentRuntime;
    const register = vi.fn().mockRejectedValue(new Error("boom"));

    const promise = registerTasksWithRetry(runtime, register, {
      retries: 2,
      delayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(register).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to register team coordinator tasks (attempt 1/2): boom",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to register team coordinator tasks (attempt 2/2): boom",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to register team coordinator tasks after all retries",
    );
  });

  it("starts deferred task registration from bootstrap without re-registering services", async () => {
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: vi.fn().mockResolvedValue([]),
    } as unknown as IAgentRuntime;

    const register = vi.fn().mockResolvedValue(undefined);

    await bootstrapTeamCoordinator(runtime, {
      registerTasks: register,
      retries: 1,
      delayMs: 1,
    });

    expect(runtime.registerService).not.toHaveBeenCalled();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("starts bounded retry-based task registration from bootstrap", async () => {
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: undefined,
    } as unknown as IAgentRuntime;

    const register = vi.fn().mockResolvedValue(undefined);

    await bootstrapTeamCoordinator(runtime, {
      registerTasks: register,
      retries: 3,
      delayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    (runtime as IAgentRuntime & { getTasks: unknown }).getTasks = vi
      .fn()
      .mockResolvedValue([]);
    await vi.advanceTimersByTimeAsync(100);

    expect(register).toHaveBeenCalledTimes(1);
    expect(runtime.registerService).not.toHaveBeenCalled();
  });

  it("waits for the runtime-managed tracker service before wiring task execution", async () => {
    const fallbackCheckInJob = vi
      .spyOn(TeamUpdateTrackerService.prototype, "checkInServiceJob")
      .mockResolvedValue(undefined);
    const managedCheckInJob = vi.fn().mockResolvedValue(undefined);
    const managedService = {
      checkInServiceJob: managedCheckInJob,
    } as unknown as TeamUpdateTrackerService;
    const registerTaskWorker = vi.fn();
    const runtime = {
      agentId: "agent-id",
      getService: vi.fn().mockReturnValue(null),
      getServiceLoadPromise: vi.fn().mockResolvedValue(managedService),
      getTasks: vi.fn().mockResolvedValue([]),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      registerTaskWorker,
      createTask: vi.fn().mockResolvedValue(undefined),
    } as unknown as IAgentRuntime;

    await registerTasks(runtime);

    const taskWorker = registerTaskWorker.mock.calls[0]?.[0] as {
      execute: (
        runtime: IAgentRuntime,
        options: unknown,
        task: unknown,
      ) => Promise<void>;
    };
    await taskWorker.execute(runtime, {}, {});

    expect(runtime.getServiceLoadPromise).toHaveBeenCalledWith(
      TeamUpdateTrackerService.serviceType,
    );
    expect(managedCheckInJob).toHaveBeenCalledTimes(1);
    expect(fallbackCheckInJob).not.toHaveBeenCalled();
  });

  it("fails task registration when the tracker service load times out", async () => {
    const runtime = {
      agentId: "agent-id",
      getService: vi.fn().mockReturnValue(null),
      getServiceLoadPromise: vi.fn(() => new Promise(() => undefined)),
      getTasks: vi.fn().mockResolvedValue([]),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      registerTaskWorker: vi.fn(),
      createTask: vi.fn().mockResolvedValue(undefined),
    } as unknown as IAgentRuntime;

    const registerPromise = registerTasks(runtime);
    const rejection = expect(registerPromise).rejects.toThrow(
      "TeamUpdateTrackerService load timed out after 5000ms",
    );

    await vi.advanceTimersByTimeAsync(5000);

    await rejection;
    expect(runtime.getTasks).not.toHaveBeenCalled();
    expect(runtime.registerTaskWorker).not.toHaveBeenCalled();
  });
});

describe("team coordinator platform readiness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a validated discord client without exploratory probes", async () => {
    const fetchSpy = vi.fn();
    const runtime = {
      getService: vi
        .fn()
        .mockReturnValue({ client: { users: { fetch: fetchSpy } } }),
    } as unknown as IAgentRuntime;

    const result = await getDiscordClient(runtime);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected discord client");
    expect(result.client).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a consistent failure when telegram bot is unavailable", async () => {
    const runtime = {
      getService: vi.fn().mockReturnValue(undefined),
    } as unknown as IAgentRuntime;

    const result = await getTelegramBot(runtime);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected telegram failure");
    expect(result.error).toContain("Telegram");
  });

  it("throws the shared Discord availability error through the platform requirement helper", async () => {
    const runtime = {
      getService: vi.fn().mockReturnValue(undefined),
    } as unknown as IAgentRuntime;

    await expect(requireDiscordClient(runtime)).rejects.toThrow(
      "Discord service not found",
    );
  });
});

describe("team coordinator logging helpers", () => {
  it("preserves error messages and stringifies circular values safely", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(toErrorMessage(new Error("boom"))).toBe("boom");
    expect(toErrorMessage({ reason: "fallback" })).toBe("[object Object]");
    expect(stringifyForLog("plain-text")).toBe("plain-text");
    expect(stringifyForLog(circular)).toBe("[object Object]");
  });
});

describe("team coordinator shared storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses shared room identity for team members", () => {
    const runtime = { agentId: "agent-id" } as unknown as IAgentRuntime;

    expect(getTeamMembersRoomId(runtime, "server-123")).toBe(
      createUniqueUuid(runtime, "store-team-members-server123"),
    );
    expect(getReportChannelConfigRoomId(runtime)).toBe(
      createUniqueUuid(runtime, "report-channel-config"),
    );
    expect(getCheckInSchedulesRoomId(runtime)).toBe(
      createUniqueUuid(runtime, "check-in-schedules"),
    );
  });

  it("keeps existing team member config shapes readable", async () => {
    const runtime = {
      getMemories: vi.fn().mockResolvedValue([
        {
          id: "memory-1",
          content: {
            type: "store-team-members-memory",
            config: {
              serverId: "server-123",
              teamMembers: [
                {
                  section: "DevRel",
                  discordName: "@alice",
                  updatesFormat: ["Q1"],
                },
              ],
            },
          },
        },
      ]),
    } as unknown as IAgentRuntime;

    const memory = await getTeamMembersConfigMemory(runtime, "server-123");

    expect(memory).toBeDefined();
    if (!memory?.content) throw new Error("expected team member content");

    expect(memory.content.config).toEqual({
      serverId: "server-123",
      teamMembers: [
        { section: "DevRel", discordName: "@alice", updatesFormat: ["Q1"] },
      ],
    });
  });

  it("filters report channel configs and schedules by expected record type", () => {
    const reportConfig = findReportChannelConfigForServer(
      [
        { content: { type: "other" } },
        {
          content: {
            type: "report-channel-config",
            config: { serverId: "server-123", channelId: "channel-1" },
          },
        },
      ] as any,
      "server-123",
    );

    const schedules = filterCheckInScheduleMemories([
      { content: { type: "other" } },
      {
        content: {
          type: "team-member-checkin-schedule",
          schedule: { scheduleId: "schedule-1", serverId: "server-123" },
        },
      },
    ] as any);

    expect(reportConfig).toBeDefined();
    if (!reportConfig?.content) throw new Error("expected report config");
    expect(reportConfig.content.config).toEqual({
      serverId: "server-123",
      channelId: "channel-1",
    });
    expect(schedules).toHaveLength(1);
    if (!schedules[0]?.content) throw new Error("expected schedule content");
    expect(schedules[0].content.schedule).toEqual({
      scheduleId: "schedule-1",
      serverId: "server-123",
    });
  });

  it("keeps existing report channel configs readable when serverId is missing", () => {
    const reportConfig = findReportChannelConfigForServer(
      [
        { content: { type: "other" } },
        {
          content: {
            type: "report-channel-config",
            config: { channelId: "legacy-channel" },
          },
        },
      ] as any,
      "server-123",
    );

    expect(reportConfig).toBeDefined();
    if (!reportConfig?.content) throw new Error("expected report config");
    expect(reportConfig.content.config).toEqual({
      channelId: "legacy-channel",
    });
  });
});

describe("team coordinator interaction responses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to a runtime memory response when reply methods are unavailable", async () => {
    const createMemory = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      agentId: "agent-id",
      createMemory,
    } as unknown as IAgentRuntime;

    const service = new CheckInService(runtime);

    await (service as any).respondToInteraction(
      { customId: "submit_checkin_schedule", roomId: "room-123" },
      "Ack",
      true,
    );

    expect(createMemory).toHaveBeenCalledTimes(1);
    expect(createMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-123",
        content: expect.objectContaining({
          type: "discord-response",
          text: "Ack",
          ephemeral: true,
          source: "team-coordinator",
        }),
      }),
      "messages",
    );
  });
});
