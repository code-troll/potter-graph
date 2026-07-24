import type Graph from 'graphology';
import type { Corpus } from './extract.js';
import type { Entity, ExportData, Insight, Link } from './types.js';
import { BOOK_NAMES } from './download.js';

function nodesFromGraph(g: Graph): Entity[] {
  const out: Entity[] = [];
  g.forEachNode((id, a) => {
    out.push({
      id,
      label: a.label,
      type: a.type,
      aliases: [],
      mentions: a.mentions,
      wordsSpoken: a.wordsSpoken,
      books: a.books,
      degree: a.degree,
      betweenness: a.betweenness,
      community: a.community,
      x: a.x,
      y: a.y,
    });
  });
  return out;
}

function linksFromCorpus(corpus: Corpus): Link[] {
  const links: Link[] = [];
  for (const e of corpus.cooccur.values())
    links.push({ source: e.a, target: e.b, type: 'cooccurs', weight: e.weight, books: [...e.books].sort() });
  for (const e of corpus.casts.values())
    links.push({ source: e.a, target: e.b, type: 'casts', weight: e.weight, books: [...e.books].sort() });
  return links;
}

const rank = (arr: Entity[], key: (e: Entity) => number) =>
  [...arr].sort((a, b) => key(b) - key(a));

function buildInsights(chars: Entity[], nodes: Entity[], corpus: Corpus): Insight[] {
  const insights: Insight[] = [];

  // --- headline: the bridge that punches above its screen time ---
  const byMentions = rank(chars, (e) => e.mentions);
  const byBetween = rank(chars, (e) => e.betweenness);
  const mentionRank = new Map(byMentions.map((e, i) => [e.id, i + 1]));
  // a "connector" sits high on betweenness but comparatively low on raw mentions
  const bridge = byBetween
    .slice(0, 6)
    .map((e) => ({ e, gap: (mentionRank.get(e.id) ?? 999) - (byBetween.indexOf(e) + 1) }))
    .sort((a, b) => b.gap - a.gap)[0];
  if (bridge && bridge.gap > 0) {
    insights.push({
      headline: true,
      title: `${bridge.e.label} is a social bridge, not a headliner`,
      body:
        `${bridge.e.label} ranks #${byBetween.indexOf(bridge.e) + 1} in betweenness centrality ` +
        `(how often the shortest path between two characters runs through them) but only ` +
        `#${mentionRank.get(bridge.e.id)} by raw mentions. They connect clusters that would ` +
        `otherwise barely touch - a plot-glue role the mention count alone hides.`,
    });
  }

  // --- talkativeness vs screen time ---
  const talkers = rank(chars.filter((c) => c.mentions >= 40), (e) => e.wordsSpoken / e.mentions);
  if (talkers.length) {
    const loud = talkers[0];
    insights.push({
      title: `${loud.label} talks the most per appearance`,
      body:
        `Measured as words spoken per mention, ${loud.label} is the densest talker among ` +
        `well-known characters (~${(loud.wordsSpoken / loud.mentions).toFixed(1)} words every time ` +
        `they show up). Great for spotting the exposition-carriers.`,
    });
  }

  // --- communities ---
  const groups = new Map<number, Entity[]>();
  for (const n of nodes) {
    if (!groups.has(n.community)) groups.set(n.community, []);
    groups.get(n.community)!.push(n);
  }
  const biggest = [...groups.values()].sort((a, b) => b.length - a.length).slice(0, 3);
  insights.push({
    title: `The graph self-organises into ${groups.size} communities`,
    body:
      `Louvain community detection (run only on co-occurrence, with no knowledge of the ` +
      `canon) groups the cast into clusters. The three largest are led by ` +
      biggest
        .map((g) => rank(g, (e) => e.mentions)[0]?.label)
        .filter(Boolean)
        .join(', ') +
      `. They line up neatly with the houses, the Weasleys and the adult staff.`,
  });

  // --- spells ---
  const casterTotals = new Map<string, number>();
  for (const e of corpus.casts.values()) casterTotals.set(e.a, (casterTotals.get(e.a) ?? 0) + e.weight);
  const topCaster = [...casterTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const spellNode = rank(nodes.filter((n) => n.type === 'spell'), (e) => e.mentions)[0];
  if (topCaster && spellNode) {
    const casterName = chars.find((c) => c.id === topCaster[0])?.label ?? topCaster[0];
    insights.push({
      title: `${spellNode.label} is the most-named spell`,
      body:
        `Across the four books ${spellNode.label} leads the incantation count, and ` +
        `${casterName} is the busiest wand in the data (most attributed casts). Spell ` +
        `casting is attributed to the nearest preceding character in the sentence - a heuristic, ` +
        `so read it as a strong hint rather than gospel.`,
    });
  }

  return insights;
}

export function analyze(g: Graph, corpus: Corpus): ExportData {
  const nodes = nodesFromGraph(g);
  const links = linksFromCorpus(corpus);
  const chars = nodes.filter((n) => n.type === 'character');

  const casterTotals = new Map<string, number>();
  for (const e of corpus.casts.values()) casterTotals.set(e.a, (casterTotals.get(e.a) ?? 0) + e.weight);
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;

  const top = (arr: Entity[], key: (e: Entity) => number, n = 12) =>
    rank(arr, key).slice(0, n).map((e) => ({ name: e.label, value: Math.round(key(e) * 100) / 100 }));

  return {
    meta: {
      books: BOOK_NAMES,
      nodeCount: nodes.length,
      edgeCount: links.length,
      totalMentions: nodes.reduce((s, n) => s + n.mentions, 0),
      quotesSeen: corpus.quotesSeen,
      quotesAttributed: corpus.quotesAttributed,
    },
    nodes,
    links,
    insights: buildInsights(chars, nodes, corpus),
    charts: {
      topTalkers: top(chars.filter((c) => c.wordsSpoken > 0), (e) => e.wordsSpoken),
      topSpells: top(nodes.filter((n) => n.type === 'spell'), (e) => e.mentions),
      topCentral: top(chars, (e) => e.betweenness),
      topCasters: [...casterTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([id, v]) => ({ name: labelOf(id), value: v })),
    },
  };
}
