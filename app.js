const OPEN_FIRST_RESULT_ON_FILTER_CHANGE = true;
const FAVORITES_STORAGE_KEY = 'promptManager.favorites.v1';
const LAST_SELECTED_STORAGE_KEY = 'promptManager.lastSelectedPath.v1';

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
};

const elements = {
  search: document.getElementById('search'),
  category: document.getElementById('category'),
  sort: document.getElementById('sort'),
  showFavoritesOnly: document.getElementById('show-favorites-only'),
  clearFilters: document.getElementById('clear-filters'),

  quickSearch: document.getElementById('search-quick'),
  quickCategory: document.getElementById('category-quick'),
  quickFavoritesOnly: document.getElementById('show-favorites-only-quick'),
  quickClearFilters: document.getElementById('clear-filters-quick'),

  status: document.getElementById('status'),
  list: document.getElementById('prompt-list'),
  viewer: document.getElementById('viewer'),
  viewerTitle: document.getElementById('viewer-title'),
  viewerMeta: document.getElementById('viewer-meta'),
  viewerContent: document.getElementById('viewer-content'),
  copyPrompt: document.getElementById('copy-prompt'),
  lineLengthToggle: document.getElementById('toggle-line-length'),
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
    const primaryOption = document.createElement('option');
    primaryOption.value = category;
    primaryOption.textContent = category;
    elements.category.append(primaryOption);

    if (elements.quickCategory) {
      const quickOption = document.createElement('option');
      quickOption.value = category;
      quickOption.textContent = category;
      elements.quickCategory.append(quickOption);
    }
  }
}

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get('search') || '',
    category: params.get('category') || '',
    sort: params.get('sort') || 'title-asc',
    selectedPath: params.get('selectedPath') || null,
    favoritesOnly: params.get('favoritesOnly') === 'true',
  };
}

function syncUrlState() {
  const params = new URLSearchParams();
  const searchValue = elements.search.value.trim();
  const categoryValue = elements.category.value;
  const sortValue = elements.sort.value;

  if (searchValue) params.set('search', searchValue);
  if (categoryValue) params.set('category', categoryValue);
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
  if (elements.quickFavoritesOnly) elements.quickFavoritesOnly.checked = state.showFavoritesOnly;
}

function currentQuery() {
  return {
    q: elements.search.value.trim().toLowerCase(),
    category: elements.category.value,
    sort: elements.sort.value,
    favoritesOnly: state.showFavoritesOnly,
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

function setTransientStatus(message, timeout = 2200) {
  state.statusFlash = message;
  if (state.statusTimer) {
    clearTimeout(state.statusTimer);
  }

  elements.status.textContent = message;
  state.statusTimer = setTimeout(() => {
    state.statusFlash = '';
    state.statusTimer = null;
    updateStatus();
  }, timeout);
}

function updateStatus() {
  if (state.statusFlash) {
    elements.status.textContent = state.statusFlash;
    return;
  }

  const total = state.prompts.length;
  const shown = state.filtered.length;
  const warningSuffix = state.storageWarning ? ` ${state.storageWarning}` : '';

  if (shown === 0) {
    elements.status.textContent = `No prompts matched your filters.${warningSuffix}`;
    return;
  }

  elements.status.textContent = `Showing ${shown} of ${total} prompt${total === 1 ? '' : 's'}.${warningSuffix}`;
}

function updateListSelectionUI() {
  for (const button of elements.list.querySelectorAll('.prompt-card')) {
    const isSelected = button.dataset.path === state.selectedPath;
    const isActive = button.dataset.path === state.activePath;

    button.dataset.selected = String(isSelected);
    button.dataset.active = String(isActive);
    button.setAttribute('aria-current', isSelected ? 'true' : 'false');
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
  const activeButton = elements.list.querySelector(`.prompt-card[data-path="${CSS.escape(path)}"]`);
  if (activeButton) {
    activeButton.focus({ preventScroll: false });
  }
}

function makePromptButton(entry) {
  const card = document.createElement('div');
  card.className = 'prompt-card';
  card.dataset.path = entry.path;
  card.dataset.selected = String(entry.path === state.selectedPath);
  card.dataset.active = String(entry.path === state.activePath);
  card.setAttribute('aria-current', String(entry.path === state.selectedPath));
  card.setAttribute('aria-label', `Open prompt: ${entry.title || entry.path}`);
  card.setAttribute('role', 'button');
  card.tabIndex = 0;

  const header = document.createElement('div');
  header.className = 'prompt-card-header';

  const title = document.createElement('span');
  title.className = 'prompt-title';
  title.textContent = entry.title || entry.path;

  const meta = document.createElement('span');
  meta.className = 'prompt-meta';
  meta.textContent = `${entry.category || 'Uncategorized'} • ${entry.path}`;

  const preview = document.createElement('span');
  preview.className = 'prompt-preview';
  preview.textContent = entry.preview || 'No description available.';

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
    isFavorite ? `Remove ${entry.title || entry.path} from favorites` : `Add ${entry.title || entry.path} to favorites`,
  );
  favoriteButton.textContent = isFavorite ? '★ Saved' : '☆ Save';
  favoriteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (state.favorites.has(entry.path)) {
      state.favorites.delete(entry.path);
    } else {
      state.favorites.add(entry.path);
    }
    saveFavorites();
    renderList({ fromFilterChange: true });
  });

  header.append(title, favoriteButton);
  card.append(header, meta, preview);
  if (tagGroup.children.length > 0) {
    card.append(tagGroup);
  }

  card.addEventListener('focus', () => setActivePrompt(entry.path));
  card.addEventListener('click', () => {
    setActivePrompt(entry.path);
    viewPrompt(entry);
  });

  return card;
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
      description: 'Try adjusting search terms, category filters, or favorites mode.',
    }),
  );
}

