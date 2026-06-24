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

## FAQ

**How do I get Backblaze B2 credentials?**

Create a free [Backblaze B2](https://blze.ai/storage) account, make a bucket, then create an Application Key. Use the keyID and applicationKey as `B2_KEY_ID` and `B2_APPLICATION_KEY`, and the bucket name as `B2_BUCKET`.

**Is my data encrypted?**

Yes — AES-256-GCM at rest. Set `B2_ENCRYPTION_KEY` to a long random passphrase. If you don't, it falls back to deriving a key from your B2 application key and prints a warning; setting a dedicated key means a leaked bucket credential can't decrypt your backups.

**How often does it back up, and can I change the schedule?**

By default it backs up immediately on start and then daily. Set `B2_SCHEDULE` to `daily`, `weekly`, or any cron expression.

**Does it re-upload everything each time?**

No. Backups are incremental — only files that changed since the last run are uploaded (SHA-256 diffing); unchanged files are carried forward server-side, so each snapshot still restores on its own.

**How do I restore Goose on a new machine?**

Install and run `goose-b2-backup` on the new machine. If local state is empty and snapshots exist in your bucket, it auto-restores the latest snapshot on first run. (You can also point it at a fresh bucket prefix to keep machines separate.)

**How many snapshots are kept?**

The 10 most recent by default; older ones are pruned. Change with `B2_KEEP_SNAPSHOTS`.

**How do I run it automatically in the background?**

`goose-b2-backup --install` writes an OS service (launchd on macOS, systemd user unit on Linux, Task Scheduler on Windows). Because a background service can't see your shell's exported variables, put your credentials in `~/.config/goose-b2-backup/config.json` (chmod 600) before activating it.

**Can I back up several machines to one bucket?**

Yes — give each machine a distinct `B2_PREFIX` so their snapshots don't mix.

**How do I check it's actually working?**

Run `goose-b2-backup --once` and watch the output; it logs what it uploaded and the snapshot id. You can also browse the bucket in the B2 web UI.

**How much does this cost?**

Only your Backblaze B2 storage, which is priced per GB-month — see [blze.ai/storage](https://blze.ai/storage). The tool itself is free and open source (MIT).

**Will backing up corrupt my live Goose session database?**

No. `sessions.db` is opened in WAL mode; the tool uses SQLite's online backup API to capture a consistent snapshot even while Goose is running.

**My API keys aren't in the backup — why?**

Goose stores provider keys in your OS keyring by default, which isn't a file and isn't backed up. After restoring to a new machine, re-enter your keys (or set `GOOSE_DISABLE_KEYRING` if you prefer the `secrets.yaml` file — note that file is excluded by this tool).

**Where does Goose keep its data, and is macOS different?**

Config in `~/.config/goose`, sessions in `~/.local/share/goose`, logs in `~/.local/state/goose`. macOS uses these same XDG paths (not `~/Library`). All three are backed up; `GOOSE_PATH_ROOT` overrides them.

## Learn more

- [Backblaze B2 Cloud Storage](https://blze.ai/storage) — affordable, S3-compatible object storage
- [agent-backup-core](https://github.com/backblaze-labs/agent-backup-core) — the shared backup engine powering this tool

## License

MIT
