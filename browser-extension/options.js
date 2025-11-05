// browser-extension/options.js
// Options page functionality

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize tabs
  initializeTabs();
  
  // Load settings and data
  await loadSettings();
  await loadSubscriptions();
  
  // Set up event listeners
  setupEventListeners();
  
  // Handle URL hash for direct navigation
  handleUrlHash();
});

// Tab management
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update active tab content
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`${tabId}-tab`).classList.add('active');
      
      // Update URL hash
      window.location.hash = tabId;
    });
  });
}

// Handle URL hash navigation
function handleUrlHash() {
  const hash = window.location.hash.substring(1);
  if (hash) {
    const tabButton = document.querySelector(`[data-tab="${hash}"]`);
    if (tabButton) {
      tabButton.click();
    }
  }
}

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get([
      'autoDiscover',
      'showIndicators', 
      'validateFeeds',
      'syncSubscriptions',
      'readerUrl',
      'openInReader',
      'discoverLinkTags',
      'discoverMetaTags',
      'discoverContent',
      'suggestCommonPaths',
      'customPatterns'
    ]);
    
    // Set checkbox values
    document.getElementById('auto-discover').checked = settings.autoDiscover !== false;
    document.getElementById('show-indicators').checked = settings.showIndicators !== false;
    document.getElementById('validate-feeds').checked = settings.validateFeeds !== false;
    document.getElementById('sync-subscriptions').checked = settings.syncSubscriptions !== false;
    document.getElementById('open-in-reader').checked = settings.openInReader === true;
    document.getElementById('discover-link-tags').checked = settings.discoverLinkTags !== false;
    document.getElementById('discover-meta-tags').checked = settings.discoverMetaTags !== false;
    document.getElementById('discover-content').checked = settings.discoverContent !== false;
    document.getElementById('suggest-common-paths').checked = settings.suggestCommonPaths !== false;
    
    // Set input values
    document.getElementById('reader-url').value = settings.readerUrl || '';
    
    // Load custom patterns
    loadCustomPatterns(settings.customPatterns || []);
    
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    const settings = {
      autoDiscover: document.getElementById('auto-discover').checked,
      showIndicators: document.getElementById('show-indicators').checked,
      validateFeeds: document.getElementById('validate-feeds').checked,
      syncSubscriptions: document.getElementById('sync-subscriptions').checked,
      readerUrl: document.getElementById('reader-url').value,
      openInReader: document.getElementById('open-in-reader').checked,
      discoverLinkTags: document.getElementById('discover-link-tags').checked,
      discoverMetaTags: document.getElementById('discover-meta-tags').checked,
      discoverContent: document.getElementById('discover-content').checked,
      suggestCommonPaths: document.getElementById('suggest-common-paths').checked,
      customPatterns: getCustomPatterns()
    };
    
    await chrome.storage.sync.set(settings);
    showNotification('Settings saved', 'success');
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    showNotification('Failed to save settings', 'error');
  }
}

// Load subscriptions
async function loadSubscriptions() {
  try {
    const result = await chrome.storage.sync.get(['subscriptions']);
    const subscriptions = result.subscriptions || [];
    
    // Update stats
    updateSubscriptionStats(subscriptions);
    
    // Load subscription list
    displaySubscriptions(subscriptions);
    
    // Update tag filter
    updateTagFilter(subscriptions);
    
  } catch (error) {
    console.error('Failed to load subscriptions:', error);
  }
}

// Update subscription statistics
function updateSubscriptionStats(subscriptions) {
  const totalCount = subscriptions.length;
  const activeCount = subscriptions.filter(sub => sub.active !== false).length;
  const allTags = subscriptions.flatMap(sub => sub.tags || []);
  const uniqueTags = [...new Set(allTags)].length;
  
  document.getElementById('total-subscriptions').textContent = totalCount;
  document.getElementById('active-subscriptions').textContent = activeCount;
  document.getElementById('subscription-tags').textContent = uniqueTags;
}