function renderErrorState(errorMessage) {
  elements.list.replaceChildren(
    buildStateCard({
      type: 'error',
      icon: '⚠️',
      title: 'Unable to load prompts',
      description: errorMessage,
    }),
  );
}

function renderList({ fromFilterChange = false } = {}) {
  const previousSelection = state.selectedPath;
  const { q, category, sort, favoritesOnly } = currentQuery();
  const matchesQuery = state.prompts.filter((entry) => matches(entry, q, category));
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
    const li = document.createElement('li');
    li.className = 'list-none';
    li.append(makePromptButton(entry));
    elements.list.append(li);
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

async function viewPrompt(entry, options = {}) {
  const { focusViewer = true } = options;

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
    title: entry.title || entry.path.split('/').pop().replace(/\.md$/i, ''),
    tags: entry.tags || [],
    preview: entry.description || '',
  }));
}

function clearFilters() {
  elements.search.value = '';
  elements.category.value = '';
  elements.sort.value = 'title-asc';
  elements.showFavoritesOnly.checked = false;
  state.showFavoritesOnly = false;
  syncQuickControls();
  renderList({ fromFilterChange: true });
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
    state.storageWarning = 'Favorites are available for this session only (localStorage unavailable).';
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(state.favorites)));
  } catch (_error) {
    state.storageWarning = 'Favorites are available for this session only (localStorage unavailable).';
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
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
    return;
  }

  if (elements.list.querySelectorAll('.prompt-card').length === 0) return;

  const currentIndex = state.activePath
    ? state.filtered.findIndex((entry) => entry.path === state.activePath)
    : 0;
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (safeCurrentIndex + direction + state.filtered.length) % state.filtered.length;
    const nextEntry = state.filtered[nextIndex];
    setActivePrompt(nextEntry.path, true);
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const activeEntry = state.filtered[safeCurrentIndex];
    if (activeEntry) {
      viewPrompt(activeEntry);
    }
  }
}

function copyViewerContent() {
  const text = elements.viewerContent.textContent || '';
  if (!text.trim()) {
    setTransientStatus('Nothing to copy yet.', 1800);
    return;
  }

  navigator.clipboard
    .writeText(text)
    .then(() => {
      setTransientStatus('Prompt copied to clipboard.', 2000);
    })
    .catch(() => {
      setTransientStatus('Unable to copy prompt. Check clipboard permissions.', 3000);
    });
}

function addEventListeners() {
  elements.search.addEventListener('input', () => {
    syncQuickControls();
    renderList({ fromFilterChange: true });
  });
  elements.category.addEventListener('change', () => {
    syncQuickControls();
    renderList({ fromFilterChange: true });
  });
  elements.sort.addEventListener('change', () => renderList({ fromFilterChange: true }));
  elements.showFavoritesOnly.addEventListener('change', () => {
    state.showFavoritesOnly = elements.showFavoritesOnly.checked;
    syncQuickControls();
    renderList({ fromFilterChange: true });
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
      renderList({ fromFilterChange: true });
    });
  }
  if (elements.quickFavoritesOnly) {
    elements.quickFavoritesOnly.addEventListener('change', () => {
      state.showFavoritesOnly = elements.quickFavoritesOnly.checked;
      elements.showFavoritesOnly.checked = state.showFavoritesOnly;
      renderList({ fromFilterChange: true });
    });
  }

  elements.clearFilters.addEventListener('click', clearFilters);
  if (elements.quickClearFilters) {
    elements.quickClearFilters.addEventListener('click', clearFilters);
  }

  elements.lineLengthToggle.addEventListener('change', () => {
    elements.viewerContent.classList.toggle('viewer-content--measure', elements.lineLengthToggle.checked);
  });

  elements.list.addEventListener('keydown', handleListKeyboardNavigation);
  elements.copyPrompt.addEventListener('click', copyViewerContent);
}

async function init() {
  try {
    elements.status.textContent = 'Loading prompts…';
    renderLoadingState();
    const indexEntries = await loadIndex();
    state.prompts = enhanceIndex(indexEntries);
    loadFavorites();

    fillCategoryFilter(state.prompts);

    applyInitialStateFromUrl({
      paths: new Set(state.prompts.map((prompt) => prompt.path)),
      categories: new Set(state.prompts.map((prompt) => prompt.category).filter(Boolean)),
    });

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
    elements.status.textContent = `Error: ${error.message}`;
    renderErrorState(error.message);
  }
}

init();
