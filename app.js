const OPEN_FIRST_RESULT_ON_FILTER_CHANGE = true;
const FAVORITES_STORAGE_KEY = 'aspaPromptExplorer.favorites.v1';
const LAST_SELECTED_STORAGE_KEY = 'aspaPromptExplorer.lastSelectedPath.v1';
const FILTER_PANEL_COLLAPSED_STORAGE_KEY = 'aspaPromptExplorer.filtersPanelCollapsed.v1';

const state = {
  prompts: [],
  filtered: [],
  selectedPath: null,
  activePath: null,
  favorites: new Set(),
  showFavoritesOnly: false,
  storageWarning: '',
  statusFlash: '',
  statusTimer: null,
  lastStatusMessage: '',
  copyFeedbackTimer: null,
  filtersCollapsed: false,
};

const elements = {
  search: document.getElementById('search'),
  category: document.getElementById('category'),
  tag: document.getElementById('tag'),
  sort: document.getElementById('sort'),
  showFavoritesOnly: document.getElementById('show-favorites-only'),
  clearFilters: document.getElementById('clear-filters'),

  quickSearch: document.getElementById('search-quick'),
  quickCategory: document.getElementById('category-quick'),
  quickTag: document.getElementById('tag-quick'),
  quickFavoritesOnly: document.getElementById('show-favorites-only-quick'),
  quickClearFilters: document.getElementById('clear-filters-quick'),
  appShell: document.getElementById('main-content'),
  filtersPanel: document.getElementById('filters-panel'),
  filtersPanelContent: document.getElementById('filters-panel-content'),
  toggleFiltersPanel: document.getElementById('toggle-filters-panel'),

  status: document.getElementById('status'),
  activeFilters: document.getElementById('active-filters'),
  list: document.getElementById('prompt-list'),
  viewer: document.getElementById('viewer'),
  viewerTitle: document.getElementById('viewer-title'),
  viewerMeta: document.getElementById('viewer-meta'),
  viewerContent: document.getElementById('viewer-content'),
  copyPrompt: document.getElementById('copy-prompt'),
};

async function loadIndex() {
  const response = await fetch('prompts/index.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load prompts/index.json (${response.status})`);
  }

  return response.json();
}

function toDisplayLabel(value) {
  return String(value || '')
    .split(/[-_]/g)
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ');
}

function appendOption(selectElement, value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  selectElement.append(option);
}

function fillFacetFilters(prompts) {
  const categoryCounts = new Map();
  const tagCounts = new Map();

  for (const prompt of prompts) {
    const normalizedCategory = normalizeCategory(prompt.category);
    if (normalizedCategory) {
      categoryCounts.set(normalizedCategory, (categoryCounts.get(normalizedCategory) || 0) + 1);
    }

    for (const tag of normalizeTags(prompt.tags)) {
      const normalizedTag = normalizeCategory(tag);
      if (!normalizedTag) continue;
      tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
    }
  }

  const sortedCategories = [...categoryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const sortedTags = [...tagCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [category, count] of sortedCategories) {
    appendOption(elements.category, category, `${toDisplayLabel(category)} (${count})`);
    if (elements.quickCategory) {
      appendOption(elements.quickCategory, category, `${toDisplayLabel(category)} (${count})`);
    }
  }

  for (const [tag, count] of sortedTags) {
    appendOption(elements.tag, tag, `${toDisplayLabel(tag)} (${count})`);
    if (elements.quickTag) {
      appendOption(elements.quickTag, tag, `${toDisplayLabel(tag)} (${count})`);
    }
  }
}

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get('search') || '',
    category: params.get('category') || '',
    tag: params.get('tag') || '',
    sort: params.get('sort') || 'title-asc',
    selectedPath: params.get('selectedPath') || null,
    favoritesOnly: params.get('favoritesOnly') === 'true',
  };
}

function syncUrlState() {
  const params = new URLSearchParams();
  const searchValue = elements.search.value.trim();
  const categoryValue = elements.category.value;
  const tagValue = elements.tag.value;
  const sortValue = elements.sort.value;

  if (searchValue) params.set('search', searchValue);
  if (categoryValue) params.set('category', categoryValue);
  if (tagValue) params.set('tag', tagValue);
  if (sortValue && sortValue !== 'title-asc') params.set('sort', sortValue);
  if (state.selectedPath) params.set('selectedPath', state.selectedPath);
  if (state.showFavoritesOnly) params.set('favoritesOnly', 'true');

  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
  history.replaceState(null, '', nextUrl);
}