// Display subscriptions list
function displaySubscriptions(subscriptions, filter = '') {
  const container = document.getElementById('subscriptions-list');
  const tagFilter = document.getElementById('tag-filter').value;
  
  // Filter subscriptions
  let filteredSubs = subscriptions;
  
  if (filter) {
    const searchTerm = filter.toLowerCase();
    filteredSubs = filteredSubs.filter(sub => 
      sub.title.toLowerCase().includes(searchTerm) ||
      sub.url.toLowerCase().includes(searchTerm) ||
      (sub.author && sub.author.toLowerCase().includes(searchTerm))
    );
  }
  
  if (tagFilter) {
    filteredSubs = filteredSubs.filter(sub => 
      sub.tags && sub.tags.includes(tagFilter)
    );
  }
  
  if (filteredSubs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No subscriptions found</h3>
        <p>${filter || tagFilter ? 'Try adjusting your search or filter.' : 'Start by discovering feeds on websites you visit.'}</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredSubs.map(sub => `
    <div class="subscription-item" data-id="${sub.id}">
      <div class="subscription-info">
        <div class="subscription-title">${escapeHtml(sub.title)}</div>
        <div class="subscription-url">${escapeHtml(sub.url)}</div>
        <div class="subscription-meta">
          <span>Added ${new Date(sub.dateAdded).toLocaleDateString()}</span>
          ${sub.author ? `<span>by ${escapeHtml(sub.author)}</span>` : ''}
          ${sub.tags && sub.tags.length > 0 ? 
            sub.tags.map(tag => `<span class="subscription-tag">${escapeHtml(tag)}</span>`).join('') : ''}
        </div>
      </div>
      <div class="subscription-actions">
        <button class="subscription-btn" onclick="visitSubscription('${escapeHtml(sub.url)}')">Visit</button>
        <button class="subscription-btn" onclick="editSubscription('${sub.id}')">Edit</button>
        <button class="subscription-btn danger" onclick="removeSubscription('${sub.id}')">Remove</button>
      </div>
    </div>
  `).join('');
}

// Update tag filter dropdown
function updateTagFilter(subscriptions) {
  const tagFilter = document.getElementById('tag-filter');
  const allTags = subscriptions.flatMap(sub => sub.tags || []);
  const uniqueTags = [...new Set(allTags)].sort();
  
  // Keep current selection
  const currentValue = tagFilter.value;
  
  tagFilter.innerHTML = '<option value="">All tags</option>' +
    uniqueTags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
  
  // Restore selection if still valid
  if (uniqueTags.includes(currentValue)) {
    tagFilter.value = currentValue;
  }
}

// Load custom patterns
function loadCustomPatterns(patterns) {
  const container = document.getElementById('custom-patterns');
  
  if (patterns.length === 0) {
    container.innerHTML = '<p class="empty-state">No custom patterns defined.</p>';
    return;
  }
  
  container.innerHTML = patterns.map((pattern, index) => `
    <div class="pattern-item">
      <span class="pattern-text">${escapeHtml(pattern)}</span>
      <button class="btn secondary" onclick="removePattern(${index})">Remove</button>
    </div>
  `).join('');
}

// Get custom patterns from UI
function getCustomPatterns() {
  const items = document.querySelectorAll('.pattern-item .pattern-text');
  return Array.from(items).map(item => item.textContent);
}

// Set up event listeners
function setupEventListeners() {
  // Settings auto-save
  const settingInputs = document.querySelectorAll('input[type="checkbox"], input[type="url"]');
  settingInputs.forEach(input => {
    input.addEventListener('change', saveSettings);
  });
  
  // Search functionality
  const searchInput = document.getElementById('subscription-search');
  const tagFilter = document.getElementById('tag-filter');
  
  searchInput.addEventListener('input', debounce(() => {
    loadSubscriptions().then(() => {
      chrome.storage.sync.get(['subscriptions']).then(result => {
        displaySubscriptions(result.subscriptions || [], searchInput.value);
      });
    });
  }, 300));
  
  tagFilter.addEventListener('change', () => {
    chrome.storage.sync.get(['subscriptions']).then(result => {
      displaySubscriptions(result.subscriptions || [], searchInput.value);
    });
  });
  
  // Import/Export buttons
  document.getElementById('import-btn').addEventListener('click', importSubscriptions);
  document.getElementById('export-btn').addEventListener('click', exportSubscriptions);
  document.getElementById('clear-all-btn').addEventListener('click', clearAllSubscriptions);
  
  // Custom pattern management
  document.getElementById('add-pattern-btn').addEventListener('click', addCustomPattern);
  document.getElementById('new-pattern').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addCustomPattern();
    }
  });
  
  // File input for import
  document.getElementById('import-file').addEventListener('change', handleImportFile);
}

// Subscription management functions
window.visitSubscription = function(url) {
  chrome.tabs.create({ url: url });
};

