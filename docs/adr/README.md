# Architecture Decision Records

Architecture decisions are durable, dated and append-only. The **decision text never changes** in
place: a changed decision gets a new ADR that supersedes the old one (only its `superseded_by`
line is edited). Status is the only mutable field.

Every ADR carries the issue keys it governs. Keys must exist in [docs/ISSUE_MAP.md](../ISSUE_MAP.md);
the delivery board owns their status.

To propose an ADR: copy [TEMPLATE.md](TEMPLATE.md), use the next free number, add a row to the
index below in number order, and open the implementing issue first (delivery SSOT, ADR-0006).

| Number | Title | Status | Keys |
|---|---|---|---|
| [0001](0001-zero-npm-runtime-dependencies.md) | Zero npm runtime dependencies | Accepted | SSOT-01, OPS-03 |
| [0002](0002-gds-react-island-boundary.md) | GDS-only DOM UI through a dev-time React island boundary | Accepted | UI-01, UI-02, UI-03, UI-04, UI-05, A11Y-01 |
| [0003](0003-single-scene-camera-only-surface.md) | One spherical icosahedron, one renderer, camera-only surface change | Accepted | RND-01, RND-02, RND-03, RND-04, RND-06 |
| [0004](0004-authoritative-server.md) | Authoritative server for all game state | Accepted | SRV-01, SRV-02, SRV-03, SRV-04, TST-01 |
| [0005](0005-json-atomic-persistence.md) | JSON-file persistence with atomic rename | Accepted | OPS-03 |
| [0006](0006-delivery-ssot-github-issues.md) | Delivery SSOT in GitHub Project issues; docs own durable knowledge | Accepted | SSOT-01, SSOT-02, SSOT-03, SSOT-04, DOC-01, REL-01 |

## Conventions

- File name: `NNNN-kebab-case-title.md`, zero-padded to four digits, gaps never reused.
- Front matter: `status`, `date`, `supersedes`, `superseded_by`, `keys`.
- Status: `Proposed` | `Accepted` | `Superseded` | `Rejected`.
- `Superseded` requires `superseded_by`; `Accepted` requires at least one key.
- Sections: Context, Decision, Consequences, Alternatives considered, Links.
- A decision that changes an accepted boundary must cite the superseded ADR.

`test/adr.test.js` enforces the numbering, front matter, index coverage and key existence; CI runs
it with the rest of the suite.
