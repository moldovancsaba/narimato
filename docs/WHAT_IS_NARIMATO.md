# What is Narimato — and what is not?

This page is for **everyone**, not only developers. It explains which folders and tools belong to **Narimato**, and which are **separate projects** on your computer or online.

## One sentence

**Narimato** is the survey / card-ranking product (website + local setup tools). **Other folders** (GDS, Amanoba, Camera, etc.) are **different products** unless you copied something from them *into* Narimato on purpose.

## Picture on your disk

Think of each project as its **own folder** (its own “house”):

```text
Your computer (examples — paths may differ on your Mac)

  /Users/Shared/Projects/narimato/   ← THIS PROJECT (canonical Narimato repo)
  ~/Projects/amanoba/           ← Different project (not Narimato)
  ~/Projects/camera/            ← Different project (not Narimato)
  ~/…/GENERAL_DESIGN_SYSTEM/    ← Different project (GDS — design rules + UI kit)
```

- Opening or editing files **inside** `narimato` = working on Narimato.
- Opening **Amanoba**, **Camera**, or **GDS** = working on something else. Changes there do **not** automatically change Narimato.

## What belongs to Narimato (inside this folder)

Only what lives in **this repository** (the `narimato` directory you cloned or opened in the editor).

| Belongs to Narimato | Plain meaning |
|---------------------|---------------|
| `pages/`, `components/` | What visitors see: landing page, play, results, legal pages |
| `components/operator/` | **Local setup** screen on your Mac (`http://127.0.0.1:10006`) — organisations, survey password, cards |
| `lib/`, `scripts/` | How the app talks to the database, runs jobs, tests |
| `packages/gds-core`, `packages/gds-theme` | **Copies** of design-system building blocks **used by** Narimato (see below) |
| `docs/` (here) | Narimato’s own documentation |
| `.env.local` (on your machine, usually **not** in git) | Your private database password and secrets for **Narimato only** |

**Narimato on the internet**

| Thing | Belongs to Narimato? |
|-------|----------------------|
| [narimato.com](https://www.narimato.com) (public site) | Yes — this is the live Narimato product |
| MongoDB Atlas database used by Narimato | Yes — Narimato’s data (organisations, cards, plays) |
| Local setup at `127.0.0.1:10006` | Yes — part of Narimato’s operator tools on your computer |

## What does **not** belong to Narimato

These are **separate**. Narimato may **use** or **follow** them, but they are not “inside” the Narimato project.

| Not Narimato | What it is |
|--------------|------------|
| **General Design System (GDS)** | Its own project: [general-design-system](https://github.com/sovereignsquad/general-design-system). Design rules and shared UI components. Narimato **imports copies** into `packages/gds-*`; the full GDS repo stays elsewhere. |
| **Amanoba** | Another product folder on your disk — not Narimato |
| **Camera** (or any other app folder) | Another product — not Narimato |
| **Mantine**, **Next.js**, **MongoDB** | Third-party tools Narimato is **built with** (like electricity in a house — not the house itself) |
| **Vercel**, **GitHub** | Hosting and code storage — services Narimato uses |

### GDS in simple terms

- **GDS** = shared “look and feel” rulebook + component library (separate git project).
- **Narimato** = the actual survey app.
- Narimato **follows** GDS for buttons, colours, and patterns.
- When designers update GDS, a developer **copies new built files** into Narimato (`npm run gds:sync`) and commits them. GDS does not live inside Narimato as one merged project.

Details for developers: [GDS_ADOPTION.md](./GDS_ADOPTION.md).

## How to know “am I in the right project?”

| You are working on Narimato if… | You are **not** on Narimato if… |
|--------------------------------|----------------------------------|
| Your editor’s root folder is `…/narimato` | Root folder is `amanoba`, `camera`, `GENERAL_DESIGN_SYSTEM`, etc. |
| You change the public site or local setup `:10006` | You change another app’s screens or database |
| Git commits go to the **narimato** repository | Commits go to another repo |

**Rule of thumb:** If the file path does not start with your **narimato** project folder, it is not part of Narimato.

## What Narimato is responsible for (product)

- Survey password on the public site  
- Card decks and play / ranking for an organisation  
- Local **setup** on your computer (organisations, sample survey, passwords)  
- Storing organisations, cards, and play sessions in **Narimato’s** database  

## What Narimato is **not** responsible for

- How Amanoba or Camera work  
- Changing GDS for all products (that is done in the GDS project; Narimato only updates its **copies** when needed)  
- Other companies’ websites or apps  

## If something breaks — quick check

1. **Public site** (narimato.com or `localhost:3000`) — Narimato app + database + deployment.  
2. **Local setup** (`127.0.0.1:10006`) — Narimato operator tools; must be started on your Mac (`npm run intelligence:guardian` or similar).  
3. **Wrong colours / buttons** — may need a GDS package refresh in Narimato (`gds:sync`), still **two** projects.  
4. **Another folder** (Amanoba, etc.) — not Narimato; ask whoever owns that product.

## More detail (technical)

- [GDS_ADOPTION.md](./GDS_ADOPTION.md) — how Narimato uses the design system  
- [README.md](../README.md) — install and run  
- [narimato_unified_documentation.md](../narimato_unified_documentation.md) — full product specification  
