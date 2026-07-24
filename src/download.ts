import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Public plain-text mirror of the books. amephraim/nlp keeps the original casing and
// straight quotes, which our extractor relies on. We only pull the first four.
const BASE = 'https://raw.githubusercontent.com/amephraim/nlp/master/texts';
const TITLES = [
  "J. K. Rowling - Harry Potter 1 - Sorcerer's Stone.txt",
  'J. K. Rowling - Harry Potter 2 - The Chamber Of Secrets.txt',
  'J. K. Rowling - Harry Potter 3 - Prisoner of Azkaban.txt',
  'J. K. Rowling - Harry Potter 4 - The Goblet of Fire.txt',
];

export const BOOK_NAMES = [
  "Sorcerer's Stone",
  'Chamber of Secrets',
  'Prisoner of Azkaban',
  'Goblet of Fire',
];

/**
 * Returns the four books as raw strings, downloading any that aren't cached in data/.
 * If the network is unavailable you can drop book1.txt..book4.txt into data/ yourself.
 */
export async function getBooks(dataDir = 'data'): Promise<string[]> {
  await mkdir(dataDir, { recursive: true });
  const texts: string[] = [];

  for (let i = 0; i < TITLES.length; i++) {
    const path = `${dataDir}/book${i + 1}.txt`;
    if (!existsSync(path)) {
      const url = `${BASE}/${encodeURIComponent(TITLES[i])}`;
      process.stdout.write(`  downloading book ${i + 1}... `);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`failed to fetch book ${i + 1} (HTTP ${res.status})`);
      await writeFile(path, await res.text(), 'utf8');
      console.log('done');
    }
    texts.push(await readFile(path, 'utf8'));
  }
  return texts;
}
