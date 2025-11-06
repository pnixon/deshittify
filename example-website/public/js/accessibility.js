/**
 * Accessibility Enhancement Script for Ansybl
 * Provides keyboard navigation, ARIA labels, and screen reader support
 */

class AnsyblAccessibility {
  constructor() {
    this.focusableElements = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');
    
    this.init();
  }

  init() {
    this.enhanceSemanticStructure();
    this.addARIALabels();
    this.setupKeyboardNavigation();
    this.setupFocusManagement();
    this.setupScreenReaderSupport();
    this.setupSkipLinks();
    this.enhanceFormAccessibility();
    this.setupLiveRegions();
  }

  enhanceSemanticStructure() {
    // Ensure proper heading hierarchy
    this.fixHeadingHierarchy();
    
    // Add landmark roles where missing
    this.addLandmarkRoles();
    
    // Enhance list structures
    this.enhanceListStructures();
  }

  fixHeadingHierarchy() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let currentLevel = 0;
    
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      
      // Add aria-level for screen readers
      heading.setAttribute('aria-level', level);
      
      // Warn about skipped heading levels (for development)
      if (level > currentLevel + 1) {
        console.warn(`Heading level skipped: ${heading.textContent} (h${level} after h${currentLevel})`);
      }
      
      currentLevel = level;
    });
  }

  addLandmarkRoles() {
    // Main content area
    const main = document.querySelector('main') || document.querySelector('.posts');
    if (main && !main.getAttribute('role')) {
      main.setAttribute('role', 'main');
      main.setAttribute('aria-label', 'Main content');
    }

    // Navigation areas
    const navElements = document.querySelectorAll('nav, .navigation');
    navElements.forEach(nav => {
      if (!nav.getAttribute('role')) {
        nav.setAttribute('role', 'navigation');
      }
    });

    // Header
    const header = document.querySelector('header, .site-header');
    if (header && !header.getAttribute('role')) {
      header.setAttribute('role', 'banner');
    }

    // Footer
    const footer = document.querySelector('footer');
    if (footer && !footer.getAttribute('role')) {
      footer.setAttribute('role', 'contentinfo');
    }

    // Complementary content
    const aside = document.querySelector('aside, .sidebar');
    if (aside && !aside.getAttribute('role')) {
      aside.setAttribute('role', 'complementary');
    }
  }

  enhanceListStructures() {
    // Ensure proper list markup for post lists
    const postContainers = document.querySelectorAll('.posts, .comments-list');
    postContainers.forEach(container => {
      if (!container.getAttribute('role')) {
        container.setAttribute('role', 'list');
        container.setAttribute('aria-label', 
          container.classList.contains('posts') ? 'Blog posts' : 'Comments');
      }
    });

    // Individual posts and comments
    const postItems = document.querySelectorAll('.post-preview, .post, .comment');
    postItems.forEach(item => {
      if (!item.getAttribute('role')) {
        item.setAttribute('role', 'listitem');
      }
    });
  }

  addARIALabels() {
    // Form controls
    this.enhanceFormControls();
    
    // Interactive elements
    this.enhanceInteractiveElements();
    
    // Media elements
    this.enhanceMediaElements();
    
    // Navigation elements
    this.enhanceNavigationElements();
  }

  enhanceFormControls() {
    // Input fields without labels
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
        const placeholder = input.getAttribute('placeholder');
        const name = input.getAttribute('name');
        
        if (placeholder) {
          input.setAttribute('aria-label', placeholder);
        } else if (name) {
          input.setAttribute('aria-label', this.humanizeString(name));
        }
      }

      // Add required indicator for screen readers
      if (input.hasAttribute('required')) {
        const label = input.getAttribute('aria-label') || '';
        if (!label.includes('required')) {
          input.setAttribute('aria-label', `${label} (required)`.trim());
        }
        input.setAttribute('aria-required', 'true');
      }

      // Add invalid state support
      if (input.getAttribute('aria-invalid') === null) {
        input.setAttribute('aria-invalid', 'false');
      }
    });

    // Form validation messages
    const errorMessages = document.querySelectorAll('.error-message, .validation-error');
    errorMessages.forEach(message => {
      message.setAttribute('role', 'alert');
      message.setAttribute('aria-live', 'polite');
    });
  }

  enhanceInteractiveElements() {
    // Buttons without accessible names
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      if (!button.textContent.trim() && !button.getAttribute('aria-label')) {
        const title = button.getAttribute('title');
        const className = button.className;
        
        if (title) {
          button.setAttribute('aria-label', title);
        } else if (className.includes('like')) {
          button.setAttribute('aria-label', 'Like this post');
        } else if (className.includes('share')) {
          button.setAttribute('aria-label', 'Share this post');
        } else if (className.includes('comment')) {
          button.setAttribute('aria-label', 'Add comment');
        }
      }

      // Add pressed state for toggle buttons
      if (button.classList.contains('interaction-btn')) {
        button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
      }
    });

    // Links without accessible names
    const links = document.querySelectorAll('a');
    links.forEach(link => {
      if (!link.textContent.trim() && !link.getAttribute('aria-label')) {
        const href = link.getAttribute('href');
        if (href) {
          link.setAttribute('aria-label', `Link to ${href}`);
        }
      }

      // External links
      if (link.hostname && link.hostname !== window.location.hostname) {
        const currentLabel = link.getAttribute('aria-label') || link.textContent;
        link.setAttribute('aria-label', `${currentLabel} (opens in new window)`);
      }
    });
  }

  enhanceMediaElements() {
    // Images without alt text
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.getAttribute('alt')) {
        const src = img.getAttribute('src');
        const title = img.getAttribute('title');
        
        if (title) {
          img.setAttribute('alt', title);
        } else if (src) {
          const filename = src.split('/').pop().split('.')[0];
          img.setAttribute('alt', this.humanizeString(filename));
        } else {
          img.setAttribute('alt', 'Image');
        }
      }
    });

    // Videos and audio
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(media => {
      if (!media.getAttribute('aria-label')) {
        const type = media.tagName.toLowerCase();
        const src = media.getAttribute('src') || media.querySelector('source')?.getAttribute('src');
        
        if (src) {
          const filename = src.split('/').pop().split('.')[0];
          media.setAttribute('aria-label', `${type}: ${this.humanizeString(filename)}`);
        } else {
          media.setAttribute('aria-label', `${type} player`);
        }
      }
    });
  }

  enhanceNavigationElements() {
    // Breadcrumbs
    const breadcrumbs = document.querySelectorAll('.breadcrumb, .breadcrumbs');
    breadcrumbs.forEach(breadcrumb => {
      breadcrumb.setAttribute('role', 'navigation');
      breadcrumb.setAttribute('aria-label', 'Breadcrumb navigation');
    });

    // Pagination
    const pagination = document.querySelectorAll('.pagination');
    pagination.forEach(pager => {
      pager.setAttribute('role', 'navigation');
      pager.setAttribute('aria-label', 'Pagination navigation');
    });

    // Tab navigation
    const tabLists = document.querySelectorAll('.editor-modes, .tab-list');
    tabLists.forEach(tabList => {
      tabList.setAttribute('role', 'tablist');
      
      const tabs = tabList.querySelectorAll('button, .tab');
      tabs.forEach((tab, index) => {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
        tab.setAttribute('tabindex', tab.classList.contains('active') ? '0' : '-1');
        
        const panelId = tab.getAttribute('data-mode') || `panel-${index}`;
        tab.setAttribute('aria-controls', panelId);
        
        // Find corresponding panel
        const panel = document.querySelector(`[data-panel="${panelId}"], .${panelId}-panel`);
        if (panel) {
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', tab.id || `tab-${index}`);
          if (!tab.id) tab.id = `tab-${index}`;
        }
      });
    });
  }  
