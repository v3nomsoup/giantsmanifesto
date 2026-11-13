import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown';

describe('renderMarkdown', () => {
  it('gives headings slug ids and collects a table of contents', () => {
    const { html, toc } = renderMarkdown('## Call to action\n\n### I. Progress builds\n\nText.');
    expect(html).toContain('<h2 id="call-to-action">Call to action</h2>');
    expect(html).toContain('<h3 id="i-progress-builds">I. Progress builds</h3>');
    expect(toc).toEqual([
      { depth: 2, text: 'Call to action', id: 'call-to-action' },
      { depth: 3, text: 'I. Progress builds', id: 'i-progress-builds' },
    ]);
  });

  it('keeps ids unique when headings repeat', () => {
    const { toc } = renderMarkdown('## Notes\n\n## Notes');
    expect(toc.map((entry) => entry.id)).toEqual(['notes', 'notes-1']);
  });

  it('starts fresh ids on every call', () => {
    renderMarkdown('## Notes');
    expect(renderMarkdown('## Notes').toc[0].id).toBe('notes');
  });

  it('renders inline formatting inside headings', () => {
    const { html } = renderMarkdown('## Sign *it*');
    expect(html).toContain('<h2 id="sign-it">Sign <em>it</em></h2>');
  });
});
