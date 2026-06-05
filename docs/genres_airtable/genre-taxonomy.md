# Genre Taxonomy

Canonical genre reference for the talent-scout system. Genres are used for
**within-genre normalization** (an artist is z-scored against peers in the same
family, not the whole roster) and as the basis for **genre-specific weighting**.
Keep this file in sync with the genre tags in the Airtable.

---

## Primary genres (single tag)

Grouped by family. Family grouping is what normalization runs against; the exact
strings below must match the Airtable tags verbatim.

### House
- house
- tech house
- minimal house
- afro house

### Techno
- techno
- progressieve techno
- commerciële old school techno
- commerciële new school techno

### House/Techno crossover
- left field house & techno

### Trance / Bounce
- Bounce / trance

### Melodic
- Melodic

### Garage / Bass
- UKG
- Drum & Bass

### Other
- hip-hop
- Hardcore
- Dub / reggae
- Live

---

## Combination tags (primary + secondary)

Some artists carry two genre tags. The table below is **canonicalized**: each
pair is sorted alphabetically (case-insensitive) so that, e.g., `tech house,
minimal house` and `minimal house, tech house` count as one genre. Counts are
summed across the original orderings.

| Combination | Count |
|---|---|
| minimal house, tech house | 5 |
| Bounce / trance, house | 3 |
| Melodic, techno | 3 |
| Bounce / trance, left field house & techno | 3 |
| Melodic, tech house | 2 |
| afro house, house | 1 |
| house, tech house | 1 |
| Bounce / trance, UKG | 1 |
| house, minimal house | 1 |
| left field house & techno, minimal house | n/a |

> Three pairs (`Melodic, techno`, `Bounce / trance, left field house & techno`,
> `minimal house, tech house`) gained count after merging duplicate orderings —
> proof the canonicalization matters before any per-genre stats are computed.

---

## Conventions

These rules keep per-genre statistics clean. Apply them at ingestion.

1. **Canonicalize combination order.** Sort the two tags alphabetically
   (case-insensitive) and store as a single canonical key. Never let the same
   pair exist in two orderings.

2. **Commercial is an axis, not a genre.** `commercieel` appears standalone, as
   `Melodic commercieel`, and inside `commerciële old/new school techno`. Model
   commercial-vs-underground as a **separate boolean flag** on the artist, not as
   part of the genre tag. This keeps genre families clean and gives a free
   feature (commercial acts behave differently on the growth signals).

3. **Casing (optional cleanup).** Tags are inconsistently cased (`house`,
   `Melodic`, `UKG`). If you normalize casing, do it once at ingestion and update
   this file and the Airtable together so matching never breaks.

---

## Open question

For the combination tags: does the second tag mean *the artist plays both
styles*, or is it a *sub-style of the first*? This decides whether an artist is
normalized against one peer group or a blend of two. Resolve before building the
weighting layer.
