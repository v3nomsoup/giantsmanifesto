import GithubSlugger from 'github-slugger';
import { Marked } from 'marked';

export interface TocEntry {
  depth: number;
  text: string;
  id: string;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocEntry[];
}

/** Renders trusted Markdown from the repo and gives every heading a slug id. */
export function renderMarkdown(source: string): RenderedMarkdown {
  const slugger = new GithubSlugger();
  const toc: TocEntry[] = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth, text }) {
        const id = slugger.slug(text);
        toc.push({ depth, text, id });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
    },
  });
  const html = marked.parse(source, { async: false });
  return { html, toc };
}