setupKeyboardNavigation() {
    // Tab navigation for editor modes
    this.setupTabNavigation();
    
    // Arrow key navigation for lists
    this.setupListNavigation();
    
    // Escape key handling
    this.setupEscapeHandling();
    
    // Enter/Space key handling for custom buttons
    this.setupButtonKeyHandling();
  }

  setupTabNavigation() {
    const tabLists = document.querySelectorAll('[role="tablist"]');
    
    tabLists.forEach(tabList => {
      tabList.addEventListener('keydown', (e) => {
        const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
        const currentIndex = tabs.findIndex(tab => tab === document.activeElement);
        
        let newIndex = currentIndex;
        
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault();
            newIndex = (currentIndex + 1) % tabs.length;
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault();
            newIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
            break;
          case 'Home':
            e.preventDefault();
            newIndex = 0;
            break;
          case 'End':
            e.preventDefault();
            newIndex = tabs.length - 1;
            break;
        }
        
        if (newIndex !== currentIndex) {
          tabs[currentIndex].setAttribute('tabindex', '-1');
          tabs[newIndex].setAttribute('tabindex', '0');
          tabs[newIndex].focus();
        }
      });
    });
  }

  setupListNavigation() {
    const lists = document.querySelectorAll('[role="list"]');
    
    lists.forEach(list => {
      const items = list.querySelectorAll('[role="listitem"]');
      
      items.forEach((item, index) => {
        // Make items focusable
        if (!item.getAttribute('tabindex')) {
          item.setAttribute('tabindex', '0');
        }
        
        item.addEventListener('keydown', (e) => {
          let newIndex = index;
          
          switch (e.key) {
            case 'ArrowDown':
              e.preventDefault();
              newIndex = Math.min(index + 1, items.length - 1);
              break;
            case 'ArrowUp':
              e.preventDefault();
              newIndex = Math.max(index - 1, 0);
              break;
            case 'Home':
              e.preventDefault();
              newIndex = 0;
              break;
            case 'End':
              e.preventDefault();
              newIndex = items.length - 1;
              break;
          }
          
          if (newIndex !== index) {
            items[newIndex].focus();
          }
        });
      });
    });
  }

  setupEscapeHandling() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close modals
        const modals = document.querySelectorAll('.modal:not([style*="display: none"])');
        modals.forEach(modal => {
          const closeBtn = modal.querySelector('.close, .modal-close');
          if (closeBtn) {
            closeBtn.click();
          }
        });
        
        // Close dropdowns
        const dropdowns = document.querySelectorAll('.dropdown.open, .menu.open');
        dropdowns.forEach(dropdown => {
          dropdown.classList.remove('open');
        });
        
        // Exit fullscreen media
        const fullscreenMedia = document.querySelectorAll('.media-modal:not([style*="display: none"])');
        fullscreenMedia.forEach(media => {
          media.style.display = 'none';
        });
      }
    });
  }

  setupButtonKeyHandling() {
    // Handle Enter and Space for custom buttons
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && 
          (e.target.getAttribute('role') === 'button' || e.target.classList.contains('btn'))) {
        e.preventDefault();
        e.target.click();
      }
    });
  }

  setupFocusManagement() {
    // Focus trap for modals
    this.setupModalFocusTrap();
    
    // Focus indicators
    this.enhanceFocusIndicators();
    
    // Skip to content functionality
    this.setupSkipToContent();
  }

  setupModalFocusTrap() {
    const modals = document.querySelectorAll('.modal, .dialog');
    
    modals.forEach(modal => {
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          const focusableElements = modal.querySelectorAll(this.focusableElements);
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      });
    });
  }

  enhanceFocusIndicators() {
    // Add high contrast focus indicators
    const style = document.createElement('style');
    style.textContent = `
      *:focus {
        outline: 2px solid #007bff !important;
        outline-offset: 2px !important;
      }
      
      *:focus:not(:focus-visible) {
        outline: none !important;
      }
      
      *:focus-visible {
        outline: 2px solid #007bff !important;
        outline-offset: 2px !important;
      }
      
      .focus-indicator {
        position: relative;
      }
      
      .focus-indicator:focus::after {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        border: 2px solid #007bff;
        border-radius: 4px;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  setupSkipToContent() {
    // Create skip link if it doesn't exist
    if (!document.querySelector('.skip-link')) {
      const skipLink = document.createElement('a');
      skipLink.href = '#main-content';
      skipLink.className = 'skip-link';
      skipLink.textContent = 'Skip to main content';
      skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: #000;
        color: #fff;
        padding: 8px;
        text-decoration: none;
        border-radius: 4px;
        z-index: 10000;
        transition: top 0.3s;
      `;
      
      skipLink.addEventListener('focus', () => {
        skipLink.style.top = '6px';
      });
      
      skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-40px';
      });
      
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
    
    // Ensure main content has ID
    const main = document.querySelector('main, [role="main"]');
    if (main && !main.id) {
      main.id = 'main-content';
    }
  }

  setupScreenReaderSupport() {
    // Live regions for dynamic content
    this.createLiveRegions();
    
    // Screen reader only text
    this.addScreenReaderText();
    
    // Announce page changes
    this.setupPageChangeAnnouncements();
  }

  createLiveRegions() {
    // Create polite live region for status updates
    if (!document.getElementById('sr-live-polite')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'sr-live-polite';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(liveRegion);
    }
    
    // Create assertive live region for important updates
    if (!document.getElementById('sr-live-assertive')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'sr-live-assertive';
      liveRegion.setAttribute('aria-live', 'assertive');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(liveRegion);
    }
  }

  addScreenReaderText() {
    // Add screen reader only descriptions
    const srOnlyStyle = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `;
    
    // Add descriptions for interaction buttons
    const interactionBtns = document.querySelectorAll('.interaction-btn');
    interactionBtns.forEach(btn => {
      if (!btn.querySelector('.sr-only')) {
        const srText = document.createElement('span');
        srText.className = 'sr-only';
        srText.style.cssText = srOnlyStyle;
        
        if (btn.classList.contains('like-btn')) {
          srText.textContent = btn.classList.contains('active') ? 
            'Unlike this post' : 'Like this post';
        } else if (btn.classList.contains('share-btn')) {
          srText.textContent = 'Share this post';
        }
        
        btn.appendChild(srText);
      }
    });
  }

  setupPageChangeAnnouncements() {
    // Announce when new content is loaded
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          const addedElements = Array.from(mutation.addedNodes)
            .filter(node => node.nodeType === Node.ELEMENT_NODE);
          
          addedElements.forEach(element => {
            if (element.classList.contains('comment') || 
                element.classList.contains('post-preview')) {
              this.announceToScreenReader(
                `New ${element.classList.contains('comment') ? 'comment' : 'post'} added`,
                'polite'
              );
            }
          });
        }
      });
    });
    
    const main = document.querySelector('main, [role="main"]');
    if (main) {
      observer.observe(main, { childList: true, subtree: true });
    }
  }

  setupSkipLinks() {
    // Create skip navigation menu
    const skipNav = document.createElement('nav');
    skipNav.className = 'skip-navigation';
    skipNav.setAttribute('aria-label', 'Skip navigation');
    skipNav.style.cssText = `
      position: absolute;
      top: -200px;
      left: 0;
      right: 0;
      background: #000;
      color: #fff;
      padding: 10px;
      z-index: 10001;
      transition: top 0.3s;
    `;
    
    const skipList = document.createElement('ul');
    skipList.style.cssText = `
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      gap: 20px;
      justify-content: center;
    `;
    
    const skipLinks = [
      { href: '#main-content', text: 'Skip to main content' },
      { href: '#create-post-form', text: 'Skip to post creation' },
      { href: '#comments-section', text: 'Skip to comments' }
    ];
    
    skipLinks.forEach(link => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.text;
      a.style.cssText = 'color: #fff; text-decoration: underline;';
      
      a.addEventListener('focus', () => {
        skipNav.style.top = '0';
      });
      
      a.addEventListener('blur', () => {
        skipNav.style.top = '-200px';
      });
      
      li.appendChild(a);
      skipList.appendChild(li);
    });
    
    skipNav.appendChild(skipList);
    document.body.insertBefore(skipNav, document.body.firstChild);
  }

  enhanceFormAccessibility() {
    // Group related form controls
    this.groupFormControls();
    
    // Add form validation feedback
    this.enhanceFormValidation();
    
    // Improve error handling
    this.improveErrorHandling();
  }

  groupFormControls() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      // Group related fields in fieldsets
      const formGroups = form.querySelectorAll('.form-group');
      
      formGroups.forEach(group => {
        const label = group.querySelector('label');
        const input = group.querySelector('input, textarea, select');
        
        if (label && input) {
          // Ensure proper label association
          if (!input.id) {
            input.id = `field-${Math.random().toString(36).substr(2, 9)}`;
          }
          label.setAttribute('for', input.id);
          
          // Add describedby for help text
          const helpText = group.querySelector('small, .help-text');
          if (helpText) {
            const helpId = `help-${input.id}`;
            helpText.id = helpId;
            input.setAttribute('aria-describedby', helpId);
          }
        }
      });
    });
  }

  enhanceFormValidation() {
    const inputs = document.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      input.addEventListener('invalid', (e) => {
        e.target.setAttribute('aria-invalid', 'true');
        
        // Create or update error message
        let errorId = `error-${e.target.id}`;
        let errorElement = document.getElementById(errorId);
        
        if (!errorElement) {
          errorElement = document.createElement('div');
          errorElement.id = errorId;
          errorElement.className = 'error-message';
          errorElement.setAttribute('role', 'alert');
          errorElement.style.cssText = 'color: #dc3545; font-size: 0.875em; margin-top: 4px;';
          e.target.parentNode.appendChild(errorElement);
        }
        
        errorElement.textContent = e.target.validationMessage;
        e.target.setAttribute('aria-describedby', 
          (e.target.getAttribute('aria-describedby') || '') + ' ' + errorId);
      });
      
      input.addEventListener('input', (e) => {
        if (e.target.checkValidity()) {
          e.target.setAttribute('aria-invalid', 'false');
          
          const errorElement = document.getElementById(`error-${e.target.id}`);
          if (errorElement) {
            errorElement.remove();
          }
        }
      });
    });
  }

  improveErrorHandling() {
    // Enhance error messages with better descriptions
    const errorElements = document.querySelectorAll('.error, .error-message');
    
    errorElements.forEach(error => {
      if (!error.getAttribute('role')) {
        error.setAttribute('role', 'alert');
      }
      
      if (!error.getAttribute('aria-live')) {
        error.setAttribute('aria-live', 'polite');
      }
    });
  }

  setupLiveRegions() {
    // Monitor for status updates and announce them
    const statusElements = document.querySelectorAll('.status, .notification, .alert');
    
    statusElements.forEach(element => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const text = element.textContent.trim();
            if (text) {
              this.announceToScreenReader(text, 'polite');
            }
          }
        });
      });
      
      observer.observe(element, { 
        childList: true, 
        subtree: true, 
        characterData: true 
      });
    });
  }

  // Utility methods
  humanizeString(str) {
    return str
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  announceToScreenReader(message, priority = 'polite') {
    const liveRegion = document.getElementById(`sr-live-${priority}`);
    if (liveRegion) {
      liveRegion.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  }

  // Public API
  updateInteractionButton(button, isActive) {
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    
    const srText = button.querySelector('.sr-only');
    if (srText) {
      if (button.classList.contains('like-btn')) {
        srText.textContent = isActive ? 'Unlike this post' : 'Like this post';
      }
    }
  }

  announceNewContent(type, count = 1) {
    const message = count === 1 ? 
      `New ${type} added` : 
      `${count} new ${type}s added`;
    
    this.announceToScreenReader(message, 'polite');
  }

  focusElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// Initialize accessibility enhancements
let ansyblAccessibility;

document.addEventListener('DOMContentLoaded', () => {
  ansyblAccessibility = new AnsyblAccessibility();
  
  // Make it globally available
  window.ansyblAccessibility = ansyblAccessibility;
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnsyblAccessibility;
}