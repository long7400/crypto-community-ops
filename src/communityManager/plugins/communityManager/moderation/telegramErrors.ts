import { logger } from "@elizaos/core";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callTelegramApi<T>(
	operation: () => Promise<T>,
	context: string,
): Promise<T> {
	try {
		return await operation();
	} catch (error: any) {
		const errorCode = error?.response?.error_code;
		if (errorCode === 429) {
			const retryAfter = error.response?.parameters?.retry_after ?? 60;
			logger.warn(
				`Telegram ${context} rate limited; retrying after ${retryAfter}s`,
			);
			await sleep(retryAfter * 1000);
			return operation();
		}

		if (errorCode === 400) {
			logger.error(
				`Telegram ${context} bad request: ${error.response?.description}`,
			);
			throw error;
		}

		logger.error(`Telegram ${context} failed`, error);
		throw error;
	}
}
