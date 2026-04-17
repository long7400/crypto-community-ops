import {
  type IAgentRuntime,
  logger,
  type Service,
  type ServiceTypeName,
  type UUID,
} from "@elizaos/core";
import { toErrorMessage } from "./logging";
import { TeamUpdateTrackerService } from "./services/updateTracker";

export const registerTasks = async (
  runtime: IAgentRuntime,
  initialWorldId?: UUID,
) => {
  // Ensure worldId is set to the agent's ID if not provided
  const worldId = initialWorldId || (runtime.agentId as UUID);
  const trackerServiceType =
    TeamUpdateTrackerService.serviceType as ServiceTypeName;

  // Wait for the runtime-managed service instance instead of creating a fallback
  let teamUpdateService: TeamUpdateTrackerService | null = null;
  try {
    teamUpdateService = runtime.getService(
      trackerServiceType,
    ) as TeamUpdateTrackerService | null;

    if (teamUpdateService) {
      logger.info("Using existing TeamUpdateTrackerService");
    } else {
      logger.info(
        "Waiting for runtime-managed TeamUpdateTrackerService registration",
      );
      teamUpdateService = (await runtime.getServiceLoadPromise(
        trackerServiceType,
      )) as TeamUpdateTrackerService;
    }
  } catch (error) {
    logger.error(
      `Error resolving TeamUpdateTrackerService for task registration: ${toErrorMessage(error)}`,
    );
    throw error;
  }

  // Clear existing tasks
  const tasks = await runtime.getTasks({
    tags: ["queue", "repeat", "team_coordinator"],
  });

  for (const task of tasks) {
    if (task.id) {
      await runtime.deleteTask(task.id);
    }
  }

  // Register the check-in service task worker
  runtime.registerTaskWorker({
    name: "TEAM_CHECK_IN_SERVICE",
    validate: async (_runtime, _message, _state) => {
      return true;
    },
    execute: async (runtime, _options, task) => {
      try {
        logger.info("Running team check-in service job");
        await teamUpdateService.checkInServiceJob();
      } catch (error) {
        logger.error(
          `Failed to run check-in service job: ${toErrorMessage(error)}`,
        );
      }
    },
  });

  // Create the periodic task
  runtime.createTask({
    name: "TEAM_CHECK_IN_SERVICE",
    description: "Regular team check-in service job",
    worldId: worldId, // Explicitly pass worldId
    metadata: {
      updatedAt: Date.now(),
      updateInterval: 1000 * 60, // 1 minute
    },
    tags: ["queue", "repeat", "team_coordinator"],
  });
};
