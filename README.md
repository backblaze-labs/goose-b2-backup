# goose-b2-backup

**Encrypted, incremental, off-site backups for your AI coding agent — powered by [Backblaze B2 cloud storage](https://blze.ai/storage).**

Back up your [Goose](https://github.com/block/goose) state — sessions, config, memory, recipes, and history — to [Backblaze B2](https://www.backblaze.com/cloud-storage). Encrypted, incremental, and WAL-safe. No Goose plugin required; it runs as a small standalone daemon.

Built on [`@backblaze-labs/agent-backup-core`](https://github.com/backblaze-labs/agent-backup-core).

## Why

Goose stores every session in a local SQLite database and your config/memory/recipes in plain files. There's no built-in full backup — `goose session export` only handles one session at a time. Lose the disk and it's gone. This mirrors all of it to B2 on a schedule.

## Install

```bash
npm install -g @backblaze-labs/goose-b2-backup
```

## Configure

Set credentials in the environment (or `~/.config/goose-b2-backup/config.json`):

```bash
export B2_KEY_ID=004...
export B2_APPLICATION_KEY=K004...
export B2_BUCKET=my-goose-backups
export B2_ENCRYPTION_KEY="a long random passphrase"   # strongly recommended — see Security
```

Optional: `B2_REGION`, `B2_PREFIX`, `B2_SCHEDULE` (`daily` | `weekly` | cron), `B2_KEEP_SNAPSHOTS`, `B2_ENCRYPT=false`.

## Run

```bash
goose-b2-backup            # daemon: auto-restore on first run, then scheduled backups
goose-b2-backup --once     # single backup then exit (good for cron / CI)
goose-b2-backup --install  # install an OS service (launchd / systemd / Task Scheduler) to run at login
```

## What gets backed up

Resolved from Goose's actual paths (XDG on Linux **and** macOS; `%APPDATA%\Block\goose` on Windows; `GOOSE_PATH_ROOT` overrides all):

| Included | Location |
|---|---|
| Session history (SQLite, WAL-safe snapshot) | `data:` `~/.local/share/goose/sessions/sessions.db` |
| Projects index | `data:` `~/.local/share/goose/projects.json` |
| Config (model/provider/extensions) | `config:` `~/.config/goose/config.yaml` |
| Memory & recipes | `config:` `~/.config/goose/{memory,recipes}/` |
| Command history & logs | `state:` `~/.local/state/goose/{history.txt,logs/}` |

**Excluded:** downloaded models (`data/models/` — large, re-fetchable) and SQLite `-wal`/`-shm` sidecars (folded into the snapshot).

## Security

- **Set `B2_ENCRYPTION_KEY`.** It's separate from your B2 credentials, so a leaked bucket key can't decrypt your backups. Without it, the tool falls back to using the B2 application key and warns you.
- **File-based secrets are never uploaded:** `config/secrets.yaml` (only present if you disabled the keyring) and provider OAuth token caches (`gemini_oauth/`, `githubcopilot/`, etc.) are excluded.
- **Keyring-stored API keys are not on disk** and therefore not in any backup — Goose's default. If you restore onto a new machine, re-enter provider keys (or re-run provider auth).

## Learn more

- [Backblaze B2 Cloud Storage](https://blze.ai/storage) — affordable, S3-compatible object storage
- [agent-backup-core](https://github.com/backblaze-labs/agent-backup-core) — the shared backup engine powering this tool

## License

MIT