function syncQuickControls() {
  if (elements.quickSearch) elements.quickSearch.value = elements.search.value;
  if (elements.quickCategory) elements.quickCategory.value = elements.category.value;
  if (elements.quickTag) elements.quickTag.value = elements.tag.value;
  if (elements.quickFavoritesOnly) elements.quickFavoritesOnly.checked = state.showFavoritesOnly;
}

function loadFiltersPanelCollapsedState() {
  try {
    return localStorage.getItem(FILTER_PANEL_COLLAPSED_STORAGE_KEY) === 'true';
  } catch (_error) {
    return false;
  }
}

function saveFiltersPanelCollapsedState() {
  try {
    localStorage.setItem(FILTER_PANEL_COLLAPSED_STORAGE_KEY, String(state.filtersCollapsed));
  } catch (_error) {
    // Ignore localStorage failures for layout preference.
  }
}

function applyFiltersPanelState() {
  if (!elements.appShell || !elements.filtersPanelContent || !elements.toggleFiltersPanel) {
    return;
  }

  const isLargeViewport = window.matchMedia('(min-width: 1024px)').matches;
  const shouldCollapse = state.filtersCollapsed && isLargeViewport;

  elements.appShell.classList.toggle('filters-collapsed', shouldCollapse);
  elements.filtersPanelContent.hidden = shouldCollapse;
  elements.toggleFiltersPanel.setAttribute('aria-expanded', String(!shouldCollapse));
  elements.toggleFiltersPanel.setAttribute('aria-label', shouldCollapse ? 'Expand filters panel' : 'Collapse filters panel');

  const textNode = elements.toggleFiltersPanel.querySelector('.filters-toggle-text');
  if (textNode) {
    textNode.textContent = shouldCollapse ? 'Expand' : 'Collapse';
  }
}

function toggleFiltersPanel() {
  state.filtersCollapsed = !state.filtersCollapsed;
  applyFiltersPanelState();
  saveFiltersPanelCollapsedState();
}

function currentQuery() {
  return {
    q: elements.search.value.trim().toLowerCase(),
    category: elements.category.value,
    tag: elements.tag.value,
    sort: elements.sort.value,
    favoritesOnly: state.showFavoritesOnly,
  };
}

function makeDismissibleFilterPill({ type, value, label }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'active-filter-pill';
  button.dataset.filterType = type;
  button.dataset.filterValue = value;
  button.setAttribute('aria-label', `Remove ${label} filter`);
  button.innerHTML = `<span>${label}</span><span aria-hidden="true">✕</span>`;
  return button;
}

function renderActiveFilterPills() {
  if (!elements.activeFilters) return;
  const selectedCategory = normalizeCategory(elements.category.value);
  const selectedTag = normalizeCategory(elements.tag.value);
  const pills = [];

  if (selectedCategory) {
    pills.push(
      makeDismissibleFilterPill({
        type: 'category',
        value: selectedCategory,
        label: `Category: ${toDisplayLabel(selectedCategory)}`,
      }),
    );
  }

  if (selectedTag) {
    pills.push(
      makeDismissibleFilterPill({
        type: 'tag',
        value: selectedTag,
        label: `Tag: ${toDisplayLabel(selectedTag)}`,
      }),
    );
  }

  if (state.showFavoritesOnly) {
    pills.push(
      makeDismissibleFilterPill({
        type: 'favorites',
        value: 'true',
        label: 'Saved prompts',
      }),
    );
  }

  elements.activeFilters.replaceChildren(...pills);
  elements.activeFilters.hidden = pills.length === 0;
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function normalizeCategory(value) {
  return String(value || '').trim().toLowerCase();
}

function inferCategoryFromPath(path) {
  const normalizedPath = String(path || '').trim();
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length < 2) return '';
  if (segments[0] !== 'prompts') return '';
  return segments[1];
}

function getNormalizedEntryTags(entry) {
  return new Set(normalizeTags(entry.tags).map((tag) => normalizeCategory(tag)).filter(Boolean));
}

