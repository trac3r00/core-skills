---
name: omo-runner
description: "Offload long OmO runs to remote runners, pull results, set up the pool. Use when a long run starts or runners need setup. Not for fleet supervision (watcher)."
version: 1.1.0
license: MIT
when_to_use: "Use before starting a long or wide workflow in any repo, to check what the runners are doing, to move a running session off this machine, or when the user asks to create, add or fix omo-runner hosts."
metadata:
  agentskills:
    tags: [offload, remote, proxmox, herdr, workflow, infra]
---

# omo-runner

Heavy OmO work runs on remote runners, not on the machine the user is typing on.
The runners use this machine's subscription tokens, delivered by a token broker
the user already runs (or sets up once); this skill never copies tokens by hand.

Everything is driven by `omo-mods runner ...` and one config file,
`config-omo-runner.json` (under OmO's omo-mods data dir, or `OMO_RUNNER_CONFIG`;
`omo-mods runner help` names the path, `setup show` prints its contents). Example: [config-omo-runner.example.json](config-omo-runner.example.json).
If `omo-mods` isn't on PATH, the package's bin is `dist/bin/omo-mods.js` in the
omo-mods checkout or install (run it with `node`); say so rather than guessing a path.

Commands (from the CLI's own usage): `status [--json]`, `run`, `resume`, `push`
(sync only), `pull`, `switch`, `setup provider|add|remove|show|check|init`.

## 1. Is the pool set up?

```sh
omo-mods runner status
```

- Every line reads `<name>: up, ...` (exit 0): go to section 3.
- `no runners configured in <path>`: go to section 2.
- A line reads `<name>: DOWN (<error>)` (exit 1): tell the user which one and
  continue with the others; do not repair infrastructure the user did not ask about.

## 2. Setting the pool up (first time, or adding runners)

Ask the user with `ask_user_question` (waitForAnswer true) before creating anything. One question,
two or three options:

- **Proxmox VE host available** (recommended when they have one: clones are
  cheap, resources are adjustable live). Ask for its SSH alias if unknown.
- **Separate Linux server(s) over SSH** (any Debian/Ubuntu box the user can ssh
  into as a non-root user).
- **Not now** - stop and run the work locally after saying why it is heavy.

Recommend PVE when both exist. Then:

### Provider pve

1. `omo-mods runner setup provider pve`
2. Build or reuse a template CT that already has bun, omo, gh login and the
   token-broker auth: a working runner backed up with
   `vzdump <vmid> --mode suspend --compress zstd --dumpdir <dir>`.
3. For each new runner (VMID = last IP octet is the house convention; check the
   IP is free with `ping -c1`):
   ```sh
   pct restore <vmid> <template.tar.zst> --storage <store> --hostname omo-runner-NN \
     --memory 16384 --swap 2048 --cores 8 --onboot 1 --unprivileged 1 --features nesting=1 \
     --tags omo-runner --net0 "name=eth0,bridge=vmbr0,firewall=1,gw=<gw>,ip=<ip>/<cidr>,type=veth"
   pct start <vmid>
   pct exec <vmid> -- bash -c 'rm -f /etc/ssh/ssh_host_* && dpkg-reconfigure -f noninteractive openssh-server && systemctl restart ssh; rm -f /etc/machine-id /var/lib/dbus/machine-id && systemd-machine-id-setup'
   ```
   Fresh host keys and machine-id matter: clones otherwise collide in
   `known_hosts` and in anything keyed by machine-id.
4. Add an SSH alias on this machine (`Host omo-runner-NN` with the IP, user,
   key, `StrictHostKeyChecking accept-new`), then register it:
   `omo-mods runner setup add omo-runner-NN host=omo-runner-NN ip=<ip> user=<user> vmid=<vmid> cores=8 memGb=16`
   (other accepted keys: `omo=PATH`, `srcDir=PATH`; unknown keys are ignored).
5. Add the alias to the token broker's target list and run it once; then
   `omo-mods runner setup check` must exit 0 and show `auth.json present` on
   every runner (it also checks ssh, omo, bun and gh).

### Provider ssh

1. `omo-mods runner setup provider ssh`
2. On each server, as the runner user: install bun (`curl -fsSL https://bun.sh/install | bash`),
   Node 24+, `bun install -g omo-ai`, and `gh auth login` for private repos.
3. SSH alias + `setup add` + token-broker target as above; `setup check` must pass.

Record what was created (names, IPs, VMIDs, resources) for the user in plain words.

## 3. Running heavy work there

```sh
omo-mods runner run <repo> "<prompt>" [--to omo-runner-NN] [--name "label"]
```

Picks the runner with the fewest live sessions (then lowest load per core),
syncs HEAD (unpushed commits travel as a bundle), the tracked diff, untracked
files and the repo's `.omo/` state, runs `bun install` when a lockfile exists,
opens a Herdr space whose pane is `ssh -t <runner> omo`, waits for the prompt
and sends your text. The run prints the pane to watch. Don't poll it: subscribe
from `eval` with `tool.monitor({ command: "herdr agent wait <pane> --timeout 3600000 && echo DONE",
filter: "^DONE$" })` (Herdr.app: `hc wait <terminal>`), then read the result once
with `herdr pane read <pane> --source recent-unwrapped --lines 120` or `hc read`.

To move a session that is already running here: `omo-mods runner resume <repo> <session.jsonl>`.

While it runs, keep the local session free; check progress with
`omo-mods runner status` (shows each session's workflow and last reply) or the
switcher pane (`/runner` inside OmO, or `omo-mods runner switch` in a Herdr pane).

## 4. Bringing results back

```sh
omo-mods runner pull <repo> [--to omo-runner-NN]
```

Copies the runner's `.omo/` back into the repo (research runs, plans, evidence)
and stages code changes for review in
`~/.omo/mods/runner-staging/<repo>-<timestamp>/`: `changes.patch`, `untracked.tgz`,
`new-commits.txt`, and the runner's session transcripts (resume locally with
`omo --rebind <file>` from the repo). Read the patch before applying it; the
runner never pushes to origin by itself.

## Gotchas

- A runner session lives as long as its Herdr SSH pane. If the pane drops, the
  transcript is still on the runner: the switcher's Enter re-opens it with
  `omo --session <id>`.
- `omo --print` over plain ssh hangs when stdin stays open; use `</dev/null`.
- Over-subscribed runner (load > cores, under 2 GB free): pick another with
  `--to`; on PVE, `pct set <vmid> --memory ... --cores ...` applies live.
- Runners usually have no sudo, tmux or rsync; the module uses tar over ssh.
