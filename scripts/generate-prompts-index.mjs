import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const promptsDir = path.join(repoRoot, 'prompts');
const indexFile = path.join(promptsDir, 'index.json');

function stripWrappedQuotes(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

function splitBracketArrayItems(value) {
  const items = [];
  let current = '';
  let quoteChar = null;

  for (const char of value) {
    if ((char === '"' || char === "'") && (!quoteChar || quoteChar === char)) {
      quoteChar = quoteChar ? null : char;
      current += char;
      continue;
    }

    if (char === ',' && !quoteChar) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items.map((item) => stripWrappedQuotes(item.trim())).filter(Boolean);
}

function parseFrontmatterValue(rawValue) {
  const value = rawValue.trim();
  if (!value) return '';

  if (value.startsWith('[') && value.endsWith(']')) {
    const inside = value.slice(1, -1).trim();
    if (!inside) return [];
    return splitBracketArrayItems(inside);
  }

  return stripWrappedQuotes(value);
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return splitBracketArrayItems(trimmed.slice(1, -1));
    }

    return trimmed
      .split(',')
      .map((tag) => stripWrappedQuotes(tag.trim()))
      .filter(Boolean);
  }

  return [];
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    return { attrs: {}, body: markdown };
  }

  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) {
    return { attrs: {}, body: markdown };
  }

  const raw = markdown.slice(4, end);
  const body = markdown.slice(end + 5);
  const attrs = {};

  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    attrs[key] = parseFrontmatterValue(line.slice(idx + 1));
  }

  return { attrs, body };
}

function inferDescription(body) {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'));

  return lines[0] || '';
}

async function collectPromptFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectPromptFiles(fullPath)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    files.push(fullPath);
  }

  return files;
}

async function loadExistingIndex() {
  try {
    const contents = await fs.readFile(indexFile, 'utf8');
    const parsed = JSON.parse(contents);
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.filter((entry) => entry && typeof entry.path === 'string').map((entry) => [entry.path, entry]));
  } catch (_error) {
    return new Map();
  }
}

async function buildIndex() {
  const promptFiles = await collectPromptFiles(promptsDir);
  const existingByPath = await loadExistingIndex();

  const records = [];
  for (const filePath of promptFiles) {
    const relativePath = path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
    const category = relativePath.split('/')[1] || '';
    const markdown = await fs.readFile(filePath, 'utf8');
    const parsed = parseFrontmatter(markdown);

    const existing = existingByPath.get(relativePath) || {};
    const tags = normalizeTags(parsed.attrs.tags);

    records.push({
      path: relativePath,
      category,
      title: parsed.attrs.title || existing.title || path.basename(relativePath, '.md'),
      description: parsed.attrs.description || existing.description || inferDescription(parsed.body),
      tags: Array.from(new Set([category, ...(tags.length > 0 ? tags : normalizeTags(existing.tags))])),
    });
  }

  records.sort((a, b) => a.path.localeCompare(b.path));
  return records;
}

async function main() {
  const records = await buildIndex();
  const output = `${JSON.stringify(records, null, 2)}\n`;
  await fs.writeFile(indexFile, output, 'utf8');
  console.log(`Wrote ${records.length} prompt entries to prompts/index.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