function matches(entry, q, category, tag) {
  const selectedCategory = normalizeCategory(category);
  const selectedTag = normalizeCategory(tag);
  const categoryMatch = !selectedCategory || normalizeCategory(entry.category) === selectedCategory;
  const tagMatch = !selectedTag || getNormalizedEntryTags(entry).has(selectedTag);
  if (!categoryMatch) return false;
  if (!tagMatch) return false;

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

function setStatusMessage(message, { force = false } = {}) {
  if (!force && message === state.lastStatusMessage) return;
  elements.status.textContent = message;
  state.lastStatusMessage = message;
}

function formatResultsSummary() {
  const total = state.prompts.length;
  const shown = state.filtered.length;
  const warningSuffix = state.storageWarning ? ` ${state.storageWarning}` : '';

  if (shown === 0) {
    return `No prompts match your current filters.${warningSuffix}`;
  }

  return `Showing ${shown} of ${total} prompt${total === 1 ? '' : 's'}.${warningSuffix}`;
}

function composeStatusMessage(context = '') {
  const summary = formatResultsSummary();
  return context ? `${context} ${summary}` : summary;
}

function setTransientStatus(message, timeout = 2200, { includeResults = false } = {}) {
  const statusMessage = includeResults ? composeStatusMessage(message) : message;
  state.statusFlash = statusMessage;
  if (state.statusTimer) {
    clearTimeout(state.statusTimer);
  }

  setStatusMessage(statusMessage, { force: true });
  state.statusTimer = setTimeout(() => {
    state.statusFlash = '';
    state.statusTimer = null;
    updateStatus();
  }, timeout);
}

function updateStatus({ context = '' } = {}) {
  if (state.statusFlash) {
    setStatusMessage(state.statusFlash);
    return;
  }

  setStatusMessage(composeStatusMessage(context));
}

function updateListSelectionUI() {
  for (const card of elements.list.querySelectorAll('.prompt-card')) {
    const isSelected = card.dataset.path === state.selectedPath;
    const isActive = card.dataset.path === state.activePath;

    card.dataset.selected = String(isSelected);
    card.dataset.active = String(isActive);

    const openButton = card.querySelector('.prompt-open-btn');
    if (openButton) {
      openButton.setAttribute('aria-current', isSelected ? 'true' : 'false');
      openButton.dataset.selected = String(isSelected);
      openButton.dataset.active = String(isActive);
    }
  }
}

function persistLastSelectedPath(path) {
  try {
    if (path) {
      localStorage.setItem(LAST_SELECTED_STORAGE_KEY, path);
    } else {
      localStorage.removeItem(LAST_SELECTED_STORAGE_KEY);
    }
  } catch (_error) {
    // Ignore storage failures, app remains functional in-session.
  }
}

function setSelectedPrompt(path) {
  state.selectedPath = path || null;
  if (path) {
    persistLastSelectedPath(path);
  }
  updateListSelectionUI();
  syncUrlState();
}

function setActivePrompt(path, focusButton = false) {
  state.activePath = path || null;
  updateListSelectionUI();

  if (!focusButton || !path) return;
  const activeButton = elements.list.querySelector(`.prompt-open-btn[data-path="${CSS.escape(path)}"]`);
  if (activeButton) {
    activeButton.focus({ preventScroll: false });
  }
}

function makePromptButton(entry) {
  const li = document.createElement('li');
  li.className = 'list-none';

  const card = document.createElement('div');
  card.className = 'prompt-card';
  card.dataset.path = entry.path;
  card.dataset.selected = String(entry.path === state.selectedPath);
  card.dataset.active = String(entry.path === state.activePath);

  const idPrefix = entry.path.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'prompt';
  const metaId = `${idPrefix}-meta`;
  const previewId = `${idPrefix}-preview`;

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'prompt-open-btn';
  openButton.dataset.path = entry.path;
  openButton.dataset.selected = String(entry.path === state.selectedPath);
  openButton.dataset.active = String(entry.path === state.activePath);
  openButton.setAttribute('aria-current', String(entry.path === state.selectedPath));
  openButton.setAttribute('aria-describedby', `${metaId} ${previewId}`);
  openButton.setAttribute('aria-label', `Open prompt: ${entry.title || entry.path}`);

  const header = document.createElement('div');
  header.className = 'prompt-card-header';

  const title = document.createElement('span');
  title.className = 'prompt-title';
  title.textContent = entry.title || entry.path;

  const meta = document.createElement('span');
  meta.className = 'prompt-meta';
  meta.id = metaId;
  meta.textContent = `${toDisplayLabel(entry.category) || 'Uncategorized'} • ${entry.path}`;

  const preview = document.createElement('span');
  preview.className = 'prompt-preview';
  preview.id = previewId;
  preview.textContent = entry.preview || 'No summary provided yet.';

  const tagGroup = document.createElement('div');
  tagGroup.className = 'prompt-tags';
  for (const tag of (entry.tags || []).slice(0, 4)) {
    const tagPill = document.createElement('span');
    tagPill.className = 'tag-pill';
    tagPill.textContent = tag;
    tagGroup.append(tagPill);
  }

  const isFavorite = state.favorites.has(entry.path);
  const favoriteButton = document.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = 'favorite-btn';
  favoriteButton.setAttribute('aria-pressed', String(isFavorite));
  favoriteButton.setAttribute(
    'aria-label',
    isFavorite ? `Remove ${entry.title || entry.path} from saved prompts` : `Save ${entry.title || entry.path} for quick access`,
  );
  favoriteButton.textContent = isFavorite ? '★ Saved' : '☆ Save prompt';
  favoriteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const promptLabel = entry.title || entry.path;
    if (state.favorites.has(entry.path)) {
      state.favorites.delete(entry.path);
      setTransientStatus(`Removed "${promptLabel}" from saved prompts.`, 2000, { includeResults: true });
    } else {
      state.favorites.add(entry.path);
      setTransientStatus(`Saved "${promptLabel}" for quick access.`, 2000, { includeResults: true });
    }
    saveFavorites();
    renderList({ fromFilterChange: true });
  });

  header.append(title);
  openButton.append(header, meta, preview);
  if (tagGroup.children.length > 0) {
    openButton.append(tagGroup);
  }

  openButton.addEventListener('focus', () => setActivePrompt(entry.path));
  openButton.addEventListener('click', () => {
    setActivePrompt(entry.path);
    viewPrompt(entry);
  });

  card.append(openButton, favoriteButton);
  li.append(card);
  return li;
}

