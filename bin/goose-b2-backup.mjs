#!/usr/bin/env node
// Thin entry point: all logic lives in @backblaze-labs/agent-backup-core.
// Usage:
//   goose-b2-backup            run as a daemon (auto-restore + scheduled pushes)
//   goose-b2-backup --once     run a single backup and exit (for cron/CI)
//   goose-b2-backup --install  install an OS service that runs the daemon at login
import { runCli } from "@backblaze-labs/agent-backup-core";
import { gooseAdapter, loadConfig } from "../dist/index.mjs";

runCli(gooseAdapter, loadConfig).catch((err) => {
  console.error(`goose-b2-backup: ${err.message ?? err}`);
  process.exit(1);
});
