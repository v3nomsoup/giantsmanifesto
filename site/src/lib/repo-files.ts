import { readFileSync } from 'node:fs';
import path from 'node:path';

/** The repo root holds the manifesto and changelog; the Astro app runs from site/. */
export function repoRoot(): string {
  return process.env.CONTENT_DIR ?? path.resolve(process.cwd(), '..');
}

export function readRepoFile(name: string): string {
  return readFileSync(path.join(repoRoot(), name), 'utf8');
}

export function readSiteFile(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
