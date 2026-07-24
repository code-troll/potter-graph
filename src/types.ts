export type EntityType = 'character' | 'spell' | 'place' | 'creature' | 'house';

/** A curated entity: one canonical name plus every surface form we accept for it. */
export interface GazetteerEntry {
  canonical: string;
  type: EntityType;
  aliases: string[];
}

/** An entity node once we've counted it up across the corpus. */
export interface Entity {
  id: string;            // slug of the canonical name
  label: string;         // canonical name, for display
  type: EntityType;
  aliases: string[];
  mentions: number;
  wordsSpoken: number;   // only meaningful for characters
  books: number[];       // which of books 1..4 it shows up in
  // filled in by analyze.ts
  degree: number;
  betweenness: number;
  community: number;
  x: number;
  y: number;
}

export interface Link {
  source: string;
  target: string;
  type: 'cooccurs' | 'casts';
  weight: number;
  books: number[];
}

export interface Insight {
  title: string;
  body: string;
  headline?: boolean;    // the one surprise we want to lead with
}

export interface ExportData {
  meta: {
    books: string[];
    nodeCount: number;
    edgeCount: number;
    totalMentions: number;
    quotesSeen: number;
    quotesAttributed: number;
  };
  nodes: Entity[];
  links: Link[];
  insights: Insight[];
  charts: {
    topTalkers: { name: string; value: number }[];
    topSpells: { name: string; value: number }[];
    topCentral: { name: string; value: number }[];
    topCasters: { name: string; value: number }[];
  };
}
