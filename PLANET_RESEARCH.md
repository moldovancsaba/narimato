# PLANET SURFACE — research & algorithm choice

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [RND-05](https://github.com/moldovancsaba/narimato/issues/18)
<!-- delivery-ssot:end -->

Goal: a whole explorable planet surface (oceans, coasts, hills, mountains, forests, deserts,
both ice caps) with **low data requirements**, plus geologically plausible resource placement and
a hard rule that deep-water deposits cannot be mined from the surface.

## Findings

1. **Do not ship a heightmap/texture.** A planet-sized bitmap is the opposite of low-data. The
   standard approach is a seeded procedural function: elevation = base sphere SDF + 3D noise, with
   multiple noise octaves for large continents down to local detail ([UPC planet SDF/noise thesis](https://upcommons.upc.edu/server/api/core/bitstreams/64d8fcb3-54a1-46d8-902b-112bdcfb73b6/content),
   [TUM procedural terrain notes](https://collab.dvb.bayern/download/attachments/77832652/Ausarbeitung.pdf)).
2. **Sample noise in 3D, not 2D lat/long.** A 3D noise field sampled at the unit direction avoids
   the pole pinch and the 180° seam of equirectangular heightmaps, and gives seamless wrapping for
   free. This is the same reason icosphere terrain engines generate on the sphere rather than a
   planar map ([OpenGL spherical terrain engine](https://github.com/egeozgul/Procedural-Spherical-Map-generation-using-OpenGL)).
3. **Icosphere + LOD** is the low-bandwidth mesh: start from 20 triangles, subdivide recursively,
   generate only the triangles/patches you need, and normalize vertices to the sphere. Our game
   already uses exactly this geometry, so the terrain layer adds **zero geometry data** — just a
   32-bit seed and a pure function.
4. **fBm + ridged noise** is the cheap recipe for believable relief: several octaves of value/gradient
   noise for continents, plus ridged noise (`1 − |2·noise − 1|`) for mountain chains. Domain warping
   the sample point breaks up the "blobby noise" look ([TUM](https://collab.dvb.bayern/download/attachments/77832652/Ausarbeitung.pdf)).
5. **Biomes from elevation + temperature + moisture.** Elevation above sea level gives land/water;
   a latitude-driven temperature gradient gives poles/equator; a second noise field for moisture
   separates desert/forest/plains. This is the classic climate→biome pipeline used by world
   generators (see biome threshold examples in [SquidLib's world map generator](https://raw.githubusercontent.com/yellowstonegames/SquidLib/51a3312370e09251b25c67835534f458dc4e2d8f/squidlib-util/src/main/java/squidpony/squidgrid/mapping/WorldMapGenerator.java)
   and the procedural-world survey [State of the Art review](https://repositorio-aberto.up.pt/bitstream/10216/106117/2/203102.pdf)).
6. **Oceans are a sea-level threshold.** Every cell below sea level is water; cells far below are
   deep ocean. A separate temperature pass puts ice caps at both poles (including polar sea ice),
   matching the shallow-angle/depth colour treatment used in planet rendering
   ([RPI Miniature Planet Generation](https://www.cs.rpi.edu/~cutler/classes/advancedgraphics/S23/final_projects/gunthz_nelsoe7.pdf)).
7. **Geology drives resources.** Ore deposits are not uniform: orogenic/hydrothermal veins follow
   mountain belts and faults, placers concentrate in coastal/river sediments, evaporites form in
   arid basins, and rare deep/Earth-exotic materials belong in the deepest crust. Resources should
   therefore be weighted by biome/elevation rather than a flat random table (geology reference:
   [Nou.edu mineral deposits notes](http://www.nou.edu.ng/coursewarecontent/ESM%20105%20PDF.pdf),
   [USGS lode-gold summary](https://www.science.gov/topicpages/f/formation-hosted+lode+gold.html)).
8. **Underwater mining rule.** Anything under a deep ocean column cannot be mined from the top
   layer. We enforce this by giving ocean/deep-ocean cells **no surface deposit** at all; coast
   cells are shallow-water placer ground and may hold gold/silver/palladium.

## Chosen low-data design

```
seed (32-bit, stored once)
 └─ p = normalize(triangle centroid)
     q = p + 0.42 · (noise(p·1.6, seed⊕const) − 0.5)        // domain warp
     continent = fBM5(q·1.75 + offsets, seed)                // 5 octaves
     ridge     = 1 − |2·fBM4(q·3.4 + offsets, seed⊕c) − 1|   // mountain ridges
     elevation = (continent − 0.5)·1.9 + (ridge−0.55)·0.6    // clipped −1…1

     latitude  = asin(p.y)
     temperature = 1 − |lat|/(π/2)·1.12 − max(0,elev)·0.55 + noise
     moisture    = fBM4(q·2.2 + offsets, seed⊕c)

     biome = classify(elevation, temperature, moisture)
```

- Sea level `0.1`; deep ocean `< −0.16`; ice when temperature `< 0.17` and elevation `> −0.32`
  (polar ice shelves + caps at both poles).
- 10 biomes: deep ocean, ocean, coast, plains, forest, desert, hills, mountain, peak, ice.
- Per-cell data budget: **one 32-bit seed**, plus the server-persisted resource/tree state that
  would exist anyway. The client caches one small terrain tuple per active cell. No images, no
  vertex heightmaps, no extra network payloads (only `planetSeed` in state).
- Server and browser call the exact same `terrainAt()` from `public/js/shared/planet.js`, so the
  authoritative resource geology and the rendered biome can never disagree.

## Resource geology

| Biome | Deposit chance | Favoured resources |
|---|---|---|
| deep ocean / ocean | **0%** (not mineable) | — |
| coast | 18% | gold, silver, palladium (placers) |
| plains | 25% | silver, gold, uranium, voidglass |
| forest | 20% | silver, uranium, voidglass |
| desert | 24% | gold, voidglass, aetherium, silver |
| hills | 36% | gold, silver, uranium, palladium, iridium |
| mountain | 44% | gold, silver, palladium, iridium, myrthil, adamantium, uranium |
| peak | 50% | iridium, myrthil, aetherium, adamantium, neutronium |
| ice | 16% | iridium, aetherium, neutronium, silver |

## Calibration (320-face icosphere, seed 0xA1B2C3D4)

~32% ocean + ~6% deep ocean, ~17% ice (both caps), ~7% coast, ~5% plains, ~3% forest,
~1% desert, ~22% hills, ~12% mountains, <1% peaks. Both poles classify as ICE CAP.
