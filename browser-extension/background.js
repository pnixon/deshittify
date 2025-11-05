// browser-extension/background.js
// Background service worker for Ansybl feed discovery

// Badge colors
const BADGE_COLORS = {
  found: '#2ea043',
  error: '#f85149',
  none: '#8b949e'
};

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('https://')) {
    await checkForAnsyblFeeds(tabId, tab.url);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url && tab.url.startsWith('https://')) {
    await checkForAnsyblFeeds(activeInfo.tabId, tab.url);
  }
});

// Check for Ansybl feeds on the page
async function checkForAnsyblFeeds(tabId, url) {
  try {
    // Inject content script to scan for feeds
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: scanForFeeds
    });

    const feeds = results[0]?.result || [];
    
    // Update badge
    if (feeds.length > 0) {
      await chrome.action.setBadgeText({
        tabId: tabId,
        text: feeds.length.toString()
      });
      await chrome.action.setBadgeBackgroundColor({
        tabId: tabId,
        color: BADGE_COLORS.found
      });
      await chrome.action.setTitle({
        tabId: tabId,
        title: `Found ${feeds.length} Ansybl feed(s)`
      });
    } else {
      await chrome.action.setBadgeText({
        tabId: tabId,
        text: ''
      });
      await chrome.action.setTitle({
        tabId: tabId,
        title: 'No Ansybl feeds found'
      });
    }

    // Store feeds for popup
    await chrome.storage.local.set({
      [`feeds_${tabId}`]: {
        url: url,
        feeds: feeds,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('Failed to check for feeds:', error);
    
    await chrome.action.setBadgeText({
      tabId: tabId,
      text: '!'
    });
    await chrome.action.setBadgeBackgroundColor({
      tabId: tabId,
      color: BADGE_COLORS.error
    });
  }
}

// Function to be injected into page context
function scanForFeeds() {
  const feeds = [];
  const baseUrl = window.location.origin;
  
  // Look for link tags with Ansybl feed references
  const linkTags = document.querySelectorAll('link[rel*="feed"], link[type*="ansybl"], link[href*=".ansybl"]');
  
  linkTags.forEach(link => {
    const href = link.getAttribute('href');
    const type = link.getAttribute('type');
    const title = link.getAttribute('title') || 'Ansybl Feed';
    
    if (href) {
      let feedUrl;
      try {
        feedUrl = new URL(href, baseUrl).href;
      } catch {
        return; // Skip invalid URLs
      }
      
      // Check if it looks like an Ansybl feed
      if (href.includes('.ansybl') || 
          type === 'application/ansybl+json' ||
          type === 'application/json' && href.includes('ansybl')) {
        
        feeds.push({
          url: feedUrl,
          title: title,
          type: 'link-tag',
          element: 'link'
        });
      }
    }
  });
  
  // Look for meta tags with feed information
  const metaTags = document.querySelectorAll('meta[name*="ansybl"], meta[property*="ansybl"]');
  
  metaTags.forEach(meta => {
    const content = meta.getAttribute('content');
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    
    if (content && name && (name.includes('feed') || name.includes('ansybl'))) {
      let feedUrl;
      try {
        feedUrl = new URL(content, baseUrl).href;
      } catch {
        return; // Skip invalid URLs
      }
      
      feeds.push({
        url: feedUrl,
        title: `Feed (${name})`,
        type: 'meta-tag',
        element: 'meta'
      });
    }
  });
  
  // Look for JSON-LD structured data
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  
  jsonLdScripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      
      // Check for feed references in structured data
      if (data.mainEntity && data.mainEntity.url) {
        const url = data.mainEntity.url;
        if (url.includes('.ansybl') || url.includes('ansybl')) {
          feeds.push({
            url: new URL(url, baseUrl).href,
            title: data.mainEntity.name || 'Ansybl Feed',
            type: 'json-ld',
            element: 'script'
          });
        }
      }
    } catch {
      // Skip invalid JSON-LD
    }
  });
  
  // Look for common feed URLs by convention
  const commonPaths = [
    '/feed.ansybl',
    '/ansybl.json',
    '/feeds/ansybl.json',
    '/.well-known/ansybl'
  ];
  
  // We can't actually check if these exist without making requests,
  // but we can suggest them as potential feeds
  commonPaths.forEach(path => {
    const feedUrl = new URL(path, baseUrl).href;
    
    // Only add if not already found
    if (!feeds.some(f => f.url === feedUrl)) {
      feeds.push({
        url: feedUrl,
        title: 'Potential Ansybl Feed',
        type: 'convention',
        element: 'suggested',
        suggested: true
      });
    }
  });
  
  // Remove duplicates
  const uniqueFeeds = feeds.filter((feed, index, self) => 
    index === self.findIndex(f => f.url === feed.url)
  );
  
  return uniqueFeeds;
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'validateFeed') {
    validateFeedUrl(message.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ valid: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'subscribeFeed') {
    subscribeFeed(message.feed)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Validate feed URL
async function validateFeedUrl(url) {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    const feedData = JSON.parse(content);
    
    // Basic Ansybl validation
    if (!feedData.version || !feedData.version.includes('ansybl.org')) {
      throw new Error('Not a valid Ansybl feed');
    }
    
    if (!feedData.title || !feedData.author || !feedData.items) {
      throw new Error('Missing required Ansybl fields');
    }
    
    return {
      valid: true,
      title: feedData.title,
      author: feedData.author.name,
      itemCount: feedData.items.length,
      description: feedData.description
    };
    
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

// Subscribe to feed (store in extension storage)
async function subscribeFeed(feed) {
  try {
    // Get existing subscriptions
    const result = await chrome.storage.sync.get(['subscriptions']);
    const subscriptions = result.subscriptions || [];
    
    // Check if already subscribed
    if (subscriptions.some(sub => sub.url === feed.url)) {
      throw new Error('Already subscribed to this feed');
    }
    
    // Add new subscription
    const subscription = {
      id: Date.now().toString(),
      url: feed.url,
      title: feed.title,
      author: feed.author,
      description: feed.description,
      dateAdded: new Date().toISOString(),
      tags: []
    };
    
    subscriptions.push(subscription);
    
    // Save subscriptions
    await chrome.storage.sync.set({ subscriptions });
    
    return { success: true, subscription };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}