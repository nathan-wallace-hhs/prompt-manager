#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceDir = path.join(repoRoot, 'skills');
const targetDir = path.join(repoRoot, 'claude-skills');
const args = new Set(process.argv.slice(2));
const checkMode = args.has('--check');

const REQUIRED_FIELDS = ['id', 'version', 'owner', 'last-synced'];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseFrontmatter(contents, filePath) {
  if (!contents.startsWith('---\n')) {
    throw new Error(`Missing frontmatter in ${filePath}`);
  }

  const endIndex = contents.indexOf('\n---\n', 4);
  if (endIndex < 0) {
    throw new Error(`Unclosed frontmatter in ${filePath}`);
  }

  const frontmatterText = contents.slice(4, endIndex);
  const body = contents.slice(endIndex + 5);
  const fields = {};

  for (const line of frontmatterText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const separator = trimmed.indexOf(':');
    if (separator < 0) {
      throw new Error(`Invalid frontmatter line in ${filePath}: ${line}`);
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    fields[key] = value;
  }

  for (const field of REQUIRED_FIELDS) {
    if (!fields[field]) {
      throw new Error(`Missing required metadata field "${field}" in ${filePath}`);
    }
  }

  return { fields, body };
}

function buildMirror(sourceFilePath, relativeFilePath, contents) {
  const { fields, body } = parseFrontmatter(contents, sourceFilePath);
  const today = new Date().toISOString().slice(0, 10);

  const mirrorFrontmatter = [
    '---',
    `id: ${fields.id}`,
    `version: ${fields.version}`,
    `owner: ${fields.owner}`,
    `last-synced: ${today}`,
    `source: skills/${relativeFilePath.replace(/\\/g, '/')}`,
    'model-family: claude',
    'generated: true',
    '---',
    '',
    '<!-- This file is generated. Edit canonical content in /skills and rerun scripts/generate-claude-skills.mjs -->',
    '',
  ].join('\n');

  return `${mirrorFrontmatter}${body.startsWith('\n') ? body.slice(1) : body}`;
}

function sync() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error('Expected ./skills directory to exist.');
  }

  const sourceFiles = walk(sourceDir).filter((filePath) => path.basename(filePath) !== 'README.md');
  const expectedFiles = new Set();
  const drift = [];

  for (const sourceFilePath of sourceFiles) {
    const relativePath = path.relative(sourceDir, sourceFilePath);
    const targetFilePath = path.join(targetDir, relativePath);
    const sourceContents = fs.readFileSync(sourceFilePath, 'utf8');
    const expectedContents = buildMirror(sourceFilePath, relativePath, sourceContents);
    expectedFiles.add(targetFilePath);

    if (checkMode) {
      if (!fs.existsSync(targetFilePath)) {
        drift.push(`Missing mirror file: ${path.relative(repoRoot, targetFilePath)}`);
        continue;
      }

      const existing = fs.readFileSync(targetFilePath, 'utf8');
      if (existing !== expectedContents) {
        drift.push(`Out-of-sync mirror file: ${path.relative(repoRoot, targetFilePath)}`);
      }
      continue;
    }

    fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
    fs.writeFileSync(targetFilePath, expectedContents);
  }

  // detect extra files in mirror tree
  if (fs.existsSync(targetDir)) {
    const mirrorFiles = walk(targetDir).filter((filePath) => path.basename(filePath) !== 'README.md');
    for (const mirrorFilePath of mirrorFiles) {
      if (!expectedFiles.has(mirrorFilePath)) {
        const relative = path.relative(repoRoot, mirrorFilePath);
        if (checkMode) {
          drift.push(`Unexpected mirror file: ${relative}`);
        } else {
          fs.unlinkSync(mirrorFilePath);
        }
      }
    }
  }

  if (checkMode && drift.length > 0) {
    console.error('Claude skill mirror is out of sync:');
    for (const item of drift) {
      console.error(`- ${item}`);
    }
    process.exitCode = 1;
    return;
  }

  if (!checkMode) {
    console.log(`Synced ${sourceFiles.length} skill file(s) to claude-skills/.`);
  } else {
    console.log(`Claude skill mirror is in sync for ${sourceFiles.length} file(s).`);
  }
}

sync();