function buildStateCard({ type, icon, title, description }) {
  const li = document.createElement('li');

  const card = document.createElement('div');
  card.className = `state-card state-card--${type}`;

  const iconEl = document.createElement('span');
  iconEl.className = 'state-icon';
  iconEl.textContent = icon;
  iconEl.setAttribute('aria-hidden', 'true');

  const textWrap = document.createElement('div');

  const titleEl = document.createElement('p');
  titleEl.className = 'state-title';
  titleEl.textContent = title;

  const descEl = document.createElement('p');
  descEl.className = 'state-description';
  descEl.textContent = description;

  textWrap.append(titleEl, descEl);
  card.append(iconEl, textWrap);
  li.append(card);
  return li;
}

function renderLoadingState() {
  elements.list.replaceChildren(
    buildStateCard({
      type: 'loading',
      icon: '⏳',
      title: 'Loading prompts…',
      description: 'Fetching prompt index and preparing filters.',
    }),
  );
}

function renderEmptyState() {
  elements.list.append(
    buildStateCard({
      type: 'empty',
      icon: '🔎',
      title: 'No prompts found',
      description: 'Try broadening your search, changing filters, or turning off saved-only mode.',
    }),
  );
}

function renderErrorState(errorMessage) {
  const retryMessage = 'Unable to load prompts. Please refresh the page to retry.';
  elements.list.replaceChildren(
    buildStateCard({
      type: 'error',
      icon: '⚠️',
      title: 'Unable to load prompts',
      description: `${errorMessage} Refresh the page to try again.`,
    }),
  );
  setStatusMessage(`${retryMessage} Error details: ${errorMessage}`, { force: true });
}

