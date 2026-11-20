# NARIMATO — Quick Guide

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [UI-03](https://github.com/moldovancsaba/narimato/issues/9) · [CTL-05](https://github.com/moldovancsaba/narimato/issues/30) · [STR-02](https://github.com/moldovancsaba/narimato/issues/36)
<!-- delivery-ssot:end -->

> **Generated blocks:** the marked prose in this document is rendered from
> `public/js/story-copy.js`; edit the module and run `node scripts/sync-story-copy.mjs --write`.

Share this with a new pilot. In game, press **GUIDE** (or open `?guide=1`) for the same card.

## 1. What to mine

The **THE WAY HOME** panel lists every part the ship still needs.
- **FUEL RODS**, **HULL PLATES**, **WARP CORE** each show what is still missing.
- **RARE** means a rare material.
- **WHAT WE’RE CARRYING** shows the ore you already hold; it travels with you.

## 2. How to mine

- Click or tap a triangle to charge it.
  <!-- story-copy:start guide-mining -->
  Each planet has **one break threshold**: the first world breaks a triangle at **4 clicks**; deeper worlds ask for **8**. Reach the threshold and that triangle splits into four smaller cells; the children start charging from zero.
  <!-- story-copy:end guide-mining -->
- Keep breaking deeper to find richer ground.
- The contest lock is always on: after your click, another operator must contest the cell before
  you can charge it again. If no human is around, the game staffs robots; one will prioritise
  your locked cell and contest it.

## 3. Where to dig

- Ore is hidden; it can appear on a random click.
- Follow the gold **NAV** beacon to the best nearby ground.
- Double-click a cell to focus the camera; use **Wheel/pinch** to zoom through D0/D1/D2 levels.
  Clicking or breaking a cell does **not** change zoom automatically.

## 4. How to leave

- Fill every system until the panel says **LOADED**.
- The central **TRY TO FLY AWAY** button opens.
- Take it to reach the next planet.

## Surface mode

Scroll one notch past the deepest zoom (or pinch outward) to land. The ship descends, then you run
the small planet in third person. A lap takes **60 seconds** at normal speed. The surface view draws
only the live cell triangles; mining/breaks update them and other surface pilots appear and walk in
the same view. Green triangles can be harvested; red ones are locked or empty. Your footprint
harvests every cell under the avatar. Use `WASD`/arrows to run, `A/D` to turn, `Shift` to sprint,
and **RETURN TO ORBIT** or Escape to leave.

## If you get stuck

- **Mouse drag** rotates the planet with your cursor (drag left → planet left), even upside down.
- **Arrow keys** travel around the planet in the opposite direction (left arrow → planet right);
  **Shift** speeds up travel.
- Press **I** to reverse mouse drag.
- **? / GUIDE** opens this card again; **OPEN FIELD MANUAL** has the full story and controls.
- **Relief ship:**
  <!-- story-copy:start guide-relief -->
  If you make no refit progress for **two minutes**, a relief ship crashes onto the planet and scatters the missing ore across marked triangles. It repeats every two minutes while parts are still missing.
  <!-- story-copy:end guide-relief -->

## Early planets

Rare requirements are deliberately gentle on the first worlds:
<!-- story-copy:start guide-rare -->
- Planet 1: exactly **one** rare unit.
- Planet 2: exactly **one** rare unit.
- Planet 3: up to **two** rare units.
- Planet 4: up to **three** rare units.
- Deeper worlds can demand more rare material.
<!-- story-copy:end guide-rare -->
