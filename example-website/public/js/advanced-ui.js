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