function renderList({ fromFilterChange = false } = {}) {
  const previousSelection = state.selectedPath;
  const { q, category, tag, sort, favoritesOnly } = currentQuery();
  const matchesQuery = state.prompts.filter((entry) => matches(entry, q, category, tag));
  const matchesFavorites = favoritesOnly
    ? matchesQuery.filter((entry) => state.favorites.has(entry.path))
    : matchesQuery;
  state.filtered = sortEntries(matchesFavorites, sort);

  elements.list.replaceChildren();

  if (state.filtered.length === 0) {
    state.activePath = null;
    state.selectedPath = null;
    syncUrlState();
    updateStatus();
    renderEmptyState();
    return;
  }

  const visiblePaths = new Set(state.filtered.map((entry) => entry.path));
  const selectedStillVisible = previousSelection && visiblePaths.has(previousSelection);

  if (state.activePath && !visiblePaths.has(state.activePath)) {
    state.activePath = null;
  }

  for (const entry of state.filtered) {
    elements.list.append(makePromptButton(entry));
  }

  if (!state.activePath) {
    state.activePath = selectedStillVisible ? previousSelection : state.filtered[0].path;
  }

  if (fromFilterChange && OPEN_FIRST_RESULT_ON_FILTER_CHANGE && previousSelection && !selectedStillVisible) {
    viewPrompt(state.filtered[0], { focusViewer: false });
  } else {
    if (!selectedStillVisible) {
      state.selectedPath = null;
      syncUrlState();
    }
    updateListSelectionUI();
    updateStatus();
  }
}

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

    // Assumption: commas separate items only when not inside quotes.
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
    // Assumption: frontmatter arrays are flat (`[a, b]`) and do not contain nested arrays/objects.
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

function normalizeDisplayDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toISOString().slice(0, 10);
}

function parseFrontmatter(markdown) {
  try {
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
      const rawValue = line.slice(idx + 1);
      attrs[key] = parseFrontmatterValue(rawValue);
    }

    return { attrs, body };
  } catch (_error) {
    return { attrs: {}, body: markdown };
  }
}

async function viewPrompt(entry, options = {}) {
  const { focusViewer = true } = options;

  try {
    const response = await fetch(entry.path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load ${entry.path}`);

    const markdown = await response.text();
    const parsed = parseFrontmatter(markdown);
    const parsedTags = normalizeTags(parsed.attrs.tags);
    const effectiveTags = Array.from(
      new Set([entry.category, ...(parsedTags.length > 0 ? parsedTags : normalizeTags(entry.tags))].filter(Boolean)),
    );
    const normalizedUpdatedDate = normalizeDisplayDate(parsed.attrs.updated);
    const normalizedCreatedDate = normalizeDisplayDate(parsed.attrs.created);

    elements.viewerTitle.textContent = entry.title || parsed.attrs.title || entry.path;
    elements.viewerMeta.textContent = [
      `Category: ${toDisplayLabel(entry.category) || 'Uncategorized'}`,
      `Path: ${entry.path}`,
      normalizedCreatedDate ? `Created: ${normalizedCreatedDate}` : null,
      normalizedUpdatedDate ? `Updated: ${normalizedUpdatedDate}` : null,
      effectiveTags.length > 0 ? `Tags: ${effectiveTags.map((tag) => toDisplayLabel(tag)).join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    elements.viewerContent.textContent = parsed.body.trim();
    elements.viewer.hidden = false;
    setSelectedPrompt(entry.path);
    setActivePrompt(entry.path);
    updateStatus();

    if (focusViewer) {
      elements.viewer.focus();
    }
  } catch (error) {
    setTransientStatus(error.message, 3000);
  }
}

function enhanceIndex(indexEntries) {
  return indexEntries.map((entry) => ({
    ...entry,
    category: entry.category || inferCategoryFromPath(entry.path),
    title: entry.title || entry.path.split('/').pop().replace(/\.md$/i, ''),
    tags: Array.from(
      new Set([entry.category || inferCategoryFromPath(entry.path), ...normalizeTags(entry.tags)].filter(Boolean)),
    ),
    preview: entry.description || '',
  }));
}

function clearFilters() {
  elements.search.value = '';
  elements.category.value = '';
  elements.tag.value = '';
  elements.sort.value = 'title-asc';
  elements.showFavoritesOnly.checked = false;
  state.showFavoritesOnly = false;
  syncQuickControls();
  renderActiveFilterPills();
  renderList({ fromFilterChange: true });
  updateStatus({ context: 'Filters reset.' });
  elements.search.focus();
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      state.favorites = new Set();
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      state.favorites = new Set();
      return;
    }

    const validPaths = parsed.filter((item) => typeof item === 'string' && item.length > 0);
    state.favorites = new Set(validPaths);
  } catch (_error) {
    state.favorites = new Set();
    state.storageWarning = 'Saved prompts are available for this session only (localStorage unavailable).';
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(state.favorites)));
  } catch (_error) {
    state.storageWarning = 'Saved prompts are available for this session only (localStorage unavailable).';
  }
}

