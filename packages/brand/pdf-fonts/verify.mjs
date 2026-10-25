/* global process, console, URL */
// Integrity check of the PDF fonts: every TTF listed in manifest.json must have the recorded size and SHA-256.
// A changed font changes the bytes of every PDF, so the reference-document hash test (L1-006, condition 3) would fail
// without saying why; this check says why. No dependency. Usage: node packages/brand/pdf-fonts/verify.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const manifest = JSON.parse(readFileSync(here('./manifest.json'), 'utf8'));

const failures = manifest.fonts.flatMap((font) => {
  const bytes = readFileSync(here(`./${font.file}`));
  const sha = createHash('sha256').update(bytes).digest('hex');
  const problems = [];
  if (bytes.length !== font.bytes) problems.push(`${font.file}: ${bytes.length} bytes, manifest says ${font.bytes}`);
  if (sha !== font.sha256) problems.push(`${font.file}: SHA-256 ${sha}, manifest says ${font.sha256}`);
  return problems;
});

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`pdf-fonts: ${manifest.fonts.length} fonts match manifest.json`);
