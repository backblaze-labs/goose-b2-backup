import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shouldInclude } from "@backblaze-labs/agent-backup-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gooseAdapter, gooseCandidateRoots } from "./adapter.js";

describe("gooseCandidateRoots", () => {
  it("uses XDG dirs on Unix and honors XDG_*_HOME overrides", () => {
    const roots = gooseCandidateRoots({
      XDG_CONFIG_HOME: "/x/config",
      XDG_DATA_HOME: "/x/data",
      XDG_STATE_HOME: "/x/state",
    } as NodeJS.ProcessEnv);
    expect(roots).toContainEqual({ label: "config", dir: path.join("/x/config", "goose") });
    expect(roots).toContainEqual({ label: "data", dir: path.join("/x/data", "goose") });
    expect(roots).toContainEqual({ label: "state", dir: path.join("/x/state", "goose") });
  });

  it("GOOSE_PATH_ROOT overrides all three roots", () => {
    const roots = gooseCandidateRoots({ GOOSE_PATH_ROOT: "/goose" } as NodeJS.ProcessEnv);
    expect(roots).toEqual([
      { label: "config", dir: path.join("/goose", "config") },
      { label: "data", dir: path.join("/goose", "data") },
      { label: "state", dir: path.join("/goose", "state") },
    ]);
  });
});

describe("gooseAdapter.resolveRoots", () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "goose-roots-"));
    // Create config + data but NOT state, to prove non-existent roots are dropped.
    await fs.promises.mkdir(path.join(root, "config"), { recursive: true });
    await fs.promises.mkdir(path.join(root, "data"), { recursive: true });
  });
  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it("returns only existing roots", () => {
    const roots = gooseAdapter.resolveRoots({ GOOSE_PATH_ROOT: root } as NodeJS.ProcessEnv);
    const labels = roots.map((r) => r.label);
    expect(labels).toContain("config");
    expect(labels).toContain("data");
    expect(labels).not.toContain("state"); // never created
  });
});

describe("gooseAdapter include/exclude/secret patterns", () => {
  const patterns = {
    include: gooseAdapter.include,
    exclude: gooseAdapter.exclude,
    secretExclude: gooseAdapter.secretExclude,
  };

  it("includes the irreplaceable state", () => {
    for (const p of [
      "data/sessions/sessions.db",
      "data/projects.json",
      "config/config.yaml",
      "config/memory/global.json",
      "config/recipes/my-recipe.yaml",
      "state/history.txt",
      "state/logs/goose.log",
    ]) {
      expect(shouldInclude(p, patterns)).toBe(true);
    }
  });

  it("excludes large/volatile data and SQLite sidecars", () => {
    for (const p of [
      "data/models/llama.gguf",
      "data/sessions/sessions.db-wal",
      "data/sessions/sessions.db-shm",
    ]) {
      expect(shouldInclude(p, patterns)).toBe(false);
    }
  });

  it("never backs up file-based secrets", () => {
    for (const p of [
      "config/secrets.yaml",
      "config/gemini_oauth/tokens.json",
      "config/githubcopilot/info.json",
      "config/databricks/oauth/token.json",
    ]) {
      expect(shouldInclude(p, patterns)).toBe(false);
    }
  });

  it("flags sessions.db as a SQLite database needing a safe snapshot", () => {
    expect(gooseAdapter.sqlite.some((r) => r.test("data/sessions/sessions.db"))).toBe(true);
  });
});
