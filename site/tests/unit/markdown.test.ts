import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown';

describe('renderMarkdown', () => {
  it('gives headings slug ids and collects a table of contents', () => {
    const { html, toc } = renderMarkdown('## Call to action\n\n### I. Progress builds\n\nText.');
    expect(html).toContain('<h2 id="call-to-action">Call to action</h2>');
    expect(html).toContain(
      '<h3 id="i-progress-builds"><span class="numeral">I.</span> Progress builds</h3>',
    );
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

  it('wraps heading content in an anchor link when headingLinks is set', () => {
    const { html } = renderMarkdown('## Sign *it*', { headingLinks: true });
    expect(html).toContain(
      '<h2 id="sign-it"><a class="heading-link" href="#sign-it">Sign <em>it</em></a></h2>',
    );
  });

  it('does not emit heading links by default', () => {
    expect(renderMarkdown('## Notes').html).not.toContain('heading-link');
  });

  it('wraps a leading roman numeral inside the heading link', () => {
    const { html, toc } = renderMarkdown('### I. First principle', { headingLinks: true });
    expect(html).toContain('<span class="numeral">I.</span> First principle');
    expect(html).toContain('id="i-first-principle"');
    expect(html).toContain('<a class="heading-link" href="#i-first-principle"><span');
    expect(toc[0]?.text).toBe('I. First principle');
  });

  it('leaves headings without a numeral alone', () => {
    expect(renderMarkdown('## Preamble', { headingLinks: true }).html).not.toContain('numeral');
    expect(renderMarkdown('## Vision of it').html).not.toContain('numeral');
  });

  it('only treats valid roman numerals as numerals', () => {
    expect(renderMarkdown('### CIVIL. Rights').html).not.toContain('numeral');
    expect(renderMarkdown('### VI. A fair path').html).toContain(
      '<span class="numeral">VI.</span> A fair path',
    );
  });
});
