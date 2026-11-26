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
- The amount rotated is the actual angle to that centre; it is **not 90°** and not a fixed increment.
- The gamer may turn **as many times as needed**, through all available edge-neighbours.
- The gamer may face the **previous triangle** and press forward to go back to it.
- There is **no “previous triangle excluded” rule**, no turn limit and no forced forward direction.

## 3. Forward movement

- From the current triangle, consider the edge-neighbour centres in front of the gamer.
- Move to the closest valid centre in front.
- On arrival, the camera/gamer turns to face the **closest next triangle centre**.
- If more than one next centre is equally close, the camera turns to the one on the **right** of the
  current facing direction.
- The triangle just left is included in the possible next centres.

## 4. Backward movement

- Move to the closest edge-neighbour centre **behind** the gamer.
- If more than one is equally close behind, choose the one on the **left behind**.
- The previous triangle is included in the possible centres.
- On arrival, the camera faces the closest next triangle centre; equal choices go to the **right**.

## 5. Animation and input

- Every move and every turn takes **0.5 seconds**, regardless of triangle size.
- Movement paths are spherical Bézier curves between the two centres; turns use the same eased
  rotation convention.
- The next move/turn is accepted only when the previous one completes. One input may be buffered.
- The gamer can rotate arbitrarily many times before moving.

## 6. Current four-option bug — explanation

The current implementation has four keyboard directions and selects one highest-scoring leaf centre
from **all active leaves** per direction. Those four triangles are arbitrary global winners, not the
current triangle’s edge-neighbours. The true next set is the current triangle’s edge-contact
neighbours: 3 in a conforming area, more when split sides create partial-edge contacts (up to 24 under
the current hierarchy). A fixed four-option set is wrong.

## 7. Open points — do not invent an answer

These have not been confirmed yet; implementation must wait for a decision:

1. If more than one valid centre is equally close **in front**, which target rule applies before
   moving? (The camera tie-break after arrival is confirmed: right.)
2. After a **backward** arrival, does the camera turn to the closest next centre with the same tie
   rules as forward?
3. Is “closest” measured by centre-to-centre angular distance or by the shortest turn from the
   current facing? Both must be defined explicitly before coding.
4. If the current triangle has several edge-neighbours along one split side, how are left/right
   choosing among them? All valid edge contacts are neighbours; the selection order still needs a rule.
5. How does surface camera mouse-out interact with the four camera distances? The camera must stop at
   every distance; the default surface stage and the extra surface dolly need one state model.

## 8. Implementation status

**Not implemented.** Current `v2/public/app.js` selects global centres by four directional scores and
has no edge adjacency graph. This document is the movement contract, not a claim that the live build
matches it.
