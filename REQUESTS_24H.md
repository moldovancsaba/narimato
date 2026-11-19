# NARIMATO — 24-Hour Request & Delivery Status (updated)

**Window:** 2026-11-18 → 2026-11-19  
**Current:** `v3.47.0`  
**Engineering contract:** [DELIVERY_TASKS.md](DELIVERY_TASKS.md)

Legend: **Delivered** = working and verified; **Partial** = real work landed but acceptance not
met; **Open** = not delivered; **Superseded** = changed after a correction.

| # | Request | Status | Current evidence / remaining work |
|---|---|---|---|
| 1 | More story, less system-console UI | Delivered | Captain's Log, human labels, incidents; subjective sign-off yours |
| 2 | Emergency supply / crashed ship when stuck | Partial | Broadcast exists; surface pilots now snap to impact (`focusLabel`); orbital focus and two-client verification still needed; D4 |
| 3 | More rare elements | Delivered | Guaranteed rare in refit |
| 4 | Major planet colours | Delivered | Eight palettes |
| 5 | Reverse cursor movement | **Partial — changed** | Absolute arcball replaced by incremental screen-space rotation; direct drag direction unit-tested. Live device feel still to sign off. |
| 6 | Smooth/faster cursor navigation | Delivered | Eased travel + Shift |
| 7 | Voice/audio disappearing | Partial | Desktop watchdog fixed; real-device gate open |
| 8 | Limitless rotation through poles | **Partial — improved** | Direct incremental rotation + pole-direction unit test; pole render checked. User live sign-off still open. |
| 9 | Zoom levels with bezier | Delivered | Manual-only |
| 10 | Separate mouse vs cursor travel | Partial | Mouse direct + arrows inverse, but direction regression remains; D6 |
| 11 | Incident explanations | Delivered | Story text exists |
| 12 | Shareable key-info guide | Delivered | GUIDE |
| 13 | Fewer early rare requirements | Delivered | Early caps |
| 14 | Supply for all humans + camera turns | **Partial — zoom focus added** | All orbital clients focus and zoom toward the impact; surface pilots snap. Two-client acceptance pending. |
| 15 | Five-tetra ship / solar sun / alien ships | **Partial — deterministic + reachable** | Incident order deterministic and all four unit-tested; incidents now also fire when the refit mission is complete, not only after every hidden deposit is gone. Ship/effect visual coverage still open. |
| 16 | **Actual 3D humanoid dolls on the surface, not imitation sprites** | **Partial — changed this turn** | Surface external view now uses a projected closed-triangle **3D humanoid** (head, visor, torso, hips, arms, legs) through the same camera, not the old 2D sprite. Final art/rig/animation polish and peer verification remain. |
| 17 | **No cached copy — multiplayer planet changes continuously** | **Partial — changed this turn** | Removed the “cached planet” path: `surfaceLiveFaces` is rebuilt from the live `leafList` on every authoritative cell/break/click. It is still a derived visual triangle mesh at walkable density; direct renderer-of-active-leaf-only and full HUD/controller parity remain D1. |
| 18 | **One single planet, camera-only change** | **Partial — major step this turn** | The existing `IcosaRenderer` now draws surface mode through `SurfaceCamera`; the separate terrain canvas no longer draws sky/terrain. HUD remains the orbital HUD; surface controls are overlays. Remaining: remove derived visual mesh/controller duplication, full DOM parity, acceptance test. |
| 19 | **Same HUD/layout/information, 2D→3D only** | **Partial** | Main orbital HUD is visible in surface mode; surface-specific title/mission duplicates are hidden; target/exit/lap are bottom overlays. Need complete DOM parity and no conflicting panels. |
| 20 | **UI elements must be present (no missing UI)** | Partial | Main HUD visible; target/exit/lap present. Previous stale full-screen surface rectangle removed on exit. Need regression audit at all viewports. |
| 21 | **All players/robots walk and mine** | **Delivered core + acceptance** | Server routes/poses/clicks + `surface_mine`; surface beam on actual cell; browser acceptance sees 9 authoritative mine effects in 6 s. |
| 22 | **Robots own paths, turns, mining** | **Partial — server routes/click mapping landed** | Server route/turn + cell-under-pose clicks implemented; client visual mapping and two-client acceptance pending. |
| 23 | **Triangles change while walking** | Partial | Live mesh refreshes on cell/break/click; footprint harvesting faster; authoritative-only visual mesh acceptance pending |
| 24 | Surface uses live cells, no generated geography | Partial | Renderer draws current cells; derived visual mesh rebuilt live. D1 removes the last derived layer |
| 25 | Orbital UI removed from surface | Superseded | Now the orbital HUD is intentionally reused; surface-specific duplicates hidden |
| 26 | Surface HUD visible / unclipped | Partial | Main HUD visible; surface target/exit/lap bottom overlays; full viewport audit pending |
| 27 | Surface entry after 4th zoom | Delivered | v3.30/v3.33 |
| 28 | Seamless pole crossing | Partial | Math tests pass; visual visibility still reported; D7 |
| 29 | Green/red harvest semantics | **Delivered + browser-verified** | Shared `canHarvestCell` truth; browser acceptance checks target colour against the actual `/api/action` result and sees green→200. |
| 30 | Resource pins only where mineable | Delivered | Target/supply only; hidden resources intentionally unexposed |
| 31 | Exit to farthest orbit | Delivered | Named `ORBIT_FAR_ZOOM = 0.4`; exit returns there |
| 32 | Roadmap / README / release notes / code comments | Delivered | ROADMAP, DELIVERY_TASKS, README, RELEASE_NOTES |
| 33 | **Make/update the task list** | Delivered | This document + DELIVERY_TASKS updated |
| 35 | **Two-client surface acceptance** | **Delivered test harness** | `scripts/acceptance-two-client-surface.mjs`: two browsers join/surface, both see surface peers and robot server poses; no page errors. |

## Reconsidered priorities

1. **D1/D2** — finish the single-renderer/HUD migration; remove the derived visual mesh and dedicated
   surface controller duplication.
2. **D15** — finish the 3D humanoid: connected neck/hips, arm/leg rig, peer walk/mining animation,
   close-up verification.
3. **D16** — no stale state: all surface geometry from live authoritative cell changes; add a
   multiplayer mutation test.
4. **D3/D5** — authoritative robot pose/path/click mapping and visible mining.
5. **D4** — supply relocation for every human.
6. **D6–D10** — controls, poles, colours, exit constant, deterministic incidents.
7. **D12–D14** — audio/a11y/CDN/sharding.
