# NARIMATO — Development Guardrails

**Authority.** This document records the rules that prevent the regressions documented in
[FIXES.md](FIXES.md). It is referenced by [SSOT.md](SSOT.md), [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md),
the repository [AGENTS.md](../AGENTS.md) and the PR template. If a request or a plan conflicts with
this document, stop and resolve the conflict before writing code. The renderer/camera specifics are
binding in [RENDERER_TECHNOLOGY.md](RENDERER_TECHNOLOGY.md).

One sentence: **continue from the working system; never replace working behaviour with a new
mechanism to satisfy a nearby request.**

## 1. Prime directive — protect the working parts

The repository has already reached working states that the user explicitly confirmed: the spherical
mouse/cursor/carrier interaction, the single planet, the GDS UI and the server-authority rules. New
work is allowed to **add or fix one thing**; it is not allowed to replace the parts that already
work.

- Before touching behaviour, identify the working baseline: commit, issue, screenshot or explicit
  user approval (for the carrier controls this is the v3.57 viewer model; see
  [FIXES.md](FIXES.md)).
- The baseline is a **contract**. Changing it requires an explicit request and a new issue
  acceptance criterion — not an implementation convenience.
- A cleanup may delete code that implements a hack; it must not delete or rewrite the verified
  behaviour the hack bypassed.

## 2. Standard development loop

1. **Restate the request literally.** Write what the user asked to change and what they did not ask
   to change.
2. **Read the SSOT and the owning docs** ([SSOT.md](SSOT.md), architecture, physics, test map,
   fixes log).
3. **Read the history first.** `git log --oneline --all -- <paths>`, commit messages and old
   acceptance scripts. Find the last confirmed-working commit. Never design a new mechanism before
   checking whether one already exists and worked.
4. **Reproduce the defect visually** in a real browser at the relevant zoom/mode. Save a baseline
   screenshot/recording.
5. **Create or reopen the issue** with GDS #81 body, acceptance criteria and non-goals. Move it to
   `In Progress (NOW)` and write a concrete `Next Action`.
6. **Write the smallest change that satisfies one acceptance criterion.** Prefer editing the working
   path over adding a parallel one.
7. **Prove locally**: focused tests, the relevant acceptance script, then the full `npm test`.
8. **Prove visually**: before/after screenshots at orbit, deep zoom and surface; exercise the mouse,
   cursor keys, wheel and touch paths touched by the change.
9. **Document durable knowledge** in the owning doc (never a status table). Update the fixes log for
   corrective work.
10. **PR → CI green → merge → board evidence → close** only when
    [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) is fully satisfied.

## 3. DO NOT DO

### 3.1 Scene and geometry

- **Do not add a second renderer, canvas, planet, HUD, scene or visual system.**
- **Do not build a derived surface mesh, cached seed globe or alternative planet geometry.** The
  only surface is the authoritative active-leaf tree rendered by the single renderer.
- **Do not add render-only triangle subdivision** beyond the authoritative leaf set. Triangle count
  must equal the active leaf count; boundary arcs are sampled, not extra facets.
- **Do not change camera projection to simulate a different scene.** The approved zoom/controls
  contract is the carrier camera; orbit `SphereCamera` and surface `CarrierCamera` are views of the
  same renderer.
- **Do not hide back geometry, then paint translucent fills over it.** The surface is opaque; hidden
  back wireframes/cages are not drawn.
- **Do not introduce a visual style change (opacity, glow, color, line weight) as a side effect** of
  a geometry/control fix. Style changes need an explicit request.

### 3.2 Controls and camera

- The approved input contract is [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md): quaternion absolute
  pointer-point follow, unlimited rotation, and one shared WASD/arrow orbit/surface controller.

- **Never overwrite the pointer/carrier camera orientation every frame** from an animation pose.
  That cancels mouse drag and produces pole reversal. Set the carrier pose once per frame only as the
  approved carrier model does (held at the pilot/cursor anchor, parallel transport).
