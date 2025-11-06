/**
 * Advanced UI Features for Ansybl
 * Includes search, filtering, user preferences, and feed exploration tools
 */

class AnsyblAdvancedUI {
  constructor() {
    this.preferences = this.loadPreferences();
    this.searchIndex = new Map();
    this.filters = {
      tags: new Set(),
      authors: new Set(),
      dateRange: { start: null, end: null },
      contentType: 'all',
      hasAttachments: false
    };
    this.currentView = 'grid';
    this.sortBy = 'date';
    this.sortOrder = 'desc';
    
    this.init();
  }

  init() {
    this.createSearchInterface();
    this.createFilterInterface();
    this.createViewControls();
    this.createUserPreferences();
    this.createFeedExplorer();
    this.setupKeyboardShortcuts();
    this.buildSearchIndex();
    this.applyPreferences();
    this.setupInfiniteScroll();
  }

  createSearchInterface() {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.innerHTML = `
      <div class="search-bar">
        <div class="search-input-wrapper">
          <input type="search" 
                 id="content-search" 
                 placeholder="Search posts and comments..." 
                 aria-label="Search content"
                 autocomplete="off">
          <button class="search-btn" aria-label="Search">
            <span class="icon">🔍</span>
          </button>
          <button class="search-clear" aria-label="Clear search" style="display: none;">
            <span class="icon">✕</span>
          </button>
        </div>
        
        <div class="search-suggestions" id="search-suggestions" role="listbox" aria-label="Search suggestions"></div>
        
        <div class="search-results-info" id="search-results-info" aria-live="polite"></div>
      </div>
      
      <div class="advanced-search" id="advanced-search" style="display: none;">
        <h3>Advanced Search</h3>
        
        <div class="search-filters">
          <div class="filter-group">
            <label for="search-tags">Tags:</label>
            <input type="text" id="search-tags" placeholder="Enter tags (comma-separated)">
          </div>
          
          <div class="filter-group">
            <label for="search-author">Author:</label>
            <input type="text" id="search-author" placeholder="Author name">
          </div>
          
          <div class="filter-group">
            <label for="search-date-from">Date From:</label>
            <input type="date" id="search-date-from">
          </div>
          
          <div class="filter-group">
            <label for="search-date-to">Date To:</label>
            <input type="date" id="search-date-to">
          </div>
          
          <div class="filter-group">
            <label for="search-content-type">Content Type:</label>
            <select id="search-content-type">
              <option value="all">All Content</option>
              <option value="posts">Posts Only</option>
              <option value="comments">Comments Only</option>
              <option value="with-media">With Media</option>
            </select>
          </div>
        </div>
        
        <div class="search-actions">
          <button class="apply-filters-btn">Apply Filters</button>
          <button class="clear-filters-btn">Clear All</button>
        </div>
      </div>
    `;

    // Insert search before main content
    const main = document.querySelector('main');
    if (main) {
      main.parentNode.insertBefore(searchContainer, main);
    }

    this.setupSearchHandlers();
  }

