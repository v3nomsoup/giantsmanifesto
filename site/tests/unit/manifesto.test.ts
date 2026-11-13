import { describe, expect, it } from 'vitest';
import { loadManifesto, parseManifesto } from '../../src/lib/manifesto';

const fixture = [
  '# Test Manifesto',
  '',
  '> A quote',
  '',
  'We value:',
  '',
  '- **Common good** over private profit',
  '',
  '## Preamble',
  '',
  'Text.',
  '',
  '### I. First principle',
  '',
  '*Version 1.2 · draft*',
].join('\n');

describe('parseManifesto', () => {
  it('reads title and version', () => {
    const manifesto = parseManifesto(fixture);
    expect(manifesto.title).toBe('Test Manifesto');
    expect(manifesto.version).toBe('1.2');
  });

  it('builds the table of contents without the title', () => {
    expect(parseManifesto(fixture).toc).toEqual([
      { depth: 2, text: 'Preamble', id: 'preamble' },
      { depth: 3, text: 'I. First principle', id: 'i-first-principle' },
    ]);
  });

  it('limits the intro to the text before the first section', () => {
    const { introHtml } = parseManifesto(fixture);
    expect(introHtml).toContain('<strong>Common good</strong>');
    expect(introHtml).not.toContain('Preamble');
  });

  it('turns body headings into anchor links but leaves the intro alone', () => {
    const { html, introHtml } = parseManifesto(fixture);
    expect(html).toContain('<a class="heading-link" href="#preamble">Preamble</a>');
    expect(html).toContain('<a class="heading-link" href="#i-first-principle">');
    expect(introHtml).not.toContain('heading-link');
  });

  it('leaves the title out of the body', () => {
    expect(parseManifesto(fixture).html).not.toContain('Test Manifesto');
  });

  it('throws when the version line is missing', () => {
    expect(() => parseManifesto(fixture.replace('*Version 1.2 · draft*', ''))).toThrow(
      'Shoulders-of-Giants-Manifesto.md: missing "*Version X.Y" line',
    );
  });

  it('throws when the title is missing', () => {
    expect(() => parseManifesto(fixture.replace('# Test Manifesto', ''))).toThrow(
      'Shoulders-of-Giants-Manifesto.md: missing "# " title line',
    );
  });
});

describe('loadManifesto (real file)', () => {
  const manifesto = loadManifesto();

  it('parses the published manifesto', () => {
    expect(manifesto.title).toBe('The Shoulders of Giants Manifesto');
    expect(manifesto.version).toMatch(/^\d+(\.\d+)+$/);
  });

  it('has a table of contents whose ids all exist in the body', () => {
    expect(manifesto.toc.map((entry) => entry.id)).toContain('preamble');
    for (const entry of manifesto.toc) {
      expect(manifesto.html).toContain(`id="${entry.id}"`);
    }
  });
});