- **Never replace working mouse/cursor/zoom behaviour while fixing something else.** Controls are a
  protected contract.
- **Never use Euler yaw/pitch for pole-crossing.** Use the carrier frame, quaternion object rotation
  and fixed-focal radius dolly from `shared/sphere-interaction.js`.
- **Do not add a second input path** (keyboard/pointer/touch) that diverges from the shared
  `orbit-controls` / carrier implementation without an issue and parity tests.

### 3.3 Honesty and acceptance

- **Tests are not visual acceptance.** A green suite can hide a broken scene. Every user-visible
  change requires real-browser screenshots at orbit, deep zoom and surface.
- **Do not build fake acceptance.** No comparing two cameras and calling it "single scene", no
  material probes that do not exercise what the user sees.
- **Do not widen expected-error lists to silence a flake.** Root-cause the refusal; if it is a
  legitimate protocol answer, document it and test it explicitly (e.g. `NOT_A_LEAF`).
- **Do not claim fixed** while a visible regression remains. State the remaining defect and the
  next pass explicitly.
- **Do not declare Done without** the issue's `Delivered`, `Release Evidence`, `Documentation` and
  `Next Action` fields and a commit SHA.

### 3.4 Process and scope

- **No umbrella issues and no bundled redesigns.** One issue = one independently verifiable outcome.
- **Do not rearchitect what wasn't asked.** "The next step" is not permission to replace the system.
- **Do not delete working code/features while cleaning hacks.** Remove the hack, preserve the
  verified behaviour; prove it with the acceptance script and a screenshot.
- **Do not ask the user to test before we have tested visually ourselves.**
- **Do not skip the board.** Issue first, board status, dependencies and evidence are mandatory.
- **Do not add status checklists to docs.** The board owns status; docs own durable knowledge.

### 3.5 Authority, security and UI

- **Do not fabricate server state** (resources, ownership, locks, score, cells) on the client.
- **Do not ship DOM UI outside `@sovereignsquad/gds`.** No second component library, no hand-rolled
  controls, no duplicate HUD trees.
- **Do not degrade accessibility** (keyboard, focus, contrast, 200% zoom, reduced motion, screen
  reader equivalents) for visual convenience.
- **Do not commit secrets**, credentials or environment-specific values.

## 4. Detour detection — stop signs

Stop and re-read the request if any of these appears:

- the change needs a **new renderer/camera/scene/mesh** to satisfy a zoom, control or visual request;
- the change would **rewrite a file/mechanism the user has already approved**;
- the patch grows into a **multi-system rearchitecture** or touches unrelated modules;
- a test/acceptance has to be **invented or relaxed** to make the change pass;
- the visual result **replaces** an existing look rather than fixes the named defect;
- the explanation starts with "instead of the old approach…" rather than "the old approach broke
  because…";
- the plan cannot be demonstrated with a **before/after screenshot**;
- the request is ambiguous between "fix this gesture" and "redesign controls" — ask before coding.

If two or more signs appear, stop implementation, write the baseline and the minimal fix plan in the
issue, and ask one concrete question.

## 5. Protected-behaviour change protocol

Apply this to renderer, camera, controls, geometry, surface HUD and any visual style:

1. Capture the **baseline** (commit + screenshots + relevant acceptance output).
2. Write the **contract** in the issue: what must remain identical, what may change.
3. Prefer **one-file/one-path** changes; no parallel implementation.
4. Add/keep a **regression test or acceptance check** for the protected behaviour.
5. Verify **both** the named fix and the protected behaviour visually.
6. If the user reported a gesture/defect, reproduce that exact gesture before and after.
7. Update [FIXES.md](FIXES.md) with cause/fix/verification and link the issue.

## 6. History-first protocol

Before changing any surface/control/render code:

```bash
git log --oneline --all -- public/js/app.js public/js/renderer.js \
  public/js/shared/sphere-interaction.js public/js/shared/orbit-controls.js
git log --oneline --all -- public/js/surface-controller.js public/js/shared/carrier-camera.js
git show 8af2985:public/js/icosahedron-viewer.js
```

