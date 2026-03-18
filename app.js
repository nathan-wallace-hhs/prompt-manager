const state = {
  prompts: [],
  filtered: [],
  selectedPath: null,
};

const elements = {
  search: document.getElementById('search'),
  category: document.getElementById('category'),
  sort: document.getElementById('sort'),
  clearFilters: document.getElementById('clear-filters'),
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
  const categories = [...new Set(prompts.map((item) => item.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

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
    sort: elements.sort.value,
  };
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function matches(entry, q, category) {
  const categoryMatch = !category || entry.category === category;
  if (!categoryMatch) return false;

  if (!q) return true;

  const haystack = [entry.title, entry.category, ...(entry.tags || []), entry.preview || '', entry.path]
    .map(normalizeText)
    .join(' ');

  return haystack.includes(q);
}

function sortEntries(entries, sortKey) {
  const sorted = [...entries];

  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const byCategory = (a, b) => (a.category || '').localeCompare(b.category || '');
  const byPath = (a, b) => a.path.localeCompare(b.path);

  switch (sortKey) {
    case 'title-desc':
      sorted.sort((a, b) => byTitle(b, a));
      break;
    case 'category-asc':
      sorted.sort((a, b) => byCategory(a, b) || byTitle(a, b));
      break;
    case 'path-asc':
      sorted.sort(byPath);
      break;
    case 'title-asc':
    default:
      sorted.sort(byTitle);
  }

  return sorted;
}

function updateStatus() {
  const total = state.prompts.length;
  const shown = state.filtered.length;

  if (shown === 0) {
    elements.status.textContent = 'No prompts matched your filters.';
    return;
  }

  elements.status.textContent = `Showing ${shown} of ${total} prompt${total === 1 ? '' : 's'}.`;
}

function setSelectedPrompt(path) {
  state.selectedPath = path;
  for (const button of elements.list.querySelectorAll('button.prompt-button')) {
    const isSelected = button.dataset.path === path;
    button.setAttribute('aria-current', isSelected ? 'true' : 'false');
    button.classList.toggle('ring-2', isSelected);
    button.classList.toggle('ring-blue-500', isSelected);
    button.classList.toggle('border-blue-400', isSelected);
  }
}

function makePromptButton(entry) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800';
  button.classList.add('prompt-button');
  button.dataset.path = entry.path;
  button.setAttribute('aria-current', String(entry.path === state.selectedPath));

  const title = document.createElement('span');
  title.className = 'block text-sm font-semibold text-slate-900 dark:text-slate-100';
  title.textContent = entry.title || entry.path;

  const meta = document.createElement('span');
  meta.className = 'mt-1 block text-xs text-slate-500 dark:text-slate-400';
  meta.textContent = `${entry.category || 'Uncategorized'} • ${entry.path}`;

  button.append(title, meta);
  button.addEventListener('click', () => {
    viewPrompt(entry);
  });

  return button;
}

function renderEmptyState() {
  const li = document.createElement('li');
  li.className =
    'rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300';
  li.textContent = 'Try adjusting search text, category, or sort options.';
  elements.list.append(li);
}

function renderList() {
  const { q, category, sort } = currentQuery();
  const matchesQuery = state.prompts.filter((entry) => matches(entry, q, category));
  state.filtered = sortEntries(matchesQuery, sort);

  elements.list.replaceChildren();
  updateStatus();

  if (state.filtered.length === 0) {
    renderEmptyState();
    return;
  }

  for (const entry of state.filtered) {
    const li = document.createElement('li');
    li.className = 'list-none';
    li.append(makePromptButton(entry));
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
      `Category: ${entry.category || 'Uncategorized'}`,
      `Path: ${entry.path}`,
      parsed.attrs.updated ? `Updated: ${parsed.attrs.updated}` : null,
      (entry.tags || []).length > 0 ? `Tags: ${entry.tags.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    elements.viewerContent.textContent = parsed.body.trim();
    elements.viewer.hidden = false;
    setSelectedPrompt(entry.path);
    elements.viewer.focus();
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

function clearFilters() {
  elements.search.value = '';
  elements.category.value = '';
  elements.sort.value = 'title-asc';
  renderList();
  elements.search.focus();
}

function addEventListeners() {
  elements.search.addEventListener('input', renderList);
  elements.category.addEventListener('change', renderList);
  elements.sort.addEventListener('change', renderList);
  elements.clearFilters.addEventListener('click', clearFilters);
}

async function init() {
  try {
    elements.status.textContent = 'Loading prompts…';
    const indexEntries = await loadIndex();
    state.prompts = enhanceIndex(indexEntries);

    fillCategoryFilter(state.prompts);
    addEventListeners();
    renderList();
  } catch (error) {
    elements.status.textContent = `Error: ${error.message}`;
  }
}

init();