window.editSubscription = function(subscriptionId) {
  // Simple edit functionality - in a real extension this might be a modal
  const newTitle = prompt('Enter new title:');
  if (newTitle) {
    chrome.storage.sync.get(['subscriptions']).then(result => {
      const subscriptions = result.subscriptions || [];
      const subscription = subscriptions.find(sub => sub.id === subscriptionId);
      if (subscription) {
        subscription.title = newTitle;
        chrome.storage.sync.set({ subscriptions }).then(() => {
          loadSubscriptions();
          showNotification('Subscription updated', 'success');
        });
      }
    });
  }
};

window.removeSubscription = function(subscriptionId) {
  if (!confirm('Remove this subscription?')) {
    return;
  }
  
  chrome.storage.sync.get(['subscriptions']).then(result => {
    const subscriptions = result.subscriptions || [];
    const filtered = subscriptions.filter(sub => sub.id !== subscriptionId);
    
    chrome.storage.sync.set({ subscriptions: filtered }).then(() => {
      loadSubscriptions();
      showNotification('Subscription removed', 'success');
    });
  });
};

// Import subscriptions
function importSubscriptions() {
  document.getElementById('import-file').click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importData = JSON.parse(e.target.result);
      
      if (!importData.subscriptions || !Array.isArray(importData.subscriptions)) {
        throw new Error('Invalid import file format');
      }
      
      const result = await chrome.storage.sync.get(['subscriptions']);
      const existingSubscriptions = result.subscriptions || [];
      
      let imported = 0;
      let skipped = 0;
      
      for (const importSub of importData.subscriptions) {
        if (!importSub.url) continue;
        
        // Check if already exists
        if (existingSubscriptions.some(sub => sub.url === importSub.url)) {
          skipped++;
          continue;
        }
        
        // Add new subscription
        const subscription = {
          id: Date.now().toString() + Math.random().toString(36).substr(2),
          url: importSub.url,
          title: importSub.title || 'Imported Feed',
          author: importSub.author || 'Unknown',
          dateAdded: importSub.dateAdded || new Date().toISOString(),
          tags: importSub.tags || []
        };
        
        existingSubscriptions.push(subscription);
        imported++;
      }
      
      await chrome.storage.sync.set({ subscriptions: existingSubscriptions });
      await loadSubscriptions();
      
      showNotification(`Import complete: ${imported} imported, ${skipped} skipped`, 'success');
      
    } catch (error) {
      console.error('Import failed:', error);
      showNotification(`Import failed: ${error.message}`, 'error');
    }
    
    // Clear file input
    event.target.value = '';
  };
  
  reader.readAsText(file);
}

// Export subscriptions
async function exportSubscriptions() {
  try {
    const result = await chrome.storage.sync.get(['subscriptions']);
    const subscriptions = result.subscriptions || [];
    
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      subscriptions: subscriptions.map(sub => ({
        url: sub.url,
        title: sub.title,
        author: sub.author,
        tags: sub.tags,
        dateAdded: sub.dateAdded
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ansybl-subscriptions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Subscriptions exported', 'success');
    
  } catch (error) {
    console.error('Export failed:', error);
    showNotification('Export failed', 'error');
  }
}

// Clear all subscriptions
async function clearAllSubscriptions() {
  if (!confirm('Remove all subscriptions? This cannot be undone.')) {
    return;
  }
  
  try {
    await chrome.storage.sync.set({ subscriptions: [] });
    await loadSubscriptions();
    showNotification('All subscriptions cleared', 'success');
    
  } catch (error) {
    console.error('Failed to clear subscriptions:', error);
    showNotification('Failed to clear subscriptions', 'error');
  }
}

// Custom pattern management
function addCustomPattern() {
  const input = document.getElementById('new-pattern');
  const pattern = input.value.trim();
  
  if (!pattern) return;
  
  // Basic validation
  if (!pattern.includes('*') && !pattern.includes('.ansybl')) {
    showNotification('Pattern should include * wildcard or .ansybl extension', 'error');
    return;
  }
  
  const currentPatterns = getCustomPatterns();
  if (currentPatterns.includes(pattern)) {
    showNotification('Pattern already exists', 'error');
    return;
  }
  
  currentPatterns.push(pattern);
  loadCustomPatterns(currentPatterns);
  saveSettings();
  
  input.value = '';
  showNotification('Pattern added', 'success');
}

window.removePattern = function(index) {
  const currentPatterns = getCustomPatterns();
  currentPatterns.splice(index, 1);
  loadCustomPatterns(currentPatterns);
  saveSettings();
  showNotification('Pattern removed', 'success');
};

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#1a7f37' : type === 'error' ? '#cf222e' : '#0969da'};
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.remove();
    style.remove();
  }, 3000);
}