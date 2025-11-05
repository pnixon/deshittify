// browser-extension/popup.js
// Popup interface logic

document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    loading: document.getElementById('loading'),
    noFeeds: document.getElementById('no-feeds'),
    feedsList: document.getElementById('feeds-list'),
    feedsContainer: document.getElementById('feeds-container'),
    feedCount: document.getElementById('feed-count'),
    subscriptionsSection: document.getElementById('subscriptions-section'),
    subscriptionsContainer: document.getElementById('subscriptions-container'),
    subscriptionCount: document.getElementById('subscription-count'),
    optionsBtn: document.getElementById('options-btn'),
    manageSubscriptions: document.getElementById('manage-subscriptions'),
    exportSubscriptions: document.getElementById('export-subscriptions'),
    aboutLink: document.getElementById('about-link'),
    helpLink: document.getElementById('help-link')
  };

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Load feeds and subscriptions
  await Promise.all([
    loadDiscoveredFeeds(tab.id),
    loadSubscriptions()
  ]);

  // Event listeners
  elements.optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  elements.manageSubscriptions.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html#subscriptions') });
  });

  elements.exportSubscriptions.addEventListener('click', exportSubscriptions);

  elements.aboutLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://ansybl.org' });
  });

  elements.helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
  });

  // Load discovered feeds
  async function loadDiscoveredFeeds(tabId) {
    try {
      const result = await chrome.storage.local.get([`feeds_${tabId}`]);
      const feedData = result[`feeds_${tabId}`];

      if (!feedData || !feedData.feeds || feedData.feeds.length === 0) {
        showNoFeeds();
        return;
      }

      const feeds = feedData.feeds;
      showFeeds(feeds);

    } catch (error) {
      console.error('Failed to load feeds:', error);
      showNoFeeds();
    }
  }

  // Show feeds list
  function showFeeds(feeds) {
    elements.loading.style.display = 'none';
    elements.noFeeds.style.display = 'none';
    elements.feedsList.style.display = 'block';

    elements.feedCount.textContent = feeds.length;
    elements.feedsContainer.innerHTML = '';

    feeds.forEach(feed => {
      const feedElement = createFeedElement(feed);
      elements.feedsContainer.appendChild(feedElement);
    });
  }

  // Show no feeds state
  function showNoFeeds() {
    elements.loading.style.display = 'none';
    elements.feedsList.style.display = 'none';
    elements.noFeeds.style.display = 'block';
  }

  // Create feed element
  function createFeedElement(feed) {
    const div = document.createElement('div');
    div.className = 'feed-item';

    const typeClass = getTypeClass(feed.type);
    const isValidated = feed.validated !== undefined;
    const isSuggested = feed.suggested === true;

    div.innerHTML = `
      <div class="feed-info">
        <div class="feed-title">${escapeHtml(feed.title)}</div>
        <div class="feed-url">${escapeHtml(feed.url)}</div>
        <div class="feed-meta">
          <span class="feed-type ${typeClass}">${feed.type}</span>
          ${isSuggested ? '<span class="feed-type">suggested</span>' : ''}
        </div>
        <div class="validation-status" id="validation-${feed.url.replace(/[^a-zA-Z0-9]/g, '')}" style="display: none;"></div>
      </div>
      <div class="feed-actions">
        <button class="feed-btn" data-action="validate" data-url="${escapeHtml(feed.url)}">
          ${isValidated ? (feed.valid ? '✓ Valid' : '✗ Invalid') : 'Validate'}
        </button>
        <button class="feed-btn secondary" data-action="subscribe" data-feed='${JSON.stringify(feed)}' ${isSuggested ? 'disabled' : ''}>
          Subscribe
        </button>
      </div>
    `;

    // Add event listeners
    const validateBtn = div.querySelector('[data-action="validate"]');
    const subscribeBtn = div.querySelector('[data-action="subscribe"]');

    validateBtn.addEventListener('click', () => validateFeed(feed, validateBtn, subscribeBtn));
    subscribeBtn.addEventListener('click', () => subscribeFeed(feed, subscribeBtn));

    return div;
  }

  // Get type class for styling
  function getTypeClass(type) {
    const typeMap = {
      'link-tag': 'primary',
      'meta-tag': 'secondary',
      'json-ld': 'info',
      'convention': 'warning',
      'content-scan': 'info',
      'data-attribute': 'secondary',
      'javascript': 'info'
    };
    return typeMap[type] || 'default';
  }

  // Validate feed
  async function validateFeed(feed, validateBtn, subscribeBtn) {
    const statusElement = document.getElementById(`validation-${feed.url.replace(/[^a-zA-Z0-9]/g, '')}`);
    
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validating...';
    statusElement.style.display = 'block';
    statusElement.className = 'validation-status checking';
    statusElement.textContent = 'Checking feed...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validateFeed',
        url: feed.url
      });

      if (response.valid) {
        validateBtn.className = 'feed-btn success';
        validateBtn.textContent = '✓ Valid';
        statusElement.className = 'validation-status valid';
        statusElement.textContent = `Valid Ansybl feed: ${response.itemCount} items`;
        
        // Enable subscribe button and update feed data
        subscribeBtn.disabled = false;
        feed.validated = true;
        feed.valid = true;
        feed.title = response.title || feed.title;
        feed.author = response.author;
        feed.description = response.description;
        
      } else {
        validateBtn.className = 'feed-btn error';
        validateBtn.textContent = '✗ Invalid';
        statusElement.className = 'validation-status invalid';
        statusElement.textContent = `Error: ${response.error}`;
        
        feed.validated = true;
        feed.valid = false;
      }

    } catch (error) {
      validateBtn.className = 'feed-btn error';
      validateBtn.textContent = '✗ Error';
      statusElement.className = 'validation-status invalid';
      statusElement.textContent = 'Failed to validate feed';
    }

    validateBtn.disabled = false;
  }

  // Subscribe to feed
  async function subscribeFeed(feed, subscribeBtn) {
    if (!feed.valid && feed.validated) {
      alert('Cannot subscribe to invalid feed. Please validate first.');
      return;
    }

    subscribeBtn.disabled = true;
    subscribeBtn.textContent = 'Subscribing...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'subscribeFeed',
        feed: feed
      });

      if (response.success) {
        subscribeBtn.className = 'feed-btn success';
        subscribeBtn.textContent = '✓ Subscribed';
        
        // Refresh subscriptions list
        await loadSubscriptions();
        
        // Show success message
        showNotification('Successfully subscribed to feed!', 'success');
        
      } else {
        subscribeBtn.className = 'feed-btn error';
        subscribeBtn.textContent = 'Failed';
        showNotification(`Failed to subscribe: ${response.error}`, 'error');
      }

    } catch (error) {
      subscribeBtn.className = 'feed-btn error';
      subscribeBtn.textContent = 'Error';
      showNotification('Failed to subscribe to feed', 'error');
    }

    setTimeout(() => {
      subscribeBtn.disabled = false;
      subscribeBtn.className = 'feed-btn secondary';
      subscribeBtn.textContent = 'Subscribe';
    }, 2000);
  }

  // Load subscriptions
  async function loadSubscriptions() {
    try {
      const result = await chrome.storage.sync.get(['subscriptions']);
      const subscriptions = result.subscriptions || [];

      if (subscriptions.length === 0) {
        elements.subscriptionsSection.style.display = 'none';
        return;
      }

      elements.subscriptionsSection.style.display = 'block';
      elements.subscriptionCount.textContent = subscriptions.length;
      elements.subscriptionsContainer.innerHTML = '';

      // Show only recent subscriptions (last 5)
      const recentSubscriptions = subscriptions
        .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
        .slice(0, 5);

      recentSubscriptions.forEach(subscription => {
        const subElement = createSubscriptionElement(subscription);
        elements.subscriptionsContainer.appendChild(subElement);
      });

    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    }
  }

  // Create subscription element
  function createSubscriptionElement(subscription) {
    const div = document.createElement('div');
    div.className = 'subscription-item';

    div.innerHTML = `
      <div class="subscription-info">
        <div class="subscription-title">${escapeHtml(subscription.title)}</div>
        <div class="subscription-author">by ${escapeHtml(subscription.author || 'Unknown')}</div>
      </div>
      <div class="subscription-actions">
        <button class="subscription-btn" data-action="visit" data-url="${escapeHtml(subscription.url)}" title="Visit feed">🔗</button>
        <button class="subscription-btn" data-action="remove" data-id="${subscription.id}" title="Unsubscribe">🗑️</button>
      </div>
    `;

    // Add event listeners
    const visitBtn = div.querySelector('[data-action="visit"]');
    const removeBtn = div.querySelector('[data-action="remove"]');

    visitBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: subscription.url });
    });

    removeBtn.addEventListener('click', () => removeSubscription(subscription.id));

    return div;
  }

  // Remove subscription
  async function removeSubscription(subscriptionId) {
    if (!confirm('Remove this subscription?')) {
      return;
    }

    try {
      const result = await chrome.storage.sync.get(['subscriptions']);
      const subscriptions = result.subscriptions || [];
      
      const filtered = subscriptions.filter(sub => sub.id !== subscriptionId);
      await chrome.storage.sync.set({ subscriptions: filtered });
      
      await loadSubscriptions();
      showNotification('Subscription removed', 'success');
      
    } catch (error) {
      console.error('Failed to remove subscription:', error);
      showNotification('Failed to remove subscription', 'error');
    }
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
          tags: sub.tags,
          dateAdded: sub.dateAdded
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      await chrome.downloads.download({
        url: url,
        filename: `ansybl-subscriptions-${new Date().toISOString().split('T')[0]}.json`
      });

      showNotification('Subscriptions exported', 'success');

    } catch (error) {
      console.error('Failed to export subscriptions:', error);
      showNotification('Failed to export subscriptions', 'error');
    }
  }

  // Show notification
  function showNotification(message, type = 'info') {
    // Simple notification - in a real extension you might use chrome.notifications
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#1a7f37' : type === 'error' ? '#cf222e' : '#0969da'};
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      animation: slideDown 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Utility function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});