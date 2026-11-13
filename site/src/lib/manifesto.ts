import { renderMarkdown, type TocEntry } from './markdown';
import { readRepoFile } from './repo-files';

export const MANIFESTO_FILE = 'Shoulders-of-Giants-Manifesto.md';

export interface ManifestoValue {
  term: string;
  rest: string;
}

export interface ManifestoIntro {
  quoteHtml: string;
  statement: string;
  values: ManifestoValue[];
}

export interface Manifesto {
  title: string;
  version: string;
  introHtml: string;
  intro: ManifestoIntro;
  html: string;
  toc: TocEntry[];
}

export function parseIntro(intro: string): ManifestoIntro {
  const fail = () =>
    new Error(
      `${MANIFESTO_FILE}: intro needs a quote, a bold core statement and at least one "- **Value** over …" line`,
    );
  const lines = intro.split(/\r?\n/);

  const quoteLines = lines.filter((line) => line.startsWith('>'));
  const quote = quoteLines.map((line) => line.replace(/^>\s?/, '')).join('\n\n');
  if (!quote.trim()) throw fail();

  const statementMatch = lines
    .map((line) => line.trimEnd())
    .join('\n')
    .match(/^\*\*(.+)\*\*$/m);
  if (!statementMatch) throw fail();

  const values: ManifestoValue[] = [];
  for (const line of lines) {
    const match = line.match(/^- \*\*(.+?)\*\*\s+(.+)$/);
    if (match) values.push({ term: match[1], rest: match[2].trim() });
  }
  if (values.length === 0) throw fail();

  return {
    quoteHtml: renderMarkdown(quote).html,
    statement: statementMatch[1].trim(),
    values,
  };
}

export function parseManifesto(source: string): Manifesto {
  const titleMatch = source.match(/^# (.+)$/m);
  if (!titleMatch || titleMatch.index === undefined) {
    throw new Error(`${MANIFESTO_FILE}: missing "# " title line`);
  }
  const versionMatch = source.match(/^\*Version (\d+(?:\.\d+)+)\b/m);
  if (!versionMatch) {
    throw new Error(`${MANIFESTO_FILE}: missing "*Version X.Y" line`);
  }

  const body = source.slice(titleMatch.index + titleMatch[0].length);
  const firstSection = body.search(/^## /m);
  const intro = firstSection === -1 ? body : body.slice(0, firstSection);
  // The homepage shows the intro; the full text starts at the first section.
  const sections = firstSection === -1 ? '' : body.slice(firstSection);
  const { html, toc } = renderMarkdown(sections, { headingLinks: true });

  return {
    title: titleMatch[1].trim(),
    version: versionMatch[1],
    introHtml: renderMarkdown(intro).html,
    intro: parseIntro(intro),
    html,
    toc,
  };
}

let cached: Manifesto | undefined;

export function loadManifesto(): Manifesto {
  cached ??= parseManifesto(readRepoFile(MANIFESTO_FILE));
  return cached;
}
