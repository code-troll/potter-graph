import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import betweenness from 'graphology-metrics/centrality/betweenness';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import type { Corpus } from './extract.js';

/**
 * Turns the raw co-occurrence counts into an undirected weighted graph and hangs
 * the structural metrics (degree, betweenness, Louvain community) plus a baked-in
 * ForceAtlas2 layout on each node. The browser then just draws what's here - no
 * graph library needed client-side.
 */
export function buildGraph(corpus: Corpus): Graph {
  const g = new Graph({ type: 'undirected' });

  for (const e of corpus.entities.values()) {
    g.addNode(e.id, {
      label: e.label,
      type: e.type,
      mentions: e.mentions,
      wordsSpoken: e.wordsSpoken,
      books: [...e.books].sort(),
    });
  }

  for (const edge of corpus.cooccur.values()) {
    // both endpoints always exist; guard anyway in case the gazetteer changes
    if (g.hasNode(edge.a) && g.hasNode(edge.b) && !g.hasEdge(edge.a, edge.b)) {
      g.addEdge(edge.a, edge.b, { weight: edge.weight });
    }
  }

  // seed positions on a circle so ForceAtlas2 has something to relax from
  const n = g.order;
  let i = 0;
  g.forEachNode((node) => {
    const angle = (2 * Math.PI * i++) / n;
    g.setNodeAttribute(node, 'x', Math.cos(angle));
    g.setNodeAttribute(node, 'y', Math.sin(angle));
  });

  louvain.assign(g, { resolution: 1 });

  const bc = betweenness(g, { normalized: true });
  g.forEachNode((node) => {
    g.setNodeAttribute(node, 'degree', g.degree(node));
    g.setNodeAttribute(node, 'betweenness', bc[node]);
  });

  const settings = forceAtlas2.inferSettings(g);
  forceAtlas2.assign(g, { iterations: 400, settings: { ...settings, gravity: 1, scalingRatio: 12 } });

  return g;
}
