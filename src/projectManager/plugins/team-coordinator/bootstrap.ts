import { type IAgentRuntime, logger } from "@elizaos/core";
import { toErrorMessage } from "./logging";
import { registerTasks as defaultRegisterTasks } from "./tasks";

export async function registerTasksWithRetry(
  runtime: IAgentRuntime,
  registerTasks: (
    runtime: IAgentRuntime,
  ) => Promise<void> = defaultRegisterTasks,
  options: { retries?: number; delayMs?: number } = {},
): Promise<void> {
  const retries = options.retries ?? 10;
  const delayMs = options.delayMs ?? 1000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (runtime.getTasks && typeof runtime.getTasks === "function") {
        await registerTasks(runtime);
        return;
      }
    } catch (error) {
      logger.warn(
        `Failed to register team coordinator tasks (attempt ${attempt}/${retries}): ${toErrorMessage(error)}`,
      );
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  logger.error("Failed to register team coordinator tasks after all retries");
}

export async function bootstrapTeamCoordinator(
  runtime: IAgentRuntime,
  options: {
    registerTasks?: (runtime: IAgentRuntime) => Promise<void>;
    retries?: number;
    delayMs?: number;
  },
): Promise<void> {
  void registerTasksWithRetry(runtime, options.registerTasks, {
    retries: options.retries,
    delayMs: options.delayMs,
  }).catch((error) => {
    logger.error(
      `Error while bootstrapping team coordinator tasks: ${toErrorMessage(error)}`,
    );
  });
}
