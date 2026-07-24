# Design notes

This is the reasoning behind the code — why the pieces look the way they do, and where the
sharp edges are. I'd rather be upfront about the limitations than oversell the precision.

## Goal, and the constraint that shaped everything

Build a graph of Harry Potter entities and relations that's rich enough to explore and pull
insights from, in a small time box. That budget pushed every decision toward **simple and
legible over clever**: no ML model to train or ship, no database, no client-side graph
framework. A text file goes in, a self-contained HTML report comes out.

## Entity extraction: a curated gazetteer

I went with a hand-curated gazetteer (`gazetteer.ts`) rather than statistical NER.

**Why.** For a fixed, well-documented universe like these books, a closed vocabulary is the
highest-precision option available and it's trivial to reason about. spaCy-style NER would
buy recall on minor/unnamed entities, but at the cost of a dependency, slower runs, and a
long tail of false positives ("Uncle", "Sunday", "Muggle-borns") that I'd then spend the
rest of the budget cleaning up. For 150-ish entities that a reader can eyeball, curation wins.

**Alias resolution** is the important half. Each entity carries every surface form it appears
under, and they collapse to one canonical node:

- `Harry` / `Potter` / `Mr. Potter` → **Harry Potter**
- `Dumbledore` / `Albus Dumbledore` / `Professor Dumbledore` → **Albus Dumbledore**
- `Voldemort` / `You-Know-Who` / `Tom Riddle` → **Lord Voldemort**

Matching is one big alternation regex, **case-sensitive**, longest-alias-first. Case matters:
the books keep their capitalisation, so matching `Black`, `Wood` or `Fang` case-sensitively
stops the common-noun senses ("a black cloak", "touch wood") from leaking in. Longest-first
ordering means `Professor McGonagall` is preferred over a bare `McGonagall`.

### Precision & recall, honestly

- **Precision is high.** The vocabulary is closed and hand-checked, so false entities are
  rare. The residual risk is alias collision — a name that's also a common word. I dodged the
  worst offenders (I deliberately do *not* alias `Weasley` alone, because it's ambiguous
  across a whole family; `Black` maps only via `Sirius Black`/`Sirius`). Case-sensitivity
  handles most of the rest.
- **Recall is bounded by the list.** Anything I didn't enumerate is invisible. Rather than
  pretend that gap away, `extract.ts` runs a **discovery pass**: it counts capitalised tokens
  that *aren't* in the gazetteer and the build prints the top ones. On this corpus that
  surfaces `Quidditch`, `Dursleys`, `Muggle`, `Goyle`, `Firebolt`, `Snitch`… — a ready-made
  to-do list for extending coverage, and an honest measure of what's being missed.

This is the classic precision/recall lever: I chose precision, and made the recall cost
observable instead of silent.

## Relations

Three relation types, each with a different confidence level — kept separate on purpose so
the strong signal isn't diluted by the weak one.

1. **Co-occurrence** (`cooccurs`, weighted). Two entities linked if they appear in the same
   sentence; the weight is how often. This is the backbone and it's the most reliable signal —
   though it's an *association* proxy, not proof of interaction. Sentence-scoping (rather than
   paragraph or a fixed token window) keeps links tight and meaningful.

2. **Spell-casting** (`casts`, directed). Each spell mention is attributed to the nearest
   preceding character in the same sentence. A heuristic — it'll misfire on "Harry watched
   Snape cast *Expelliarmus*" — so it's framed in the UI as a hint, and kept out of the
   structural metrics.

3. **Dialogue** → words spoken per character. Quoted spans are matched against reporting-verb
   patterns in both orders (`"…," said Harry` and `Harry said, "…"`, with an optional adverb).
   Single-word quotes are dropped so emphasised terms don't masquerade as speech.

   **Attribution rate ≈ 25%.** That sounds low, and the reason is honest: a lot of dialogue is
   tagless back-and-forth where the speaker is only inferable from context a paragraph away —
   out of reach of a local pattern. The lines I *do* attribute are high-precision, so the
   relative ranking of "who talks most" holds up even though the absolute counts undercount.

## Graph & analysis

`graphology` models the network; three standard algorithms do the analysis:

- **Betweenness centrality** — how often a node sits on the shortest path between two others.
  This is what powers the headline insight: the biggest *connector* isn't the most *mentioned*
  character.
- **Louvain community detection** — run on co-occurrence alone, with no knowledge of the
  canon. It still recovers house/Weasley/staff-shaped clusters, which is a nice validation
  that the co-occurrence signal is real.
- **ForceAtlas2 layout**, computed at build time. Positions are baked into `data.js`, so the
  browser renders a fixed layout instead of shipping a physics engine. This is the single
  decision that lets the report stay dependency-free.

## The report

One HTML file, one generated data file, hand-rolled canvas graph, CSS-bar charts. No CDN, no
framework.

**Why no library (sigma/d3/vis).** Because the layout is already baked, the client only needs
to draw circles and lines and hit-test clicks — a couple hundred lines of canvas. Pulling in a
graph library would add weight and a vendoring/offline story for no real gain. The trade-off:
I hand-wrote pan/zoom/picking, which is more code than `<Sigma/>` but keeps the whole thing a
file you can email.

Interactions: pan/zoom, click-to-inspect (with neighbour highlighting), colour by type or by
community, filter by entity type, by book and by **type-pair**, and a minimum-link-strength
slider to peel the graph back to its strongest ties.

**Putting the insight *in* the graph.** A finding stated in a text card is easy to skim past, so
the surprise is also made interactive. A **"Size nodes by"** toggle switches the radius metric from
*mentions* to *betweenness* — flip it and the graph physically reshuffles, shrinking the stars and
swelling the connectors, which is the "Harry is the star but not the hub" point rendered as motion
rather than prose. **"Highlight bridges"** isolates the characters whose brokerage rank outruns
their mention rank (the real go-betweens). And each insight card is a **link into the graph**:
clicking it flies the view to, and pulses, the character the insight is about — so the words and
the picture stay tied together.

## Things I'd do next with more time

- A second extraction pass promoting the top discovered tokens into the gazetteer, to lift
  recall with the precision still measurable.
- Coreference for pronouns ("he", "she") to enrich co-occurrence — currently a real recall gap.
- Books 5–7 (just more URLs + aliases), which would let the graph show character arcs across
  the series.
- Per-book edge weights are already stored; a small timeline view could animate how the
  network grows book to book.
```
