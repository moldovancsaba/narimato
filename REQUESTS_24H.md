# NARIMATO — 24-Hour Request & Delivery Status

**Window:** 2026-11-18 → 2026-11-19  
**Current:** `v3.37.0`  
**Source of truth for engineering gaps:** [ROADMAP.md](ROADMAP.md)

Legend: **Delivered** = shipped and verified; **Partial** = visible/shipped but not the full
requested behaviour; **Open** = not delivered; **Superseded** = delivered then corrected.

| # | Request | Status | Release / notes |
|---|---|---|---|
| 1 | More story, less under-the-hood UI; improve Elephant–Goldfish | Delivered | v3.12; Captain's Log, human labels, incidents; subjective sign-off still yours |
| 2 | Emergency supply/crashed ship when missing ore for 2 min | Delivered | v3.12/v3.13/v3.19; repeats, 2-minute gate tested |
| 3 | More rare elements | Delivered | v3.12; guaranteed rare per refit |
| 4 | Major planet colours | Delivered | v3.12; eight palettes |
| 5 | Reverse cursor movement | Superseded | v3.13 reverse; v3.21 made mouse direct + arrows inverse |
| 6 | Smoother/faster cursor navigation | Delivered | v3.13/v3.16; eased arrow travel, Shift boost |
| 7 | Voice/audio disappears after 1–2 min | Delivered desktop; real-device open | v3.13 watchdog/resume; 2-min desktop check |
| 8 | Limitless rotation through poles | Delivered | v3.14 quaternion trackball |
| 9 | Zoom levels with fast bezier steps | Delivered | v3.15; manual-only from v3.20 |
| 10 | Separate mouse rotation vs cursor travel | Delivered | v3.16; later direct/inverse corrected v3.21 |
| 11 | Incident explanations (alien/meteor/solar/nuclear) | Delivered | v3.17; story descriptions + Captain's Log |
| 12 | Key information / shareable help | Delivered | v3.18; GUIDE button, `?guide=1`, GUIDE.md |
| 13 | Fewer required rare elements on early planets | Delivered | v3.18; early caps |
| 14 | Supply available to all humans, camera turns to impact | Delivered | v3.19; server broadcast + camera turn |
| 15 | Five-tetrahedron ship; lands/arrives/departs; solar sun; alien ships | Delivered | v3.23; triangle fleet |
| 16 | Surface landing + walk on small planet, 60s lap, auto-harvest | Delivered | v3.24 onward |
| 17 | Surface uses live triangles only, no generated geography | Delivered | v3.25–v3.31; active cells, spherical arcs, opaque shell |
| 18 | Same planet geography/visual experience as orbit | **Partial** | Same active cells, terrain/owner palette, cyan edges; still a separate surface renderer (ROADMAP P0) |
| 19 | All players/robots visible walking on surface | **Partial** | Human peers synced; remote robots use independent visual routes/beams; authoritative robot surface positions/mining not mapped (ROADMAP P0) |
| 20 | Robots should walk their own generated paths, turn, mine | **Partial** | Independent Lissajous routes + mining beams; visual only, not server-authoritative cell targets |
| 21 | Robots/players mining and triangles changing while walking | **Partial** | Cells update from server events; footprint harvesting speed increased; robot mining is visual, not authoritative surface actions |
| 22 | Remove orbital UI from surface | Delivered | v3.30/v3.33; surface owns screen |
| 23 | Surface HUD visible/not clipped | Delivered | v3.33/v3.35; center-safe HUD, central NEED/target lines |
| 24 | Surface entry after 4th zoom level | Delivered | v3.30/v3.33 |
| 25 | Seamless movement across poles | Delivered | v3.29/v3.30; parallel transport + tests |
| 26 | Green/red harvest semantics | Delivered (current) | v3.35/v3.36: only target cell green/red; GREEN TARGET = harvest, RED TARGET = locked |
| 27 | Resource pins only where mineable, not a pin forest | Delivered | v3.36; target + known supply pins only; hidden resources intentionally unexposed |
| 28 | Return to orbit at maximum zoom-out | Delivered | v3.33; zoom 0.4 |
| 29 | Roadmap/README/release notes/comments audit | Delivered | v3.35/v3.36; ROADMAP + updated docs |
| 30 | List all requests and delivery status | Delivered | This document + final response |

## Critical remaining gaps

1. **Surface is not yet literally the orbital renderer with a changed camera.** It consumes the same
   active cells/terrain/owner data but is a separate Canvas implementation. This is the main P0.
2. **Robot surface mining is visual.** Robots walk independent paths and show beams; their surface
   pose/target cell is not yet authoritative or mapped to their server click.
3. **Hidden resources remain hidden.** Pins are target/supply only by design; showing all resources
   requires a server secrecy-model change.
4. **Manual real-device/audio gate, story voice cues, CDN activation, sharding/peer assets** remain
   open as documented in ROADMAP.
