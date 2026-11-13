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

export interface RenderOptions {
  /** Wrap heading content in a link to its own anchor. */
  headingLinks?: boolean;
}

/** Renders trusted Markdown from the repo and gives every heading a slug id. */
export function renderMarkdown(source: string, options: RenderOptions = {}): RenderedMarkdown {
  const slugger = new GithubSlugger();
  const toc: TocEntry[] = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth, text }) {
        const id = slugger.slug(text);
        toc.push({ depth, text, id });
        const inline = this.parser.parseInline(tokens);
        const content = options.headingLinks
          ? `<a class="heading-link" href="#${id}">${inline}</a>`
          : inline;
        return `<h${depth} id="${id}">${content}</h${depth}>\n`;
      },
    },
  });
  const html = marked.parse(source, { async: false });
  return { html, toc };
}
