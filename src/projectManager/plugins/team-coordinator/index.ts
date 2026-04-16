// biome-ignore lint/style/useImportType: <explanation>
import type { IAgentRuntime, Plugin } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { recordCheckInAction } from "./actions/checkInCreate";
import { listCheckInSchedules } from "./actions/checkInList";
import { generateReport } from "./actions/reportGenerate";
import { addTeamMemberAction } from "./actions/teamMemberAdd";
import { listTeamMembersAction } from "./actions/teamMembersList";
import { teamMemberUpdatesAction } from "./actions/teamMemberUpdate";
import { updatesFormatAction } from "./actions/updateFormat";
// import { checkInFormatAction } from './actions/checkInFormatAction';
import { CheckInService } from "./services/CheckInService";
import { TeamUpdateTrackerService } from "./services/updateTracker";
import { registerTasks } from "./tasks";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Plugin for team coordination functionality
 * Handles team member management, availability tracking, and check-ins
 */
export const teamCoordinatorPlugin: Plugin = {
  name: "team-coordinator",
  description: "Team Coordinator plugin for managing team activities",
  providers: [],
  actions: [
    // checkInFormatAction,
    teamMemberUpdatesAction,
    listCheckInSchedules,
    generateReport,
    recordCheckInAction,
    addTeamMemberAction,
    listTeamMembersAction,
    updatesFormatAction,
  ],
  init: async (config: Record<string, string>, runtime: IAgentRuntime) => {
    try {
      logger.info("Initializing Team Coordinator plugin...");

      // Register the services
      logger.info("Registering TeamUpdateTrackerService...");
      await runtime.registerService(TeamUpdateTrackerService);

      // Register and start the CheckIn service
      // logger.info('Registering CheckInService...');
      // await runtime.registerService(CheckInService);

      // Delay task registration to ensure adapter is ready
      logger.info("Scheduling team coordinator tasks registration...");

      // Use a retry mechanism to register tasks when adapter is ready
      const registerTasksWithRetry = async (retries = 10, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          try {
            // Check if getTasks method is available
            if (runtime.getTasks && typeof runtime.getTasks === "function") {
              logger.info(
                "Runtime is ready, registering team coordinator tasks...",
              );
              await registerTasks(runtime);
              logger.info("Team coordinator tasks registered successfully");
              return;
            } else {
              logger.info(
                `Runtime not ready yet, retrying in ${delay}ms... (attempt ${i + 1}/${retries})`,
              );
            }
          } catch (error) {
            logger.warn(
              `Failed to register tasks (attempt ${i + 1}/${retries}): ${toErrorMessage(error)}`,
            );
          }

          // Wait before next retry
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        logger.error(
          "Failed to register team coordinator tasks after all retries",
        );
      };

      // Start the retry process asynchronously
      registerTasksWithRetry().catch((error) => {
        logger.error(
          `Error in registerTasksWithRetry: ${toErrorMessage(error)}`,
        );
      });

      logger.info("Team Coordinator plugin initialized successfully");
    } catch (error) {
      logger.error(
        `Failed to initialize Team Coordinator plugin: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  },
  // List services that should be registered by the runtime
  services: [TeamUpdateTrackerService, CheckInService],
};

export function initialize(runtime: IAgentRuntime) {
  // Initialize services
  new CheckInService(runtime);
  // new ScheduleService(runtime);

  // Return actions
  return {
    actions: [
      // checkInFormatAction,
      recordCheckInAction,
      teamMemberUpdatesAction,
      listCheckInSchedules,
      generateReport,
      addTeamMemberAction,
      listTeamMembersAction,
      updatesFormatAction,
    ],
  };
}

export default {
  initialize,
};
