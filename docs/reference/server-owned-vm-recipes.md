# Server-owned workspace recipes

This patch targets Orca v1.4.222 (commit `4bb6f2072b07c1f0664b809551f77754700570e4`),
the version installed on the Whiffletree controller. Its SSH providers already
support a central runtime owning a worker's files, terminals, and agents.
Newer upstream code requires a managed Orca runtime on every SSH target; that
separate migration is outside this release patch.

A recipe belongs to the host holding the project's primary checkout. For a
paired-server project, discovery and lifecycle commands run in that server's
process. The desktop supplies the explicit owner environment id; the server
uses its own repo ids, paths, SSH keys, and runtime store. Failed remote calls
never run the recipe on the desktop. Local projects retain their existing path.

The IPC adapter and authenticated runtime RPC use the same host implementation.
Headless `orca serve` registers SSH providers and recipe services before its RPC
listener starts. Recipe output still describes SSH connection information; the
central host connects and registers the worker checkout through its existing
SSH project setup path. For provisioned-root recipes, `ephemeralVm.provisionWorkspace`
registers and adopts the checkout on the server before replying. The client
repeats those existing steps idempotently to populate its UI state. A caller
disconnecting during any server-owned phase does not abort that work. The client projects those rows as owned by the central
runtime, preserving the nested SSH connection id. No laptop SSH bridge is used.

## Required behavior

- Discover recipes on the explicitly selected server's primary checkout.
- Provision through the existing recipe runner with server-owned source refs.
- Register and adopt the worker checkout through the central server's SSH provider.
- Preserve ownership through cancel, attach, resume, suspend, and cleanup.
- Keep provisioning and agent execution alive when the UI disconnects.
- Reject older servers clearly; never silently select local execution.
- Preserve local recipes and older clients; advertise support only after host registration.
- Deduplicate concurrent and completed provisioning requests by a required request id.
- Refuse conflicting request arguments and ambiguous retries after a host interruption.
- Keep recipe credentials in the host's existing protected runtime storage.

Provision requests are recorded durably under `ephemeral-vm-provision-requests` in
the owning profile. A client disconnect does not abort the host controller.
Cancellation requires `ephemeralVm.cancelProvision`. A pending request left by a
host interruption is refused on retry: inspect the runtime store and provider
resources before creating a new request. The journal is bounded at 4096 requests;
archive settled records when needed. Removing a settled record ends its retry
protection, so retain it while a client may still retry that request id.

The release's paired-runtime authentication authorizes full host-user operations;
mobile clients remain restricted by the existing method allowlist. This patch
adds no mobile provisioning permission and no privilege escalation for recipes.

## Validation and rollout

Run the focused recipe, routing, request-journal, project-registration, and
renderer ownership tests, all typecheck targets, and the runtime Electron import
check. Build against this exact release, retaining its platform-native modules.
Use an isolated server profile and port before changing the persistent service.

The live acceptance run must create a VM through Orca, adopt its pinned checkout,
start a task, close all UI/control connections, reconnect to the same task, and
then remove the workspace and VM without a leaked target. Unit tests and a direct
provisioner invocation do not substitute for that test.

Rollback restores the previous Orca binary and preserves the profile and VM disk
state. New RPC methods and optional owner fields leave older peers compatible;
older clients cannot create server-owned recipes. Never convert an unreachable
worker into a cleaned or exited worker. Agent credentials remain per workspace
and must never be included in a shared image.

## Recorded Linux staging evidence

On 16 October 2026, the patched v1.4.222 bundle ran as an unprivileged, isolated
headless service on the Whiffletree controller. Production binaries and its
profile were unchanged. Only compiled `out/main`, `out/preload`, and
`out/renderer` were overlaid onto the official Linux release; the original
Linux CLI and platform-native resources were retained. CLI and resource files
remained unpacked when repacking the archive. The tested `app.asar` SHA-256 is
`690a95ac49cd17b140b86d89ef03192f31fec3419490185d464bf517a8ddba08`.
The executable code corresponds to `135bf259`; `808bac8b` adds reviewer tests only.

Authenticated runtime RPC discovered the real recipe and dispatched
`ephemeralVm.provisionWorkspace`. Its caller closed the socket after two seconds.
A later connection observed the registered, adopted workspace and an identical
request returned the same runtime/VM. A terminal created through the central
runtime's SSH provider reported Codex, Claude Code and pi versions. Its heartbeat
advanced from 22 to 46 between reads with no control sockets connected, preserving
the terminal and PTY. No model request or credential transfer was involved.

The first terminal connection exposed a worker image prerequisite: Linux node-pty
requires a compiler, make and Python. Temporary packages allowed that test to
continue; Whiffletree subsequently added those tools to its pinned Nix image.
A test using that fresh image is required before treating worker setup as complete.
Rendered desktop behavior and other platforms are not established by this run.
