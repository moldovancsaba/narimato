# NARIMATO — Spherical Geometry & Face Numbering Algorithm

> Current mode: **INFINITE GRID** (`SPEC_INFINITE.md`). The sphere is a persistent adaptive tree:
> any active cell can break individually after `BREAK_CLICKS` clicks; children inherit owners.
> Sections 1–3 below are the geometry/numbering foundation; section 5 explains the adaptive tree.

Everything here is implemented in [`public/js/shared/geometry.js`](public/js/shared/geometry.js),
shared by the browser renderer, the click picker, and the Node game server.

## 0. Physics & interaction model

Authoritative source: [narimato-physics.md](narimato-physics.md). Geometry/control essentials:

- Object = the base 20-face spherical icosahedron; render the same triangles at every altitude.
- Camera = carrier on a concentric orbit; cursor keys move the carrier, wheel changes carrier radius.
- Mouse rotates the object via exact surface-point follow:
  `axis = cross(P0,P1)`, `angle = acos(dot(P0,P1))`, `objectQ = axisAngle(axis,angle) · objectQ0`.
- Unprojection: `dirCam = normalize(X, Y, -focal)` (negative Z into scene), then `unprojectView`.
- Keep object and camera transforms separate.

## 1. Base spherical icosahedron (regular)

Cartographic coordinates (degrees, north pole = +Y, longitude 0° = +X):

| id | latitude | longitude |
|---|---|---|
| `N` | +90.0000 | 0.0000 |
| `S` | −90.0000 | 0.0000 |
| upper ring `U0…U4` | +26.5650511771 (= atan ½) | 0, 72, 144, 216, 288 |
| lower ring `L0…L4` | −26.5650511771 | 36, 108, 180, 252, 324 |

20 outward-oriented faces:
- 5 north-cap: `(N, Uᵢ, Uᵢ₊₁)`
- 5 upper-belt: `(Uᵢ, Uᵢ₊₁, Lᵢ)` — lower vertex **between** the upper endpoints
- 5 lower-belt: `(Lᵢ, Lᵢ₊₁, Uᵢ₊₁)` — upper vertex **between** the lower endpoints
- 5 south-cap: `(S, Lᵢ₊₁, Lᵢ)`

Properties (asserted in the tests): 12 vertices, 30 edges, every edge **63.4349488°**
(the central angle `acos(1/√5)`), every vertex degree 5, 20 congruent spherical faces of area
`4π/20`.

## 2. Subdivision — four spherical triangles from one

Given unit vectors `A, B, C` (a face) and their great-circle arc midpoints:

```
AB = normalize(A + B)
BC = normalize(B + C)
CA = normalize(C + A)
```

`normalize(A+B)` is the exact midpoint of the great-circle arc, so this keeps every new vertex
consistent with its neighbours. The four children are exactly:

```
structural child 0 = (A,  AB, CA)      corner at A
structural child 1 = (AB, B,  BC)      corner at B
structural child 2 = (CA, BC, C)       corner at C
structural child 3 = (AB, BC, CA)      central child
```

Repeating this `L` times gives `20 · 4^L` triangular faces: **20 → 80 → 320 → 1280**.
The structural order is kept stable so that, in the face array, the children of face `p` are
always ids `4p … 4p+3` at the next level.

Spherical area of a face (van Oosterom–Strackee):

```
area = 2 · atan2( |A · (B × C)|,  1 + A·B + B·C + C·A )
```

## 3. Hierarchical face numbers

- Level 0 faces are numbered **1 … 20** in the fixed order above (all 20 congruent).
- When a face subdivides, its four children are numbered **1 … 4** using this rule, computed in
  the parent face's own local tangent chart (so the numbers are stable no matter how the sphere
  is rotated on screen):
  1. `G = normalize(A+B+C)` — parent centroid (local chart origin).
  2. Right-handed tangent frame:
     `e1 = normalize(A − (A·G)G)`, `e2 = normalize(G × e1)`.
  3. Gnomonic coordinates of each child centroid `P`:
     `(x, y) = (P·e1 / P·G,  P·e2 / P·G)`.
  4. **Child 1** = the corner child with the **largest `x + y`** (ties: larger x, larger y,
     then lower structural index).
  5. **Children 2 and 3** = the remaining corner children in **clockwise** order around `G`
     starting from child 1 (decreasing polar angle in the chart).
  6. **Child 4** = the central child (the one containing `G`).

A face's identifier is the dot-joined path from the base face down to the leaf:

```
11            base face 11 (level 0)
11.4          its child 4 at level 1
9.2.1         base 9 → child 2 → child 1 (level 2)
9.2.1.1       one more level (level 3)
```

Every continuation digit is `1…4` because subdivision is four-way. An id such as
`9.2.1.1.5` cannot occur — the last digit would have to be 1–4.

`face.id` stays a numeric array index for the wire protocol; `face.label`, `face.path`,
`face.depth` and `face.parentId` carry the numbering:

```js
import {
  buildMesh, childLabelOrder, parseFaceLabel, resolveFaceLabel, faceLabel,
} from './shared/geometry.js';

mesh.faces[17].label;                 // e.g. "18" at level 0, "8.3" at level 1
faceLabel(1, 33);                     // "9.2"
parseFaceLabel('9.2.1.1');            // { path:[9,2,1,1], label:'9.2.1.1', level:3 }
resolveFaceLabel(2, '9.2.1');          // numeric face id at level 2 (or null)
childLabelOrder(a, b, c);             // [labelForCornerA, …CornerB, …CornerC, centre=4]
```

## 4. Rendering and picking (must match the sphere)

- Face boundaries are tessellated with `slerp(a, b, t)` at ≤ 7.5° steps and drawn as closed
  great-circle polygons — never straight chords between projected vertices.
  (At fine levels the seam step is coarser because a 16° face is already visually flat; the
  number labels are the authoritative identifiers.)
- Picking casts the camera ray, intersects the unit sphere, and accepts a face only if the hit
  lies on the inner side of all three great-circle edge planes (`A×B`, `B×C`, `C×A`), matching
  the curved visual exactly.

## 5. Why a local chart, not screen coordinates?

“Largest horizontal + vertical coordinate, then clockwise” is executed in the parent face's own
tangent plane. If it used the live screen projection, the same face would change its number every
time the camera rotated, which defeats identification. The local chart is a fixed mathematical
property of the face, so `11.4` denotes the same triangle on every client, in every round, at
every camera angle.


## 6. Adaptive infinite tree (current game mode)

The server's world is a sparse tree; the 20 base cells are roots and only cells that players
charge are ever subdivided:

```
base face p (depth 0)
  └─ after BREAK_CLICKS clicks: children p.1 … p.4 (depth 1, owner inherited, charge 0)
       └─ any child that gets BREAK_CLICKS clicks breaks in isolation → depth 2
            └─ … up to MAX_DEPTH (default 24)
```

- Only the clicked leaf is replaced; sibling leaves and all other branches are untouched.
- Children get their labels from `childLabelOrder(a,b,c)` (largest local x+y → clockwise →
  centre = 4) and their geometry from `childTriangles(a,b,c)`.
- At `MAX_DEPTH` a cell keeps accepting clicks/score but never breaks further.
- The leaf set is what clients render and pick; internal cells keep no terrain and are not
  clickable.
- Persistence stores players + labels/owners/charges; geometry is reconstructed deterministically
  from labels with `childTriangles`, so the world is exact across restarts.
- Camera zoom (`0.4 … 16777216`) plus double-click focus lets players go from the whole sphere down
  to the deepest leaf; labels (`9.2.1`) identify every cell at any zoom.
