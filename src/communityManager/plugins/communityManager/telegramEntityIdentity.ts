import type { Entity, IAgentRuntime, UUID } from "@elizaos/core";

const telegramEntityMetadataBridgeInstalled = Symbol.for(
  "the-org.telegramEntityMetadataBridgeInstalled",
);

export function installTelegramEntityMetadataBridge(
  runtime: IAgentRuntime,
): void {
  const runtimeWithBridge = runtime as IAgentRuntime & {
    [telegramEntityMetadataBridgeInstalled]?: boolean;
  };

  if (runtimeWithBridge[telegramEntityMetadataBridgeInstalled]) {
    return;
  }

  const ensureConnection = (runtimeWithBridge as any).ensureConnection?.bind(
    runtime,
  );
  if (typeof ensureConnection !== "function") {
    return;
  }

  (runtimeWithBridge as any).ensureConnection = async (params: any) => {
    const result = await ensureConnection(params);
    if (params?.source === "telegram" && params?.entityId) {
      await ensureTelegramEntityBootstrapIdentity(runtime, params.entityId);
    }

    return result;
  };
  runtimeWithBridge[telegramEntityMetadataBridgeInstalled] = true;
}

async function ensureTelegramEntityBootstrapIdentity(
  runtime: IAgentRuntime,
  entityId: UUID,
): Promise<void> {
  if (
    typeof runtime.getEntityById !== "function" ||
    typeof runtime.updateEntity !== "function"
  ) {
    return;
  }

  const entity = await runtime.getEntityById(entityId);
  const normalized = normalizeTelegramEntityMetadata(entity);
  if (normalized !== entity) {
    await runtime.updateEntity(normalized);
  }
}

function normalizeTelegramEntityMetadata<T extends Entity | null | undefined>(
  entity: T,
): T {
  const metadata = entity?.metadata as Record<string, any> | undefined;
  const telegram = metadata?.telegram as Record<string, any> | undefined;
  if (!entity || !metadata || !telegram) {
    return entity;
  }

  const name = metadata.name ?? telegram.name;
  const username = metadata.username ?? telegram.username ?? telegram.userName;
  const names = [
    ...((entity.names ?? []) as string[]),
    ...[name, username].filter(Boolean),
  ];

  if (
    metadata.name === name &&
    metadata.username === username &&
    names.length === (entity.names ?? []).length
  ) {
    return entity;
  }

  return {
    ...entity,
    names: [...new Set(names)],
    metadata: {
      ...metadata,
      name,
      username,
    },
  };
}
