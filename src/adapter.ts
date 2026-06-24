import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BackupAdapter, BackupRoot } from "@backblaze-labs/agent-backup-core";

/**
 * Goose (block/goose) splits its state across three XDG roots on Unix/macOS:
 *   - config: $XDG_CONFIG_HOME or ~/.config      → goose/  (config.yaml, memory, recipes, secrets)
 *   - data:   $XDG_DATA_HOME   or ~/.local/share → goose/  (sessions/sessions.db, projects.json, models)
 *   - state:  $XDG_STATE_HOME  or ~/.local/state → goose/  (logs, history.txt)
 * macOS uses the SAME XDG paths (Goose's etcetera `choose_app_strategy` selects
 * XDG on both Linux and macOS — NOT ~/Library). `GOOSE_PATH_ROOT` overrides all
 * three at once. On Windows, config/data live under %APPDATA%\Block\goose\ and
 * state falls back to data.
 * Verified against github.com/block/goose (config/paths.rs, config/base.rs,
 * session/session_manager.rs) and the official docs.
 */
export function gooseCandidateRoots(env: NodeJS.ProcessEnv): BackupRoot[] {
  // Test/override hook: one root dir holds config/, data/, state/ subdirs.
  if (env.GOOSE_PATH_ROOT) {
    const r = env.GOOSE_PATH_ROOT;
    return [
      { label: "config", dir: path.join(r, "config") },
      { label: "data", dir: path.join(r, "data") },
      { label: "state", dir: path.join(r, "state") },
    ];
  }

  if (process.platform === "win32") {
    const appData = env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    const blockGoose = path.join(appData, "Block", "goose");
    return [
      { label: "config", dir: path.join(blockGoose, "config") },
      { label: "data", dir: path.join(blockGoose, "data") },
      // No dedicated state dir on Windows — Goose falls back to data/ for logs.
      { label: "state", dir: path.join(blockGoose, "data") },
    ];
  }

  const home = os.homedir();
  const configHome = env.XDG_CONFIG_HOME || path.join(home, ".config");
  const dataHome = env.XDG_DATA_HOME || path.join(home, ".local", "share");
  const stateHome = env.XDG_STATE_HOME || path.join(home, ".local", "state");
  return [
    { label: "config", dir: path.join(configHome, "goose") },
    { label: "data", dir: path.join(dataHome, "goose") },
    { label: "state", dir: path.join(stateHome, "goose") },
  ];
}

export const gooseAdapter: BackupAdapter = {
  id: "goose",

  resolveRoots(env) {
    // Keep every existing root, even when two labels resolve to the same dir
    // (on Windows `state` falls back to the `data` dir). We must NOT dedupe by
    // dir: the include patterns are label-scoped (`^state/logs/`,
    // `^data/sessions/...`), so collapsing `state` into `data` would silently
    // drop logs/history. The engine harmlessly walks the shared dir per label;
    // no included file is captured twice (the label-scoped includes don't overlap).
    return gooseCandidateRoots(env).filter((r) => {
      try {
        return fs.statSync(r.dir).isDirectory();
      } catch {
        return false;
      }
    });
  },

  // Irreplaceable, user-generated state worth a full mirror.
  include: [
    /^data\/sessions\/sessions\.db$/, // conversation history (SQLite, WAL)
    /^data\/projects\.json$/, // tracked projects index
    /^config\/config\.yaml$/, // model/provider/extension config
    /^config\/memory\//, // global MCP memory store
    /^config\/recipes\//, // saved recipes
    /^state\/history\.txt$/, // command history
    /^state\/logs\//, // session/extension logs
  ],

  // Large or volatile data, and SQLite sidecars (the snapshot produces a clean .db).
  exclude: [
    /^data\/models\//, // downloaded local models — large, re-fetchable
    /-wal$/,
    /-shm$/,
    /\.lock$/,
    /\.tmp$/,
  ],

  // sessions.db is opened in WAL mode → must be snapshotted, not raw-copied.
  sqlite: [/^data\/sessions\/sessions\.db$/],

  // Plaintext credentials. Keyring-stored secrets aren't on disk and are out of
  // scope; these file-based ones must never leave the machine.
  secretExclude: [
    /^config\/secrets\.yaml$/, // present only when GOOSE_DISABLE_KEYRING is set
    // Provider OAuth/token caches under the config dir.
    /^config\/(kimicode|gemini_oauth|xai_oauth|githubcopilot|chatgpt_codex|databricks)\//,
  ],
};
