import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';
import { closeDb } from '../../src/lib/db';

// Runs once per test file: every file gets its own empty data directory.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'gm-data-'));

afterAll(() => closeDb());
