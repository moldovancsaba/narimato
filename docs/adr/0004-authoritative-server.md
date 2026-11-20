# ADR-0004: Authoritative server for all game state

status: Accepted
date: 2026-11-20
supersedes: none
superseded_by: none
keys: SRV-01, SRV-02, SRV-03, SRV-04, TST-01

## Context

The game is adversarial multiplayer: cells are claimed, contested and broken; owners change;
scores and ore are persistent; hidden deposits must stay secret until discovered. A client that
can fabricate a claim, a break or a resource would break the shared world and the leaderboard.

Early delivery included a client-side robot visual path and client-side surface routes. They
looked plausible but were not guaranteed to match the authoritative cells, and their mining beams
were not tied to server clicks.

## Decision

- The Node server is the sole authority for ownership, contest locks, clicks, breaks, mining,
  score, escape, planet transitions, incidents and robot actions.
- Surface poses for every human and robot are transient server state, validated, throttled,
  broadcast per planet room, and expired on disconnect/planet switch.
- Robot surface routes and click targets are generated server-side from the same leaf tree; a
  robot's beam points at the cell its authoritative click actually changed (`surface_mine`).
- Clients render from snapshots/events only; optimistic UI is limited to input feedback and is
  reconciled by the next authoritative frame.
- Hidden deposits (resource id and discovery click) are never serialized to clients; the wire
  leaf exposes only a discovered resource id.
- Two-client plus robot acceptance is the proof for every surface claim.

## Consequences

- Server tick/cost and event volume grow with surface actors; budgets and throttles are explicit.
- Client code becomes a view/controller layer; every visual claim needs an event source.
- Offline or client-only demos must be labelled as such; they cannot claim multiplayer truth.
- Tests must cover room isolation, reconnect, stale poses and rejected clicks.

## Alternatives considered

- **Client-authoritative movement/poses with server validation later**: rejected; it creates
  visible drift and a second truth.
- **Peer-to-peer presence for poses**: rejected; it leaks identity/position and breaks rooms.
- **Server-side rendering of every frame**: rejected; wasteful and unnecessary — authority is
  about state transitions, not pixels.

## Links

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — multiplayer model, protocols and data model.
- [SPEC_INFINITE.md](../../SPEC_INFINITE.md) — frozen server/client protocol contract.
- Issues: [SRV-01](../ISSUE_MAP.md), [SRV-02](../ISSUE_MAP.md), [SRV-03](../ISSUE_MAP.md),
  [SRV-04](../ISSUE_MAP.md), [TST-01](../ISSUE_MAP.md).