function loadLastSelectedPath() {
  try {
    const value = localStorage.getItem(LAST_SELECTED_STORAGE_KEY);
    return value && typeof value === 'string' ? value : null;
  } catch (_error) {
    return null;
  }
}

function applyInitialStateFromUrl(indexPaths) {
  const urlState = parseUrlState();

  elements.search.value = urlState.search;
  elements.sort.value = ['title-asc', 'title-desc', 'category-asc', 'path-asc'].includes(urlState.sort)
    ? urlState.sort
    : 'title-asc';

  if (urlState.category && indexPaths.categories.has(urlState.category)) {
    elements.category.value = urlState.category;
  } else {
    elements.category.value = '';
  }

  if (urlState.tag && indexPaths.tags.has(urlState.tag)) {
    elements.tag.value = urlState.tag;
  } else {
    elements.tag.value = '';
  }

  state.showFavoritesOnly = urlState.favoritesOnly;
  elements.showFavoritesOnly.checked = state.showFavoritesOnly;

  syncQuickControls();

  if (urlState.selectedPath && indexPaths.paths.has(urlState.selectedPath)) {
    state.selectedPath = urlState.selectedPath;
    state.activePath = urlState.selectedPath;
    return;
  }

  const storedSelectedPath = loadLastSelectedPath();
  if (storedSelectedPath && indexPaths.paths.has(storedSelectedPath)) {
    state.selectedPath = storedSelectedPath;
    state.activePath = storedSelectedPath;
  }
}

function handleListKeyboardNavigation(event) {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) {
    return;
  }

  const targetOpenButton =
    event.target instanceof Element ? event.target.closest('.prompt-open-btn') : null;
  if (!targetOpenButton) return;

  const openButtons = [...elements.list.querySelectorAll('.prompt-open-btn')];
  if (openButtons.length === 0) return;

  const currentIndex = openButtons.indexOf(targetOpenButton);
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;

  event.preventDefault();
  const direction = event.key === 'ArrowDown' ? 1 : -1;
  const nextIndex = (safeCurrentIndex + direction + openButtons.length) % openButtons.length;
  const nextPath = openButtons[nextIndex].dataset.path;
  if (nextPath) {
    setActivePrompt(nextPath, true);
  }
}

function copyViewerContent() {
  const text = elements.viewerContent.textContent || '';
  if (!text.trim()) {
    flashCopyButtonState('idle');
    setTransientStatus('Nothing to copy yet.', 1800);
    return;
  }

  navigator.clipboard
    .writeText(text)
    .then(() => {
      flashCopyButtonState('copied');
      setTransientStatus('Prompt copied to clipboard.', 2000);
    })
    .catch(() => {
      flashCopyButtonState('error');
      setTransientStatus('Unable to copy prompt. Check clipboard permissions.', 3000);
    });
}

function flashCopyButtonState(nextState) {
  if (!elements.copyPrompt) return;
  if (state.copyFeedbackTimer) {
    clearTimeout(state.copyFeedbackTimer);
    state.copyFeedbackTimer = null;
  }

  const labelMap = {
    idle: 'Copy prompt',
    copied: 'Copied!',
    error: 'Copy failed',
  };

  elements.copyPrompt.dataset.copyState = nextState;
  elements.copyPrompt.textContent = labelMap[nextState] || labelMap.idle;

  if (nextState !== 'idle') {
    state.copyFeedbackTimer = setTimeout(() => {
      elements.copyPrompt.dataset.copyState = 'idle';
      elements.copyPrompt.textContent = labelMap.idle;
      state.copyFeedbackTimer = null;
    }, 1400);
  }
}

