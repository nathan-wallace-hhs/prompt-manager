const state = {
  prompts: [],
  filtered: [],
};

const elements = {
  search: document.getElementById('search'),
  category: document.getElementById('category'),
  status: document.getElementById('status'),
  list: document.getElementById('prompt-list'),
  viewer: document.getElementById('viewer'),
  viewerTitle: document.getElementById('viewer-title'),
  viewerMeta: document.getElementById('viewer-meta'),
  viewerContent: document.getElementById('viewer-content'),
};

async function loadIndex() {
  const response = await fetch('prompts/index.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load prompts/index.json (${response.status})`);
  }
  return response.json();
}

function fillCategoryFilter(prompts) {
  const categories = [...new Set(prompts.map((item) => item.category).filter(Boolean))].sort();
  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.category.append(option);
  }
}

function currentQuery() {
  return {
    q: elements.search.value.trim().toLowerCase(),
    category: elements.category.value,
  };
}

function matches(entry, q, category) {
  const categoryMatch = !category || entry.category === category;
  if (!categoryMatch) return false;

  if (!q) return true;

  const haystack = [entry.title, entry.category, ...(entry.tags || []), entry.preview || '']
    .join(' ')
    .toLowerCase();

  return haystack.includes(q);
}

function renderList() {
  const { q, category } = currentQuery();
  state.filtered = state.prompts.filter((entry) => matches(entry, q, category));

  elements.list.replaceChildren();

  if (state.filtered.length === 0) {
    elements.status.textContent = 'No prompts matched your filters.';
    return;
  }

  elements.status.textContent = `${state.filtered.length} prompt(s) shown.`;

  for (const entry of state.filtered) {
    const li = document.createElement('li');
    li.className = 'prompt-item';

    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<strong>${entry.title || entry.path}</strong><br><small>${entry.category || 'uncategorized'} · ${entry.path}</small>`;
    button.addEventListener('click', () => viewPrompt(entry));

    li.append(button);
    elements.list.append(li);
  }
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
    const value = line.slice(idx + 1).trim();
    attrs[key] = value;
  }

  return { attrs, body };
}

async function viewPrompt(entry) {
  try {
    const response = await fetch(entry.path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load ${entry.path}`);
    const markdown = await response.text();
    const parsed = parseFrontmatter(markdown);

    elements.viewerTitle.textContent = entry.title || parsed.attrs.title || entry.path;
    elements.viewerMeta.textContent = [
      `Category: ${entry.category || 'uncategorized'}`,
      `Path: ${entry.path}`,
      parsed.attrs.updated ? `Updated: ${parsed.attrs.updated}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    elements.viewerContent.textContent = parsed.body.trim();
    elements.viewer.hidden = false;
  } catch (error) {
    elements.status.textContent = error.message;
  }
}

function enhanceIndex(indexEntries) {
  return indexEntries.map((entry) => ({
    ...entry,
    title: entry.title || entry.path.split('/').pop().replace(/\.md$/i, ''),
    tags: entry.tags || [],
    preview: entry.description || '',
  }));
}

async function init() {
  try {
    elements.status.textContent = 'Loading prompts...';
    const indexEntries = await loadIndex();
    state.prompts = enhanceIndex(indexEntries);
    fillCategoryFilter(state.prompts);
    renderList();

    elements.search.addEventListener('input', renderList);
    elements.category.addEventListener('change', renderList);
  } catch (error) {
    elements.status.textContent = `Error: ${error.message}`;
  }
}

init();
