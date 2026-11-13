import { renderMarkdown, type TocEntry } from './markdown';
import { readRepoFile } from './repo-files';

export const MANIFESTO_FILE = 'Shoulders-of-Giants-Manifesto.md';

export interface Manifesto {
  title: string;
  version: string;
  introHtml: string;
  html: string;
  toc: TocEntry[];
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
  const { html, toc } = renderMarkdown(body, { headingLinks: true });

  return {
    title: titleMatch[1].trim(),
    version: versionMatch[1],
    introHtml: renderMarkdown(intro).html,
    html,
    toc,
  };
}

let cached: Manifesto | undefined;

export function loadManifesto(): Manifesto {
  cached ??= parseManifesto(readRepoFile(MANIFESTO_FILE));
  return cached;
}