- Treat commit messages that say "confirmed working", "restore", "approved" or "revert" as strong
  evidence of the approved behaviour.
- The carrier model is documented in `narimato-physics.md` and implemented in
  `public/js/shared/carrier-camera.js`; do not invent a replacement.
- When a regression is found, **restore the working behaviour first**, then re-apply only the
  intended new change.

## 7. Verification protocol

**Automated**

```bash
npm test
npm run docs:check
npm run check:version
npm run evidence:check
npm run release:gate        # full behaviour/acceptance matrix
```

**Visual (mandatory for user-visible changes)**

- Orbit, deep zoom and surface screenshots; include the HUD state.
- Mouse drag direction and exact point follow (grab a point, drag, confirm it follows).
- Pole crossing (mouse and cursor/pilot).
- Wheel/pinch in/out on the same camera path.
- No see-through: no starfield or hidden back geometry through the planet.
- Triangle/face count equals the active leaf count.
- Accessibility: keyboard journey, focus, 200% zoom, reduced motion, axe serious/critical = 0.

**Evidence** — attach screenshots and command output to the issue/PR; a green unit test alone is not
enough for a visual/control change.

## 8. SSOT / board rules

- Issue first; link docs; keep [ISSUE_MAP.md](ISSUE_MAP.md) and `issues.json` in sync when a new
  issue/doc is added.
- One issue, one outcome; no silent widening.
- Board `Status`/`Readiness`/`Next Action` are updated at start, review and done.
- `Done` requires [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md); otherwise leave it in Review and
  say exactly what is missing.
- External blockers (A11Y-02, OPS-04) are reported honestly; never marked Done without evidence.

## 9. Incident → rule ledger

| Incident | What went wrong | Rule | Fix |
|---|---|---|---|
| Second surface scene | `SurfaceCamera` + derived `live-surface-mesh` drew a different scene | 3.1, 4 | [#77](https://github.com/moldovancsaba/narimato/issues/77) / [PR #78](https://github.com/moldovancsaba/narimato/pull/78) |
| Camera overwrite | Per-frame `yaw/pitch` from pilot pose canceled mouse drag, broke poles | 3.2, 5 | [#80](https://github.com/moldovancsaba/narimato/issues/80) / [PR #81](https://github.com/moldovancsaba/narimato/pull/81) |
| Extra triangles | Render-only 4^level subdivision + LOD copies | 3.1 | [#82](https://github.com/moldovancsaba/narimato/issues/82) / [PR #83](https://github.com/moldovancsaba/narimato/pull/83) |
| See-through planet | Hidden back wireframe under translucent fills | 3.1 | [#84](https://github.com/moldovancsaba/narimato/issues/84) / [PR #85](https://github.com/moldovancsaba/narimato/pull/85) |
| False soak PASS | Duration clamp, gate checked thresholds only | 3.3 | [#71](https://github.com/moldovancsaba/narimato/issues/71) / [PR #72](https://github.com/moldovancsaba/narimato/pull/72) |
| Fake single-scene acceptance | Compared two cameras and called it one scene | 3.3 | deleted with [#77](https://github.com/moldovancsaba/narimato/issues/77) |

## 10. Pre-PR / pre-Done checklist

- [ ] Issue exists and matches exactly this scope.
- [ ] Baseline behaviour captured; protected behaviour unchanged or explicitly approved.
- [ ] No second renderer/canvas/scene/mesh; triangle count = leaf count.
- [ ] Controls: mouse point-follow, pole crossing and wheel/pinch verified.
- [ ] Surface opaque; no see-through; no hidden back geometry.
- [ ] Screenshots attached for orbit, deep zoom and surface.
- [ ] `npm test`, `docs:check`, `evidence:check`, relevant acceptance scripts green.
- [ ] Durable docs updated; [FIXES.md](FIXES.md) updated for corrective work.
- [ ] Board evidence fields filled; external blockers stated honestly.
