// browser-extension/content.js
// Content script for enhanced feed discovery

(function() {
  'use strict';
  
  // Avoid running multiple times
  if (window.ansyblDiscoveryInjected) {
    return;
  }
  window.ansyblDiscoveryInjected = true;
  
  // Enhanced feed discovery
  function enhancedFeedDiscovery() {
    const feeds = [];
    const baseUrl = window.location.origin;
    
    // Look for feeds in page content
    const textContent = document.body.textContent || '';
    const ansyblUrls = textContent.match(/https?:\/\/[^\s]+\.ansybl/g) || [];
    
    ansyblUrls.forEach(url => {
      feeds.push({
        url: url,
        title: 'Ansybl Feed (found in content)',
        type: 'content-scan',
        element: 'text'
      });
    });
    
    // Look for feeds in data attributes
    const elementsWithData = document.querySelectorAll('[data-feed], [data-ansybl], [data-feed-url]');
    
    elementsWithData.forEach(element => {
      const feedUrl = element.getAttribute('data-feed') || 
                     element.getAttribute('data-ansybl') || 
                     element.getAttribute('data-feed-url');
      
      if (feedUrl) {
        try {
          const fullUrl = new URL(feedUrl, baseUrl).href;
          feeds.push({
            url: fullUrl,
            title: element.getAttribute('data-title') || 'Ansybl Feed (data attribute)',
            type: 'data-attribute',
            element: element.tagName.toLowerCase()
          });
        } catch {
          // Skip invalid URLs
        }
      }
    });
    
    // Look for feeds in JavaScript variables (basic detection)
    const scripts = document.querySelectorAll('script:not([src])');
    
    scripts.forEach(script => {
      const content = script.textContent;
      
      // Look for common patterns
      const patterns = [
        /feedUrl\s*[:=]\s*['"`]([^'"`]+\.ansybl)['"`]/g,
        /ansyblFeed\s*[:=]\s*['"`]([^'"`]+)['"`]/g,
        /'ansybl':\s*['"`]([^'"`]+)['"`]/g
      ];
      
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          try {
            const fullUrl = new URL(match[1], baseUrl).href;
            feeds.push({
              url: fullUrl,
              title: 'Ansybl Feed (JavaScript)',
              type: 'javascript',
              element: 'script'
            });
          } catch {
            // Skip invalid URLs
          }
        }
      });
    });
    
    return feeds;
  }
  
  // Add visual indicators for discovered feeds
  function addFeedIndicators() {
    // Add a small indicator to the page if feeds are found
    const feeds = enhancedFeedDiscovery();
    
    if (feeds.length > 0) {
      const indicator = document.createElement('div');
      indicator.id = 'ansybl-feed-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #2ea043;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      indicator.textContent = `📡 ${feeds.length} Ansybl feed${feeds.length > 1 ? 's' : ''} found`;
      indicator.title = 'Click to open Ansybl extension';
      
      indicator.addEventListener('click', () => {
        // Send message to background script to open popup
        chrome.runtime.sendMessage({ action: 'openPopup' });
      });
      
      indicator.addEventListener('mouseenter', () => {
        indicator.style.transform = 'scale(1.05)';
      });
      
      indicator.addEventListener('mouseleave', () => {
        indicator.style.transform = 'scale(1)';
      });
      
      document.body.appendChild(indicator);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.style.opacity = '0.7';
          indicator.style.transform = 'scale(0.9)';
        }
      }, 5000);
    }
  }
  
  // Monitor for dynamically added content
  function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldRecheck = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new content might contain feeds
              if (node.querySelector && (
                node.querySelector('link[href*=".ansybl"]') ||
                node.querySelector('[data-feed]') ||
                node.textContent.includes('.ansybl')
              )) {
                shouldRecheck = true;
              }
            }
          });
        }
      });
      
      if (shouldRecheck) {
        // Debounce rechecking
        clearTimeout(window.ansyblRecheckTimeout);
        window.ansyblRecheckTimeout = setTimeout(() => {
          // Notify background script to recheck
          chrome.runtime.sendMessage({ action: 'recheckFeeds' });
        }, 1000);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        addFeedIndicators();
        observePageChanges();
      }, 1000);
    });
  } else {
    setTimeout(() => {
      addFeedIndicators();
      observePageChanges();
    }, 1000);
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getEnhancedFeeds') {
      const feeds = enhancedFeedDiscovery();
      sendResponse(feeds);
    }
  });
  
})();