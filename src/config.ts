import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StandaloneConfig } from "@backblaze-labs/agent-backup-core";

/** Optional JSON config file, overridden by environment variables. */
const CONFIG_PATH = path.join(os.homedir(), ".config", "goose-b2-backup", "config.json");

/**
 * Load backup config from an optional JSON file, then overlay environment
 * variables (env wins). Throws with a clear message if required B2 fields are
 * missing, so the daemon fails fast rather than at first upload.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): StandaloneConfig {
  const fromFile = readConfigFile();
  const merged: Partial<StandaloneConfig> = {
    ...fromFile,
    ...stripUndefined({
      keyId: env.B2_KEY_ID,
      applicationKey: env.B2_APPLICATION_KEY,
      bucket: env.B2_BUCKET,
      region: env.B2_REGION,
      prefix: env.B2_PREFIX,
      encryptionKey: env.B2_ENCRYPTION_KEY,
      schedule: env.B2_SCHEDULE,
      encrypt: env.B2_ENCRYPT ? env.B2_ENCRYPT !== "false" : undefined,
      keepSnapshots: env.B2_KEEP_SNAPSHOTS ? Number(env.B2_KEEP_SNAPSHOTS) : undefined,
    }),
  };

  const missing = (["keyId", "applicationKey", "bucket"] as const).filter((k) => !merged[k]);
  if (missing.length > 0) {
    throw new Error(
      `missing required config: ${missing.join(", ")}. ` +
        `Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET (and ideally B2_ENCRYPTION_KEY) ` +
        `in the environment or ${CONFIG_PATH}.`,
    );
  }
  return merged as StandaloneConfig;
}

function readConfigFile(): Partial<StandaloneConfig> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as Partial<StandaloneConfig>;
  } catch {
    return {};
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