  setupSearchHandlers() {
    const searchInput = document.getElementById('content-search');
    const searchBtn = document.querySelector('.search-btn');
    const clearBtn = document.querySelector('.search-clear');
    const advancedToggle = document.createElement('button');
    
    advancedToggle.className = 'advanced-search-toggle';
    advancedToggle.textContent = 'Advanced';
    advancedToggle.setAttribute('aria-expanded', 'false');
    advancedToggle.setAttribute('aria-controls', 'advanced-search');
    
    searchBtn.parentNode.appendChild(advancedToggle);

    // Real-time search
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      
      if (query.length === 0) {
        this.clearSearch();
        clearBtn.style.display = 'none';
        return;
      }
      
      clearBtn.style.display = 'block';
      
      // Debounce search
      searchTimeout = setTimeout(() => {
        this.performSearch(query);
        this.showSearchSuggestions(query);
      }, 300);
    });

    // Search button click
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        this.performSearch(query);
      }
    });

    // Clear search
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.clearSearch();
      clearBtn.style.display = 'none';
      searchInput.focus();
    });

    // Advanced search toggle
    advancedToggle.addEventListener('click', () => {
      const advancedSearch = document.getElementById('advanced-search');
      const isVisible = advancedSearch.style.display !== 'none';
      
      advancedSearch.style.display = isVisible ? 'none' : 'block';
      advancedToggle.setAttribute('aria-expanded', !isVisible);
      advancedToggle.textContent = isVisible ? 'Advanced' : 'Hide Advanced';
    });

    // Advanced search filters
    document.querySelector('.apply-filters-btn').addEventListener('click', () => {
      this.applyAdvancedFilters();
    });

    document.querySelector('.clear-filters-btn').addEventListener('click', () => {
      this.clearAllFilters();
    });

    // Keyboard navigation for search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSearch();
        searchInput.blur();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.performSearch(searchInput.value.trim());
      }
    });
  }

  createFilterInterface() {
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterContainer.innerHTML = `
      <div class="filter-bar">
        <div class="filter-controls">
          <div class="filter-group">
            <label for="sort-by">Sort by:</label>
            <select id="sort-by">
              <option value="date">Date</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="interactions">Interactions</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label for="sort-order">Order:</label>
            <select id="sort-order">
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
          
          <div class="filter-group">
            <button class="filter-toggle-btn" aria-expanded="false" aria-controls="filter-panel">
              <span class="icon">🔽</span> Filters
            </button>
          </div>
        </div>
        
        <div class="active-filters" id="active-filters"></div>
      </div>
      
      <div class="filter-panel" id="filter-panel" style="display: none;">
        <div class="filter-sections">
          <div class="filter-section">
            <h4>Tags</h4>
            <div class="tag-filters" id="tag-filters"></div>
          </div>
          
          <div class="filter-section">
            <h4>Authors</h4>
            <div class="author-filters" id="author-filters"></div>
          </div>
          
          <div class="filter-section">
            <h4>Content Type</h4>
            <div class="content-type-filters">
              <label><input type="radio" name="content-filter" value="all" checked> All</label>
              <label><input type="radio" name="content-filter" value="posts"> Posts</label>
              <label><input type="radio" name="content-filter" value="comments"> Comments</label>
              <label><input type="radio" name="content-filter" value="media"> With Media</label>
            </div>
          </div>
        </div>
      </div>
    `;

    const searchContainer = document.querySelector('.search-container');
    if (searchContainer) {
      searchContainer.appendChild(filterContainer);
    }

    this.setupFilterHandlers();
    this.populateFilterOptions();
  }

  populateFilterOptions() {
    // Populate tag filters
    const tagFilters = document.getElementById('tag-filters');
    const authorFilters = document.getElementById('author-filters');
    
    if (tagFilters && authorFilters) {
      const tags = new Set();
      const authors = new Set();
      
      this.searchIndex.forEach(item => {
        item.tags.forEach(tag => tags.add(tag));
        if (item.author) authors.add(item.author);
      });
      
      // Create tag filter buttons
      tags.forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'filter-tag';
        btn.textContent = tag;
        btn.addEventListener('click', () => this.toggleTagFilter(tag, btn));
        tagFilters.appendChild(btn);
      });
      
      // Create author filter buttons
      authors.forEach(author => {
        const btn = document.createElement('button');
        btn.className = 'filter-author';
        btn.textContent = author;
        btn.addEventListener('click', () => this.toggleAuthorFilter(author, btn));
        authorFilters.appendChild(btn);
      });
    }
  }

  toggleTagFilter(tag, btn) {
    if (this.filters.tags.has(tag)) {
      this.filters.tags.delete(tag);
      btn.classList.remove('active');
    } else {
      this.filters.tags.add(tag);
      btn.classList.add('active');
    }
    this.applyFilters();
    this.updateActiveFilters();
  }

  toggleAuthorFilter(author, btn) {
    if (this.filters.authors.has(author)) {
      this.filters.authors.delete(author);
      btn.classList.remove('active');
    } else {
      this.filters.authors.add(author);
      btn.classList.add('active');
    }
    this.applyFilters();
    this.updateActiveFilters();
  }

  applyAdvancedFilters() {
    const tags = document.getElementById('search-tags').value;
    const author = document.getElementById('search-author').value;
    const dateFrom = document.getElementById('search-date-from').value;
    const dateTo = document.getElementById('search-date-to').value;
    const contentType = document.getElementById('search-content-type').value;

    // Clear existing filters
    this.filters.tags.clear();
    this.filters.authors.clear();

    // Apply new filters
    if (tags) {
      tags.split(',').forEach(tag => {
        const trimmedTag = tag.trim();
        if (trimmedTag) this.filters.tags.add(trimmedTag);
      });
    }

    if (author) {
      this.filters.authors.add(author.trim());
    }

    this.filters.dateRange.start = dateFrom ? new Date(dateFrom) : null;
    this.filters.dateRange.end = dateTo ? new Date(dateTo) : null;
    this.filters.contentType = contentType;

    this.applyFilters();
    this.updateActiveFilters();
  }

  clearAllFilters() {
    this.filters.tags.clear();
    this.filters.authors.clear();
    this.filters.dateRange.start = null;
    this.filters.dateRange.end = null;
    this.filters.contentType = 'all';
    this.filters.hasAttachments = false;

    // Clear UI
    document.querySelectorAll('.filter-tag.active, .filter-author.active').forEach(btn => {
      btn.classList.remove('active');
    });

    document.getElementById('search-tags').value = '';
    document.getElementById('search-author').value = '';
    document.getElementById('search-date-from').value = '';
    document.getElementById('search-date-to').value = '';
    document.getElementById('search-content-type').value = 'all';

    this.applyFilters();
    this.updateActiveFilters();
  }

  applyFilters() {
    this.searchIndex.forEach(item => {
      let visible = true;

      // Tag filter
      if (this.filters.tags.size > 0) {
        const hasMatchingTag = item.tags.some(tag => this.filters.tags.has(tag));
        if (!hasMatchingTag) visible = false;
      }

      // Author filter
      if (this.filters.authors.size > 0) {
        if (!this.filters.authors.has(item.author)) visible = false;
      }

      // Date range filter
      if (this.filters.dateRange.start || this.filters.dateRange.end) {
        const itemDate = new Date(item.date);
        if (this.filters.dateRange.start && itemDate < this.filters.dateRange.start) visible = false;
        if (this.filters.dateRange.end && itemDate > this.filters.dateRange.end) visible = false;
      }

      // Content type filter
      if (this.filters.contentType !== 'all') {
        if (this.filters.contentType === 'posts' && item.type !== 'post') visible = false;
        if (this.filters.contentType === 'comments' && item.type !== 'comment') visible = false;
        if (this.filters.contentType === 'media') {
          const hasMedia = item.element.querySelector('img, video, audio, .attachment');
          if (!hasMedia) visible = false;
        }
      }

      item.element.style.display = visible ? 'block' : 'none';
    });

    this.applyView();
  }

  updateActiveFilters() {
    const activeFiltersContainer = document.getElementById('active-filters');
    if (!activeFiltersContainer) return;

    activeFiltersContainer.innerHTML = '';

    // Add tag filters
    this.filters.tags.forEach(tag => {
      const filter = document.createElement('div');
      filter.className = 'active-filter';
      filter.innerHTML = `
        <span>Tag: ${tag}</span>
        <span class="remove" onclick="ansyblAdvancedUI.removeTagFilter('${tag}')">&times;</span>
      `;
      activeFiltersContainer.appendChild(filter);
    });

    // Add author filters
    this.filters.authors.forEach(author => {
      const filter = document.createElement('div');
      filter.className = 'active-filter';
      filter.innerHTML = `
        <span>Author: ${author}</span>
        <span class="remove" onclick="ansyblAdvancedUI.removeAuthorFilter('${author}')">&times;</span>
      `;
      activeFiltersContainer.appendChild(filter);
    });

    // Add date range filter
    if (this.filters.dateRange.start || this.filters.dateRange.end) {
      const filter = document.createElement('div');
      filter.className = 'active-filter';
      const startStr = this.filters.dateRange.start ? this.filters.dateRange.start.toLocaleDateString() : 'Start';
      const endStr = this.filters.dateRange.end ? this.filters.dateRange.end.toLocaleDateString() : 'End';
      filter.innerHTML = `
        <span>Date: ${startStr} - ${endStr}</span>
        <span class="remove" onclick="ansyblAdvancedUI.removeDateFilter()">&times;</span>
      `;
      activeFiltersContainer.appendChild(filter);
    }

    // Add content type filter
    if (this.filters.contentType !== 'all') {
      const filter = document.createElement('div');
      filter.className = 'active-filter';
      filter.innerHTML = `
        <span>Type: ${this.filters.contentType}</span>
        <span class="remove" onclick="ansyblAdvancedUI.removeContentTypeFilter()">&times;</span>
      `;
      activeFiltersContainer.appendChild(filter);
    }
  }

  removeTagFilter(tag) {
    this.filters.tags.delete(tag);
    const btn = Array.from(document.querySelectorAll('.filter-tag')).find(b => b.textContent === tag);
    if (btn) btn.classList.remove('active');
    this.applyFilters();
    this.updateActiveFilters();
  }

  removeAuthorFilter(author) {
    this.filters.authors.delete(author);
    const btn = Array.from(document.querySelectorAll('.filter-author')).find(b => b.textContent === author);
    if (btn) btn.classList.remove('active');
    this.applyFilters();
    this.updateActiveFilters();
  }

  removeDateFilter() {
    this.filters.dateRange.start = null;
    this.filters.dateRange.end = null;
    document.getElementById('search-date-from').value = '';
    document.getElementById('search-date-to').value = '';
    this.applyFilters();
    this.updateActiveFilters();
  }

  removeContentTypeFilter() {
    this.filters.contentType = 'all';
    document.getElementById('search-content-type').value = 'all';
    const allRadio = document.querySelector('input[name="content-filter"][value="all"]');
    if (allRadio) allRadio.checked = true;
    this.applyFilters();
    this.updateActiveFilters();
  }

  applySorting() {
    const items = Array.from(this.searchIndex.values());
    
    items.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'date':
          comparison = new Date(a.date) - new Date(b.date);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'author':
          comparison = a.author.localeCompare(b.author);
          break;
        case 'interactions':
          const aInteractions = this.getInteractionCount(a.element);
          const bInteractions = this.getInteractionCount(b.element);
          comparison = aInteractions - bInteractions;
          break;
      }
      
      return this.sortOrder === 'desc' ? -comparison : comparison;
    });

    // Reorder DOM elements
    const container = document.querySelector('main .posts') || document.querySelector('main');
    if (container) {
      items.forEach(item => {
        if (item.element.style.display !== 'none') {
          container.appendChild(item.element);
        }
      });
    }
  }

  getInteractionCount(element) {
    const interactions = element.querySelectorAll('.interaction-count');
    let total = 0;
    interactions.forEach(interaction => {
      const count = parseInt(interaction.textContent.match(/\d+/)?.[0] || '0');
      total += count;
    });
    return total;
  }

  showSearchSuggestions(query) {
    const suggestions = document.getElementById('search-suggestions');
    if (!suggestions) return;

    const terms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    const suggestionSet = new Set();

    // Add tag suggestions
    this.searchIndex.forEach(item => {
      item.tags.forEach(tag => {
        if (tag.toLowerCase().includes(terms[terms.length - 1])) {
          suggestionSet.add(`Tag: ${tag}`);
        }
      });
    });

    // Add author suggestions
    this.searchIndex.forEach(item => {
      if (item.author.toLowerCase().includes(terms[terms.length - 1])) {
        suggestionSet.add(`Author: ${item.author}`);
      }
    });

    // Add title suggestions
    this.searchIndex.forEach(item => {
      const titleWords = item.title.toLowerCase().split(' ');
      titleWords.forEach(word => {
        if (word.includes(terms[terms.length - 1]) && word.length > 2) {
          suggestionSet.add(`Title: ${item.title}`);
        }
      });
    });

    const suggestionArray = Array.from(suggestionSet).slice(0, 5);
    
    if (suggestionArray.length > 0) {
      suggestions.innerHTML = suggestionArray.map(suggestion => 
        `<div class="search-suggestion" onclick="ansyblAdvancedUI.applySuggestion('${suggestion}')">${suggestion}</div>`
      ).join('');
      suggestions.style.display = 'block';
    } else {
      suggestions.style.display = 'none';
    }
  }

  applySuggestion(suggestion) {
    const searchInput = document.getElementById('content-search');
    const [type, value] = suggestion.split(': ');
    
    if (type === 'Tag') {
      this.filters.tags.add(value);
      const btn = Array.from(document.querySelectorAll('.filter-tag')).find(b => b.textContent === value);
      if (btn) btn.classList.add('active');
    } else if (type === 'Author') {
      this.filters.authors.add(value);
      const btn = Array.from(document.querySelectorAll('.filter-author')).find(b => b.textContent === value);
      if (btn) btn.classList.add('active');
    } else {
      searchInput.value = value;
      this.performSearch(value);
    }

    document.getElementById('search-suggestions').style.display = 'none';
    this.applyFilters();
    this.updateActiveFilters();
  }

  setupFilterHandlers() {
    const sortBy = document.getElementById('sort-by');
    const sortOrder = document.getElementById('sort-order');
    const filterToggle = document.querySelector('.filter-toggle-btn');
    const filterPanel = document.getElementById('filter-panel');

    // Sort controls
    sortBy.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.applySorting();
      this.savePreferences();
    });

    sortOrder.addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.applySorting();
      this.savePreferences();
    });

    // Filter panel toggle
    filterToggle.addEventListener('click', () => {
      const isVisible = filterPanel.style.display !== 'none';
      filterPanel.style.display = isVisible ? 'none' : 'block';
      filterToggle.setAttribute('aria-expanded', !isVisible);
      
      const icon = filterToggle.querySelector('.icon');
      icon.textContent = isVisible ? '🔽' : '🔼';
    });

    // Content type filters
    const contentFilters = document.querySelectorAll('input[name="content-filter"]');
    contentFilters.forEach(filter => {
      filter.addEventListener('change', (e) => {
        this.filters.contentType = e.target.value;
        this.applyFilters();
        this.updateActiveFilters();
      });
    });
  }

  createViewControls() {
    const viewContainer = document.createElement('div');
    viewContainer.className = 'view-controls';
    viewContainer.innerHTML = `
      <div class="view-options">
        <button class="view-btn active" data-view="grid" aria-label="Grid view">
          <span class="icon">⊞</span>
        </button>
        <button class="view-btn" data-view="list" aria-label="List view">
          <span class="icon">☰</span>
        </button>
        <button class="view-btn" data-view="card" aria-label="Card view">
          <span class="icon">▢</span>
        </button>
      </div>
      
      <div class="display-options">
        <label class="toggle-option">
          <input type="checkbox" id="show-previews" checked>
          <span>Show Previews</span>
        </label>
        
        <label class="toggle-option">
          <input type="checkbox" id="show-interactions" checked>
          <span>Show Interactions</span>
        </label>
        
        <label class="toggle-option">
          <input type="checkbox" id="auto-refresh">
          <span>Auto Refresh</span>
        </label>
      </div>
    `;

    const filterContainer = document.querySelector('.filter-container');
    if (filterContainer) {
      filterContainer.appendChild(viewContainer);
    }

    this.setupViewHandlers();
  }

  setupViewHandlers() {
    const viewBtns = document.querySelectorAll('.view-btn');
    const showPreviews = document.getElementById('show-previews');
    const showInteractions = document.getElementById('show-interactions');
    const autoRefresh = document.getElementById('auto-refresh');

    // View switching
    viewBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        this.currentView = btn.dataset.view;
        this.applyView();
        this.savePreferences();
      });
    });

    // Display options
    showPreviews.addEventListener('change', (e) => {
      this.preferences.showPreviews = e.target.checked;
      this.applyDisplayOptions();
      this.savePreferences();
    });

    showInteractions.addEventListener('change', (e) => {
      this.preferences.showInteractions = e.target.checked;
      this.applyDisplayOptions();
      this.savePreferences();
    });

    autoRefresh.addEventListener('change', (e) => {
      this.preferences.autoRefresh = e.target.checked;
      this.setupAutoRefresh();
      this.savePreferences();
    });
  } 
 createUserPreferences() {
    const prefsContainer = document.createElement('div');
    prefsContainer.className = 'preferences-container';
    prefsContainer.innerHTML = `
      <button class="preferences-btn" aria-label="Open preferences">
        <span class="icon">⚙️</span>
      </button>
      
      <div class="preferences-panel" id="preferences-panel" style="display: none;">
        <div class="preferences-header">
          <h3>User Preferences</h3>
          <button class="close-preferences" aria-label="Close preferences">✕</button>
        </div>
        
        <div class="preferences-content">
          <div class="pref-section">
            <h4>Theme</h4>
            <div class="theme-options">
              <label><input type="radio" name="theme" value="auto" checked> Auto</label>
              <label><input type="radio" name="theme" value="light"> Light</label>
              <label><input type="radio" name="theme" value="dark"> Dark</label>
            </div>
          </div>
          
          <div class="pref-section">
            <h4>Font Size</h4>
            <div class="font-size-control">
              <input type="range" id="font-size" min="12" max="20" value="14" step="1">
              <span id="font-size-value">14px</span>
            </div>
          </div>
          
          <div class="pref-section">
            <h4>Accessibility</h4>
            <label class="pref-option">
              <input type="checkbox" id="high-contrast">
              <span>High Contrast Mode</span>
            </label>
            <label class="pref-option">
              <input type="checkbox" id="reduce-motion">
              <span>Reduce Motion</span>
            </label>
            <label class="pref-option">
              <input type="checkbox" id="focus-indicators">
              <span>Enhanced Focus Indicators</span>
            </label>
          </div>
          
          <div class="pref-section">
            <h4>Content</h4>
            <label class="pref-option">
              <input type="checkbox" id="auto-load-images" checked>
              <span>Auto-load Images</span>
            </label>
            <label class="pref-option">
              <input type="checkbox" id="show-timestamps" checked>
              <span>Show Timestamps</span>
            </label>
            <label class="pref-option">
              <input type="checkbox" id="compact-mode">
              <span>Compact Mode</span>
            </label>
          </div>
          
          <div class="pref-section">
            <h4>Notifications</h4>
            <label class="pref-option">
              <input type="checkbox" id="desktop-notifications">
              <span>Desktop Notifications</span>
            </label>
            <label class="pref-option">
              <input type="checkbox" id="sound-notifications">
              <span>Sound Notifications</span>
            </label>
          </div>
        </div>
        
        <div class="preferences-actions">
          <button class="reset-preferences-btn">Reset to Defaults</button>
          <button class="export-preferences-btn">Export Settings</button>
          <button class="import-preferences-btn">Import Settings</button>
        </div>
      </div>
    `;

    // Add to header
    const header = document.querySelector('.site-header');
    if (header) {
      header.appendChild(prefsContainer);
    }

    this.setupPreferencesHandlers();
  }

  setupPreferencesHandlers() {
    const prefsBtn = document.querySelector('.preferences-btn');
    const prefsPanel = document.getElementById('preferences-panel');
    const closeBtn = document.querySelector('.close-preferences');

    // Open/close preferences
    prefsBtn.addEventListener('click', () => {
      const isVisible = prefsPanel.style.display !== 'none';
      prefsPanel.style.display = isVisible ? 'none' : 'block';
      
      if (!isVisible) {
        // Focus first control for accessibility
        const firstInput = prefsPanel.querySelector('input');
        if (firstInput) {
          setTimeout(() => firstInput.focus(), 100);
        }
      }
    });

    closeBtn.addEventListener('click', () => {
      prefsPanel.style.display = 'none';
      prefsBtn.focus();
    });

    // Theme selection
    const themeInputs = document.querySelectorAll('input[name="theme"]');
    themeInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        this.preferences.theme = e.target.value;
        this.applyTheme();
        this.savePreferences();
      });
    });

    // Font size
    const fontSizeSlider = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    
    fontSizeSlider.addEventListener('input', (e) => {
      const size = e.target.value;
      fontSizeValue.textContent = `${size}px`;
      this.preferences.fontSize = parseInt(size);
      this.applyFontSize();
      this.savePreferences();
    });

    // Accessibility options
    const accessibilityOptions = ['high-contrast', 'reduce-motion', 'focus-indicators'];
    accessibilityOptions.forEach(option => {
      const checkbox = document.getElementById(option);
      checkbox.addEventListener('change', (e) => {
        this.preferences[option.replace('-', '')] = e.target.checked;
        this.applyAccessibilityOptions();
        this.savePreferences();
      });
    });

    // Content options
    const contentOptions = ['auto-load-images', 'show-timestamps', 'compact-mode'];
    contentOptions.forEach(option => {
      const checkbox = document.getElementById(option);
      checkbox.addEventListener('change', (e) => {
        this.preferences[option.replace(/-/g, '')] = e.target.checked;
        this.applyContentOptions();
        this.savePreferences();
      });
    });

    // Notification options
    const notificationOptions = ['desktop-notifications', 'sound-notifications'];
    notificationOptions.forEach(option => {
      const checkbox = document.getElementById(option);
      checkbox.addEventListener('change', (e) => {
        this.preferences[option.replace(/-/g, '')] = e.target.checked;
        this.setupNotifications();
        this.savePreferences();
      });
    });

    // Action buttons
    document.querySelector('.reset-preferences-btn').addEventListener('click', () => {
      this.resetPreferences();
    });

    document.querySelector('.export-preferences-btn').addEventListener('click', () => {
      this.exportPreferences();
    });

    document.querySelector('.import-preferences-btn').addEventListener('click', () => {
      this.importPreferences();
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when not in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
        return;
      }

      // Ctrl/Cmd + key combinations
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            this.focusSearch();
            break;
          case 'n':
            e.preventDefault();
            this.openCreatePost();
            break;
          case ',':
            e.preventDefault();
            this.openPreferences();
            break;
        }
      }

      // Single key shortcuts
      switch (e.key) {
        case '/':
          e.preventDefault();
          this.focusSearch();
          break;
        case 'Escape':
          this.closeAllPanels();
          break;
        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.refreshContent();
          }
          break;
        case '1':
        case '2':
        case '3':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.switchView(['grid', 'list', 'card'][parseInt(e.key) - 1]);
          }
          break;
      }
    });

    // Show keyboard shortcuts help
    this.createKeyboardShortcutsHelp();
  }

  createKeyboardShortcutsHelp() {
    const helpBtn = document.createElement('button');
    helpBtn.className = 'keyboard-help-btn';
    helpBtn.innerHTML = '<span class="icon">⌨️</span>';
    helpBtn.setAttribute('aria-label', 'Show keyboard shortcuts');
    helpBtn.title = 'Keyboard shortcuts (?)';

    const prefsContainer = document.querySelector('.preferences-container');
    if (prefsContainer) {
      prefsContainer.appendChild(helpBtn);
    }

    helpBtn.addEventListener('click', () => {
      this.showKeyboardShortcuts();
    });

    // Also show on '?' key
    document.addEventListener('keydown', (e) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && 
          e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.showKeyboardShortcuts();
      }
    });
  }

  showKeyboardShortcuts() {
    const modal = document.createElement('div');
    modal.className = 'keyboard-shortcuts-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Keyboard Shortcuts</h3>
          <button class="close-modal" aria-label="Close">✕</button>
        </div>
        <div class="shortcuts-list">
          <div class="shortcut-section">
            <h4>Navigation</h4>
            <div class="shortcut"><kbd>/</kbd> or <kbd>Ctrl+K</kbd> - Focus search</div>
            <div class="shortcut"><kbd>Ctrl+N</kbd> - Create new post</div>
            <div class="shortcut"><kbd>Ctrl+,</kbd> - Open preferences</div>
            <div class="shortcut"><kbd>Esc</kbd> - Close panels</div>
          </div>
          <div class="shortcut-section">
            <h4>Views</h4>
            <div class="shortcut"><kbd>1</kbd> - Grid view</div>
            <div class="shortcut"><kbd>2</kbd> - List view</div>
            <div class="shortcut"><kbd>3</kbd> - Card view</div>
            <div class="shortcut"><kbd>R</kbd> - Refresh content</div>
          </div>
          <div class="shortcut-section">
            <h4>Help</h4>
            <div class="shortcut"><kbd>?</kbd> - Show this help</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    });

    // Focus close button for accessibility
    closeBtn.focus();
  }

  // Search functionality
  buildSearchIndex() {
    const posts = document.querySelectorAll('.post-preview, .post');
    const comments = document.querySelectorAll('.comment');

    [...posts, ...comments].forEach((item, index) => {
      const content = {
        id: index,
        element: item,
        title: item.querySelector('h2, h3')?.textContent || '',
        content: item.querySelector('.post-content, .comment-content')?.textContent || '',
        author: item.querySelector('.post-author, .comment-author')?.textContent || '',
        tags: Array.from(item.querySelectorAll('.tag')).map(tag => tag.textContent),
        date: item.querySelector('time')?.getAttribute('datetime') || '',
        type: item.classList.contains('comment') ? 'comment' : 'post'
      };

      this.searchIndex.set(index, content);
    });
  }

  performSearch(query) {
    const results = [];
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);

    this.searchIndex.forEach((item) => {
      const searchableText = [
        item.title,
        item.content,
        item.author,
        ...item.tags
      ].join(' ').toLowerCase();

      const matches = searchTerms.filter(term => searchableText.includes(term));
      const score = matches.length / searchTerms.length;

      if (score > 0) {
        results.push({ ...item, score });
      }
    });

    // Sort by relevance
    results.sort((a, b) => b.score - a.score);

    this.displaySearchResults(results, query);
    this.updateSearchResultsInfo(results.length, query);
  }

  displaySearchResults(results, query) {
    // Hide all items first
    this.searchIndex.forEach(item => {
      item.element.style.display = 'none';
    });

    // Show matching items
    results.forEach(result => {
      result.element.style.display = 'block';
      this.highlightSearchTerms(result.element, query);
    });

    // Update view
    this.applyView();
  }

  highlightSearchTerms(element, query) {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    const textNodes = this.getTextNodes(element);

    textNodes.forEach(node => {
      let text = node.textContent;
      let highlightedText = text;

      searchTerms.forEach(term => {
        const regex = new RegExp(`(${term})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
      });

      if (highlightedText !== text) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = highlightedText;
        node.parentNode.replaceChild(wrapper, node);
      }
    });
  }

  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }

    return textNodes;
  }

  clearSearch() {
    // Remove highlights
    const highlights = document.querySelectorAll('mark');
    highlights.forEach(mark => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });

    // Show all items
    this.searchIndex.forEach(item => {
      item.element.style.display = 'block';
    });

    this.updateSearchResultsInfo(0, '');
    this.applyView();
  }

  updateSearchResultsInfo(count, query) {
    const info = document.getElementById('search-results-info');
    if (info) {
      if (count > 0) {
        info.textContent = `Found ${count} result${count !== 1 ? 's' : ''} for "${query}"`;
        info.style.display = 'block';
      } else if (query) {
        info.textContent = `No results found for "${query}"`;
        info.style.display = 'block';
      } else {
        info.style.display = 'none';
      }
    }
  }

  // Utility methods
  focusSearch() {
    const searchInput = document.getElementById('content-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  openCreatePost() {
    const createBtn = document.querySelector('.create-post-btn');
    if (createBtn) {
      createBtn.click();
    }
  }

  openPreferences() {
    const prefsBtn = document.querySelector('.preferences-btn');
    if (prefsBtn) {
      prefsBtn.click();
    }
  }

  closeAllPanels() {
    const panels = document.querySelectorAll('.preferences-panel, .filter-panel, .advanced-search');
    panels.forEach(panel => {
      panel.style.display = 'none';
    });

    // Update ARIA attributes
    const toggles = document.querySelectorAll('[aria-expanded="true"]');
    toggles.forEach(toggle => {
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  refreshContent() {
    if (window.ansyblRealtime && window.ansyblRealtime.isConnected()) {
      // Trigger a refresh through WebSocket
      window.location.reload();
    } else {
      window.location.reload();
    }
  }

  switchView(view) {
    if (['grid', 'list', 'card'].includes(view)) {
      this.currentView = view;
      
      // Update active button
      document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      document.querySelector(`[data-view="${view}"]`).classList.add('active');
      
      this.applyView();
      this.savePreferences();
    }
  }

  applyView() {
    const main = document.querySelector('main');
    if (!main) return;

    // Remove existing view classes
    main.classList.remove('grid-view', 'list-view', 'card-view');
    
    // Add current view class
    main.classList.add(`${this.currentView}-view`);
  }

  // Preferences management
  loadPreferences() {
    const defaultPrefs = {
      theme: 'auto',
      fontSize: 14,
      highcontrast: false,
      reducemotion: false,
      focusindicators: false,
      autoloadimages: true,
      showtimestamps: true,
      compactmode: false,
      desktopnotifications: false,
      soundnotifications: false,
      showPreviews: true,
      showInteractions: true,
      autoRefresh: false,
      view: 'grid',
      sortBy: 'date',
      sortOrder: 'desc'
    };

    try {
      const saved = localStorage.getItem('ansybl-preferences');
      return saved ? { ...defaultPrefs, ...JSON.parse(saved) } : defaultPrefs;
    } catch (error) {
      console.error('Failed to load preferences:', error);
      return defaultPrefs;
    }
  }

  savePreferences() {
    try {
      localStorage.setItem('ansybl-preferences', JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  applyPreferences() {
    this.applyTheme();
    this.applyFontSize();
    this.applyAccessibilityOptions();
    this.applyContentOptions();
    this.applyDisplayOptions();
    this.setupNotifications();
    this.setupAutoRefresh();
    
    // Update UI controls
    this.updatePreferencesUI();
  }

  updatePreferencesUI() {
    // Theme
    const themeInput = document.querySelector(`input[name="theme"][value="${this.preferences.theme}"]`);
    if (themeInput) themeInput.checked = true;

    // Font size
    const fontSizeSlider = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    if (fontSizeSlider) {
      fontSizeSlider.value = this.preferences.fontSize;
      fontSizeValue.textContent = `${this.preferences.fontSize}px`;
    }

    // Checkboxes
    const checkboxes = {
      'high-contrast': 'highcontrast',
      'reduce-motion': 'reducemotion',
      'focus-indicators': 'focusindicators',
      'auto-load-images': 'autoloadimages',
      'show-timestamps': 'showtimestamps',
      'compact-mode': 'compactmode',
      'desktop-notifications': 'desktopnotifications',
      'sound-notifications': 'soundnotifications',
      'show-previews': 'showPreviews',
      'show-interactions': 'showInteractions',
      'auto-refresh': 'autoRefresh'
    };

    Object.entries(checkboxes).forEach(([id, pref]) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.checked = this.preferences[pref];
      }
    });

    // View and sort
    const viewBtn = document.querySelector(`[data-view="${this.preferences.view || this.currentView}"]`);
    if (viewBtn) {
      document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
      viewBtn.classList.add('active');
    }

    const sortBy = document.getElementById('sort-by');
    const sortOrder = document.getElementById('sort-order');
    if (sortBy) sortBy.value = this.preferences.sortBy || this.sortBy;
    if (sortOrder) sortOrder.value = this.preferences.sortOrder || this.sortOrder;
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.preferences.theme);
  }

  applyFontSize() {
    document.documentElement.style.setProperty('--base-font-size', `${this.preferences.fontSize}px`);
  }

  applyAccessibilityOptions() {
    document.documentElement.classList.toggle('high-contrast', this.preferences.highcontrast);
    document.documentElement.classList.toggle('reduce-motion', this.preferences.reducemotion);
    document.documentElement.classList.toggle('enhanced-focus', this.preferences.focusindicators);
  }

  applyContentOptions() {
    document.documentElement.classList.toggle('no-auto-images', !this.preferences.autoloadimages);
    document.documentElement.classList.toggle('hide-timestamps', !this.preferences.showtimestamps);
    document.documentElement.classList.toggle('compact-mode', this.preferences.compactmode);
  }

  applyDisplayOptions() {
    document.documentElement.classList.toggle('hide-previews', !this.preferences.showPreviews);
    document.documentElement.classList.toggle('hide-interactions', !this.preferences.showInteractions);
  }

  setupNotifications() {
    if (this.preferences.desktopnotifications && 'Notification' in window) {
      Notification.requestPermission();
    }
  }

  setupAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    if (this.preferences.autoRefresh) {
      this.autoRefreshInterval = setInterval(() => {
        this.refreshContent();
      }, 300000); // 5 minutes
    }
  }

  resetPreferences() {
    if (confirm('Reset all preferences to defaults?')) {
      localStorage.removeItem('ansybl-preferences');
      this.preferences = this.loadPreferences();
      this.applyPreferences();
    }
  }

  exportPreferences() {
    const data = JSON.stringify(this.preferences, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ansybl-preferences.json';
    a.click();
    
    URL.revokeObjectURL(url);
  }

  importPreferences() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const imported = JSON.parse(e.target.result);
            this.preferences = { ...this.preferences, ...imported };
            this.applyPreferences();
            this.savePreferences();
            alert('Preferences imported successfully!');
          } catch (error) {
            alert('Failed to import preferences: Invalid file format');
          }
        };
        reader.readAsText(file);
      }
    });
    
    input.click();
  }

  setupInfiniteScroll() {
    // Placeholder for infinite scroll functionality
    // Would integrate with backend pagination
    let loading = false;
    
    window.addEventListener('scroll', () => {
      if (loading) return;
      
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      
      if (scrollTop + clientHeight >= scrollHeight - 1000) {
        loading = true;
        // Load more content
        setTimeout(() => {
          loading = false;
        }, 1000);
      }
    });
  }

  // Feed exploration tools
  createFeedExplorer() {
    const explorerContainer = document.createElement('div');
    explorerContainer.className = 'feed-explorer';
    explorerContainer.innerHTML = `
      <div class="explorer-header">
        <h3>📊 Feed Explorer</h3>
        <button class="explorer-toggle" aria-expanded="false" aria-controls="explorer-content">
          <span class="icon">📈</span> Analytics
        </button>
      </div>
      
      <div class="explorer-content" id="explorer-content" style="display: none;">
        <div class="explorer-tabs">
          <button class="explorer-tab active" data-tab="analytics">Analytics</button>
          <button class="explorer-tab" data-tab="timeline">Timeline</button>
          <button class="explorer-tab" data-tab="network">Network</button>
          <button class="explorer-tab" data-tab="trends">Trends</button>
        </div>
        
        <div class="explorer-panels">
          <div class="explorer-panel active" id="analytics-panel">
            <div class="analytics-grid">
              <div class="stat-card">
                <h4>Total Posts</h4>
                <div class="stat-value" id="total-posts">0</div>
              </div>
              <div class="stat-card">
                <h4>Total Comments</h4>
                <div class="stat-value" id="total-comments">0</div>
              </div>
              <div class="stat-card">
                <h4>Total Interactions</h4>
                <div class="stat-value" id="total-interactions">0</div>
              </div>
              <div class="stat-card">
                <h4>Active Authors</h4>
                <div class="stat-value" id="active-authors">0</div>
              </div>
            </div>
            
            <div class="analytics-charts">
              <div class="chart-container">
                <h4>Content Distribution</h4>
                <div class="content-distribution" id="content-distribution"></div>
              </div>
              
              <div class="chart-container">
                <h4>Popular Tags</h4>
                <div class="tag-cloud" id="tag-cloud"></div>
              </div>
            </div>
          </div>
          
          <div class="explorer-panel" id="timeline-panel">
            <div class="timeline-controls">
              <select id="timeline-period">
                <option value="day">Last 24 Hours</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="all">All Time</option>
              </select>
              <button class="refresh-timeline">Refresh</button>
            </div>
            <div class="timeline-chart" id="timeline-chart"></div>
          </div>
          
          <div class="explorer-panel" id="network-panel">
            <div class="network-info">
              <p>Explore connections between authors, posts, and interactions.</p>
            </div>
            <div class="network-graph" id="network-graph"></div>
          </div>
          
          <div class="explorer-panel" id="trends-panel">
            <div class="trends-list" id="trends-list"></div>
          </div>
        </div>
      </div>
    `;

    // Add to the page
    const main = document.querySelector('main');
    if (main) {
      main.parentNode.insertBefore(explorerContainer, main.nextSibling);
    }

    this.setupFeedExplorerHandlers();
    this.updateFeedAnalytics();
  }

  setupFeedExplorerHandlers() {
    const explorerToggle = document.querySelector('.explorer-toggle');
    const explorerContent = document.getElementById('explorer-content');
    const explorerTabs = document.querySelectorAll('.explorer-tab');
    const explorerPanels = document.querySelectorAll('.explorer-panel');

    // Toggle explorer
    explorerToggle.addEventListener('click', () => {
      const isVisible = explorerContent.style.display !== 'none';
      explorerContent.style.display = isVisible ? 'none' : 'block';
      explorerToggle.setAttribute('aria-expanded', !isVisible);
      
      if (!isVisible) {
        this.updateFeedAnalytics();
      }
    });

    // Tab switching
    explorerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetPanel = tab.dataset.tab;
        
        // Update active tab
        explorerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active panel
        explorerPanels.forEach(p => p.classList.remove('active'));
        document.getElementById(`${targetPanel}-panel`).classList.add('active');
        
        // Load panel content
        this.loadExplorerPanel(targetPanel);
      });
    });

    // Timeline controls
    const timelinePeriod = document.getElementById('timeline-period');
    const refreshTimeline = document.querySelector('.refresh-timeline');
    
    if (timelinePeriod) {
      timelinePeriod.addEventListener('change', () => {
        this.updateTimelineChart();
      });
    }
    
    if (refreshTimeline) {
      refreshTimeline.addEventListener('click', () => {
        this.updateTimelineChart();
      });
    }
  }

  updateFeedAnalytics() {
    // Calculate basic statistics
    const totalPosts = this.searchIndex.size;
    const posts = Array.from(this.searchIndex.values()).filter(item => item.type === 'post');
    const comments = Array.from(this.searchIndex.values()).filter(item => item.type === 'comment');
    
    let totalInteractions = 0;
    const authors = new Set();
    const tags = new Map();
    
    this.searchIndex.forEach(item => {
      // Count interactions
      const interactionElements = item.element.querySelectorAll('.interaction-count');
      interactionElements.forEach(el => {
        const count = parseInt(el.textContent.match(/\d+/)?.[0] || '0');
        totalInteractions += count;
      });
      
      // Collect authors
      if (item.author) {
        authors.add(item.author);
      }
      
      // Collect tags
      item.tags.forEach(tag => {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      });
    });

    // Update statistics
    document.getElementById('total-posts').textContent = posts.length;
    document.getElementById('total-comments').textContent = comments.length;
    document.getElementById('total-interactions').textContent = totalInteractions;
    document.getElementById('active-authors').textContent = authors.size;

    // Update content distribution
    this.updateContentDistribution(posts.length, comments.length);
    
    // Update tag cloud
    this.updateTagCloud(tags);
  }

  updateContentDistribution(postsCount, commentsCount) {
    const container = document.getElementById('content-distribution');
    if (!container) return;

    const total = postsCount + commentsCount;
    const postsPercent = total > 0 ? Math.round((postsCount / total) * 100) : 0;
    const commentsPercent = total > 0 ? Math.round((commentsCount / total) * 100) : 0;

    container.innerHTML = `
      <div class="distribution-bar">
        <div class="distribution-segment posts" style="width: ${postsPercent}%" title="Posts: ${postsCount} (${postsPercent}%)"></div>
        <div class="distribution-segment comments" style="width: ${commentsPercent}%" title="Comments: ${commentsCount} (${commentsPercent}%)"></div>
      </div>
      <div class="distribution-legend">
        <div class="legend-item">
          <span class="legend-color posts"></span>
          <span>Posts (${postsCount})</span>
        </div>
        <div class="legend-item">
          <span class="legend-color comments"></span>
          <span>Comments (${commentsCount})</span>
        </div>
      </div>
    `;
  }

  updateTagCloud(tags) {
    const container = document.getElementById('tag-cloud');
    if (!container) return;

    const sortedTags = Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    if (sortedTags.length === 0) {
      container.innerHTML = '<p class="no-data">No tags found</p>';
      return;
    }

    const maxCount = sortedTags[0][1];
    
    container.innerHTML = sortedTags.map(([tag, count]) => {
      const size = Math.max(12, Math.min(24, 12 + (count / maxCount) * 12));
      return `
        <span class="tag-cloud-item" 
              style="font-size: ${size}px" 
              title="${tag}: ${count} uses"
              onclick="ansyblAdvancedUI.filterByTag('${tag}')">
          ${tag}
        </span>
      `;
    }).join(' ');
  }

  loadExplorerPanel(panelName) {
    switch (panelName) {
      case 'analytics':
        this.updateFeedAnalytics();
        break;
      case 'timeline':
        this.updateTimelineChart();
        break;
      case 'network':
        this.updateNetworkGraph();
        break;
      case 'trends':
        this.updateTrends();
        break;
    }
  }

  updateTimelineChart() {
    const container = document.getElementById('timeline-chart');
    const period = document.getElementById('timeline-period')?.value || 'week';
    
    if (!container) return;

    // Group content by date
    const dateGroups = new Map();
    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    this.searchIndex.forEach(item => {
      const itemDate = new Date(item.date);
      if (itemDate >= startDate) {
        const dateKey = itemDate.toDateString();
        if (!dateGroups.has(dateKey)) {
          dateGroups.set(dateKey, { posts: 0, comments: 0 });
        }
        const group = dateGroups.get(dateKey);
        if (item.type === 'post') {
          group.posts++;
        } else {
          group.comments++;
        }
      }
    });

    // Create simple timeline visualization
    const sortedDates = Array.from(dateGroups.entries()).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    
    if (sortedDates.length === 0) {
      container.innerHTML = '<p class="no-data">No data for selected period</p>';
      return;
    }

    const maxActivity = Math.max(...sortedDates.map(([_, data]) => data.posts + data.comments));

    container.innerHTML = `
      <div class="timeline-bars">
        ${sortedDates.map(([date, data]) => {
          const total = data.posts + data.comments;
          const height = maxActivity > 0 ? (total / maxActivity) * 100 : 0;
          return `
            <div class="timeline-bar" style="height: ${height}%" title="${date}: ${total} items">
              <div class="bar-posts" style="height: ${data.posts / total * 100}%"></div>
              <div class="bar-comments" style="height: ${data.comments / total * 100}%"></div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="timeline-labels">
        ${sortedDates.map(([date]) => `
          <div class="timeline-label">${new Date(date).toLocaleDateString()}</div>
        `).join('')}
      </div>
    `;
  }

  updateNetworkGraph() {
    const container = document.getElementById('network-graph');
    if (!container) return;

    // Simple network visualization showing author connections
    const authors = new Map();
    const connections = new Map();

    this.searchIndex.forEach(item => {
      const author = item.author;
      if (!authors.has(author)) {
        authors.set(author, { posts: 0, comments: 0 });
      }
      
      const authorData = authors.get(author);
      if (item.type === 'post') {
        authorData.posts++;
      } else {
        authorData.comments++;
      }
    });

    const authorArray = Array.from(authors.entries()).slice(0, 10);
    
    container.innerHTML = `
      <div class="network-nodes">
        ${authorArray.map(([author, data]) => {
          const size = Math.max(20, Math.min(60, (data.posts + data.comments) * 5));
          return `
            <div class="network-node" 
                 style="width: ${size}px; height: ${size}px"
                 title="${author}: ${data.posts} posts, ${data.comments} comments">
              <span class="node-label">${author.substring(0, 2)}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  updateTrends() {
    const container = document.getElementById('trends-list');
    if (!container) return;

    // Calculate trending topics based on recent activity
    const recentItems = Array.from(this.searchIndex.values())
      .filter(item => {
        const itemDate = new Date(item.date);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return itemDate >= weekAgo;
      });

    const tagTrends = new Map();
    const authorTrends = new Map();

    recentItems.forEach(item => {
      // Tag trends
      item.tags.forEach(tag => {
        tagTrends.set(tag, (tagTrends.get(tag) || 0) + 1);
      });
      
      // Author trends
      if (item.author) {
        authorTrends.set(item.author, (authorTrends.get(item.author) || 0) + 1);
      }
    });

    const topTags = Array.from(tagTrends.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topAuthors = Array.from(authorTrends.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    container.innerHTML = `
      <div class="trends-section">
        <h4>🔥 Trending Tags</h4>
        <div class="trend-items">
          ${topTags.map(([tag, count]) => `
            <div class="trend-item" onclick="ansyblAdvancedUI.filterByTag('${tag}')">
              <span class="trend-name">#${tag}</span>
              <span class="trend-count">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="trends-section">
        <h4>👥 Active Authors</h4>
        <div class="trend-items">
          ${topAuthors.map(([author, count]) => `
            <div class="trend-item" onclick="ansyblAdvancedUI.filterByAuthor('${author}')">
              <span class="trend-name">${author}</span>
              <span class="trend-count">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  filterByTag(tag) {
    this.filters.tags.clear();
    this.filters.tags.add(tag);
    
    const btn = Array.from(document.querySelectorAll('.filter-tag')).find(b => b.textContent === tag);
    if (btn) {
      document.querySelectorAll('.filter-tag.active').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    
    this.applyFilters();
    this.updateActiveFilters();
    
    // Scroll to content
    document.querySelector('main').scrollIntoView({ behavior: 'smooth' });
  }

  filterByAuthor(author) {
    this.filters.authors.clear();
    this.filters.authors.add(author);
    
    const btn = Array.from(document.querySelectorAll('.filter-author')).find(b => b.textContent === author);
    if (btn) {
      document.querySelectorAll('.filter-author.active').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    
    this.applyFilters();
    this.updateActiveFilters();
    
    // Scroll to content
    document.querySelector('main').scrollIntoView({ behavior: 'smooth' });
  }
}

// Initialize advanced UI
let ansyblAdvancedUI;

document.addEventListener('DOMContentLoaded', () => {
  ansyblAdvancedUI = new AnsyblAdvancedUI();
  
  // Make it globally available
  window.ansyblAdvancedUI = ansyblAdvancedUI;
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnsyblAdvancedUI;
}