function addEventListeners() {
  elements.search.addEventListener('input', () => {
    syncQuickControls();
    renderList({ fromFilterChange: true });
  });
  elements.category.addEventListener('change', () => {
    syncQuickControls();
    renderActiveFilterPills();
    renderList({ fromFilterChange: true });
  });
  elements.tag.addEventListener('change', () => {
    syncQuickControls();
    renderActiveFilterPills();
    renderList({ fromFilterChange: true });
  });
  elements.sort.addEventListener('change', () => {
    renderList({ fromFilterChange: true });
    const selectedSortLabel = elements.sort.options[elements.sort.selectedIndex]?.textContent || 'Sort updated.';
    updateStatus({ context: `Sort changed to ${selectedSortLabel}.` });
  });
  elements.showFavoritesOnly.addEventListener('change', () => {
    state.showFavoritesOnly = elements.showFavoritesOnly.checked;
    syncQuickControls();
    renderActiveFilterPills();
    renderList({ fromFilterChange: true });
    const modeMessage = state.showFavoritesOnly ? 'Saved-only filter enabled.' : 'Saved-only filter disabled.';
    updateStatus({ context: modeMessage });
  });

  if (elements.quickSearch) {
    elements.quickSearch.addEventListener('input', () => {
      elements.search.value = elements.quickSearch.value;
      renderList({ fromFilterChange: true });
    });
  }
  if (elements.quickCategory) {
    elements.quickCategory.addEventListener('change', () => {
      elements.category.value = elements.quickCategory.value;
      renderActiveFilterPills();
      renderList({ fromFilterChange: true });
    });
  }
  if (elements.quickTag) {
    elements.quickTag.addEventListener('change', () => {
      elements.tag.value = elements.quickTag.value;
      renderActiveFilterPills();
      renderList({ fromFilterChange: true });
    });
  }
  if (elements.quickFavoritesOnly) {
    elements.quickFavoritesOnly.addEventListener('change', () => {
      state.showFavoritesOnly = elements.quickFavoritesOnly.checked;
      elements.showFavoritesOnly.checked = state.showFavoritesOnly;
      renderActiveFilterPills();
      renderList({ fromFilterChange: true });
      const modeMessage = state.showFavoritesOnly ? 'Saved-only filter enabled.' : 'Saved-only filter disabled.';
      updateStatus({ context: modeMessage });
    });
  }

  elements.clearFilters.addEventListener('click', clearFilters);
  if (elements.quickClearFilters) {
    elements.quickClearFilters.addEventListener('click', clearFilters);
  }
  if (elements.activeFilters) {
    elements.activeFilters.addEventListener('click', (event) => {
      const removeButton = event.target instanceof Element ? event.target.closest('.active-filter-pill') : null;
      if (!removeButton) return;

      const filterType = removeButton.dataset.filterType;
      if (filterType === 'category') {
        elements.category.value = '';
      }
      if (filterType === 'tag') {
        elements.tag.value = '';
      }
      if (filterType === 'favorites') {
        state.showFavoritesOnly = false;
        elements.showFavoritesOnly.checked = false;
      }
      syncQuickControls();
      renderActiveFilterPills();
      renderList({ fromFilterChange: true });
      updateStatus({ context: 'Filter removed.' });
    });
  }

  elements.list.addEventListener('keydown', handleListKeyboardNavigation);
  elements.copyPrompt.addEventListener('click', copyViewerContent);
  if (elements.toggleFiltersPanel) {
    elements.toggleFiltersPanel.addEventListener('click', toggleFiltersPanel);
  }
  window.addEventListener('resize', applyFiltersPanelState);
  flashCopyButtonState('idle');
}

async function init() {
  try {
    elements.status.textContent = 'Loading prompts…';
    renderLoadingState();
    const indexEntries = await loadIndex();
    state.prompts = enhanceIndex(indexEntries);
    loadFavorites();

    fillFacetFilters(state.prompts);

    applyInitialStateFromUrl({
      paths: new Set(state.prompts.map((prompt) => prompt.path)),
      categories: new Set(state.prompts.map((prompt) => prompt.category).filter(Boolean)),
      tags: new Set(state.prompts.flatMap((prompt) => normalizeTags(prompt.tags)).map((tag) => normalizeCategory(tag))),
    });
    state.filtersCollapsed = loadFiltersPanelCollapsedState();
    applyFiltersPanelState();
    renderActiveFilterPills();

    addEventListeners();
    renderList();

    if (state.selectedPath) {
      const selectedEntry = state.prompts.find((entry) => entry.path === state.selectedPath);
      if (selectedEntry) {
        viewPrompt(selectedEntry, { focusViewer: false });
      }
    } else {
      syncUrlState();
      updateStatus();
    }
  } catch (error) {
    renderErrorState(error.message);
  }
}

init();
