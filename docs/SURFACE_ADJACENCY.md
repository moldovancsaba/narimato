# Surface movement and triangle adjacency — confirmed rules

**Status: confirmed by the user on 2026-11-26. Documentation only; implementation pending.**
This document corrects earlier invented rules. Do not add restrictions that are not written here.

## 1. Neighbours — edge contact only

- Two triangles are neighbours **only if they contact along an edge**.
- A triangle with only full, matching edges has exactly **3 edge-neighbours** — the maximum in a
  conforming triangulation.
- The current 4-level split hierarchy is **non-conforming**: a side can be split into multiple child
  edges, so one active triangle can border several smaller active triangles on the same side.
- Derived maximum under the current four-level hierarchy: a level-1 triangle whose three sides are
  fully bordered by level-4 children can have **3 × 2³ = 24 edge-neighbours**. Other levels have
  smaller maxima (level 2: 12, level 3: 6, level 4: 3). This follows from edge-contact plus the
  current split depth; it is not an extra rule.
- Vertex-only contact is **not** a neighbour for this game.

## 2. Turning — no fixed angle

- Left/right rotate only to the **next possible triangle centre** on that side.
- Every edge-neighbour centre is a candidate, including every child centre along a split side.
- Choose the candidate on that side requiring the **shortest turn from the current facing**.
- The amount rotated is the actual angle to that centre; it is **not 90°** and not a fixed increment.
- Ties are not expected by design; if several candidates tie, choose the one on the **right**.
- The gamer may turn **as many times as needed**, through all available edge-neighbours.
- The gamer may face the **previous triangle** and press forward to go back to it.
- There is **no “previous triangle excluded” rule**, no turn limit and no forced forward direction.

## 3. Forward movement

- From the current triangle, consider the edge-neighbour centres in front of the gamer.
- Choose the valid centre requiring the **shortest turn from the current facing**.
- If more than one is equally close by shortest turn, choose the one on the **right**.
- Move to that centre.
- On arrival, the camera rig turns to the **next possible forward direction** — literally aims at
  that next centre — if it is not already aimed at the front of that triangle.
- If multiple next directions require an equal turn, choose the one on the **right**.
- The triangle just left is included in the possible next centres.

## 4. Backward movement

- Consider only edge-neighbour centres **behind** the gamer.
- Choose the one requiring the **shortest turn from the current facing**.
- If more than one is equally close behind, choose the one on the **left behind**.
- The previous triangle is included in the possible centres.
- On arrival, the camera rig turns to the next possible forward direction, exactly as after a forward
  move; equal choices go to the **right**.

## 5. Animation and input

- Every move and every turn takes **0.5 seconds**, regardless of triangle size.
- Movement paths are spherical Bézier curves between the two centres; turns use the same eased
  rotation convention.
- The next move/turn is accepted only when the previous one completes. One input may be buffered.
- The gamer can rotate arbitrarily many times before moving.

## 5a. Orbit camera: free planet rotation, snap on release

- In orbit, dragging rotates the **planet under the camera**. Only the planet rotates; the camera rig
  does not orbit around it.
- Dragging is free rotation and does **not** change camera distance.
- When the user stops dragging and releases the cursor, with no further mouse/touchpad/screen input,
  the planet rotates/snap so the camera view centre lands on the **closest active triangle centre**.
- The snap follows the **shortest turn from the current facing**.
- If multiple triangle centres are equally close, choose the **right-hand** one.
- This snap happens at **every orbit distance**.
- On the surface, the planet is **not rotatable with the mouse**.
- The four camera distances still stop at every distance; drag never bypasses or changes them.
- **Orbit arrows/WASD are the approved free orbit movement, not triangle stepping.** While held
  they freely turn/move the camera around the planet exactly as the approved build did; they do not
  change camera distance. When the arrow/WASD input stops (keys released), the planet snaps to the
  closest active triangle centre exactly like mouse release: shortest turn, ties right, at every
  orbit distance.
- **Surface arrows** use the edge-neighbour movement in this document; the surface planet is not
  mouse-rotatable.

## 6. Current four-option bug — explanation

The current implementation has four keyboard directions and selects one highest-scoring leaf centre
from **all active leaves** per direction. Those four triangles are arbitrary global winners, not the
current triangle’s edge-neighbours. The true next set is the current triangle’s edge-contact
neighbours: 3 in a conforming area, more when split sides create partial-edge contacts (up to 24 under
the current hierarchy). A fixed four-option set is wrong.

## 7. Camera distance steps and remaining implementation constants

- **Surface wheel/pinch stops at discrete distance steps.** Each step settles and stops; it must not
  drift continuously. Range: 1.02–1.70 R, default 1.15 R. Exact step interval/sequence is an
  implementation constant, not a new movement rule.
- The four orbit/landing camera distances are discrete and stop at every distance.
- Orbit drag and orbit arrow movement do not change distance.
- No other movement/camera behaviour remains unspecified.

## 8. Implementation status

**Not implemented.** Current `v2/public/app.js` selects global centres by four directional scores and
has no edge adjacency graph. This document is the movement contract, not a claim that the live build
matches it.
