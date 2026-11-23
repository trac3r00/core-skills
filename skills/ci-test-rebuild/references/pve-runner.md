# Private CI box on Proxmox VE

Read when the user wants full runs on their own server instead of GitHub
Actions or another hosted CI (no minutes quota, code stays on their network).
Creating or changing a container needs the user's approval in the session and
goes through Proxmox access the user already has (the API, an MCP server they
enabled, or `ssh` to the host).

## Shape

- Mac: the targeted pre-push gate (SKILL.md step 3) on every push.
- CI box: one unprivileged Debian LXC with Bun, a bare repo per project, and
  `assets/pre-receive`. `git push ci <branch>` exports the pushed commit,
  installs, runs `bun run check` (or `bun check --no-script && bun test`),
  streams the output, and rejects the push on failure or timeout. The `ci`
  remote's branches therefore only point at green commits.
- No CI server, runner daemon, web UI, or files in the project repository.

## Container

Through the Proxmox API (`POST /nodes/{node}/lxc`) or `pct create` on the
host. First check `pvesh get /cluster/nextid`, a storage whose
`content` includes `vztmpl,rootdir` (`/etc/pve/storage.cfg`), a Debian
template already present (`pveam list <storage>`), and existing containers:
reuse is better than a duplicate, but a GitHub Actions self-hosted runner
still routes code through GitHub. Get the user's approval:

| Field | Value |
| --- | --- |
| hostname | `bun-ci` |
| unprivileged / features | `1` / `nesting=1` |
| cores / memory / swap | 4 / 4096 / 512 (adjust to the suite) |
| rootfs | `<storage>:16` |
| net0 | `name=eth0,bridge=vmbr0,ip=dhcp` |
| template | latest Debian standard template on that storage |
| ssh-public-keys | the Mac's public key only |
| onboot / start | `1` / `1` |

No secrets go in the container. It needs outbound HTTPS for the one-time
Bun installer and for `bun install` (package registry); the code arrives only
over `git push`.

## Inside the container (as root over SSH)

```sh
apt-get update && apt-get install -y git curl unzip ca-certificates
useradd -m -s /bin/bash ci
install -d -o ci -g ci -m 700 /home/ci/.ssh
install -o ci -g ci -m 600 /root/.ssh/authorized_keys /home/ci/.ssh/authorized_keys
install -d -o ci -g ci /srv/ci
su - ci -c 'curl -fsSL https://bun.sh/install | bash'
```

From the Mac: `scp <skill-dir>/assets/pre-receive root@<ip>:/srv/ci/pre-receive`
then `ssh root@<ip> 'chmod 755 /srv/ci/pre-receive'`. For a rollback point,
take a snapshot named `clean` (`pct snapshot <vmid> clean`) when the rootfs
storage supports container snapshots (for example ZFS, LVM-thin or Ceph RBD;
check the storage type in the Proxmox docs). Plain `dir` storage, where the
container disk is a raw file, does not; ask before using a `vzdump` backup instead, since it
writes an archive into the user's backup storage.

## Mac side

`~/.ssh/config`:

```text
Host ci
  HostName <container ip>
  User ci
  ProxyJump <proxmox host>
```

`ProxyJump` through the Proxmox host keeps it reachable wherever the PVE host is (e.g. over
Tailscale). With DHCP, reserve the container's address in the router or the
alias breaks when the lease changes.

Per project (no repository files change):

```sh
ssh ci 'git init -q --bare /srv/ci/NAME.git && ln -sf /srv/ci/pre-receive /srv/ci/NAME.git/hooks/pre-receive'
git remote add ci ci:/srv/ci/NAME.git
git push ci HEAD
```

Logs: `ssh ci ls ci-logs`, one file per commit. `CI_TIMEOUT` (seconds,
default 1800) is read from the hook's environment on the box.

## Measuring it

Add a row to the comparison; a fresh ref forces a full run and `--no-verify`
keeps the Mac gate out of the number:

```bash
--cmd 'remote-full=git push --no-verify ci HEAD:refs/heads/bench-$$'
```

Do not pass `-q`: it hides the remote output that carries the test count.

Delete the bench refs afterwards (`git push ci --delete bench-...`).

## Checks before calling it done

- Green commit: push exits 0 and prints `ci: PASS`.
- Failing test, type error, and `CI_TIMEOUT` overrun: push exits 1, prints
  `ci: FAIL`, and the remote branch does not move.
- Branch deletion runs nothing.
- `ssh ci 'ls /tmp'` shows no leftover run directories.
