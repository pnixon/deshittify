/**
 * Interactive Walkthrough System for Ansybl Example Website
 * Guides users through all major features with step-by-step instructions
 */

class AnsyblWalkthrough {
  constructor() {
    this.currentStep = 0;
    this.isActive = false;
    this.overlay = null;
    this.tooltip = null;
    this.steps = this.defineSteps();
    this.preferences = this.loadPreferences();
  }

  defineSteps() {
    return [
      {
        title: "Welcome to Ansybl! 👋",
        content: "This is a complete demonstration of the Ansybl social syndication protocol. Let's take a tour of all the features!",
        target: ".site-header",
        position: "bottom",
        action: null,
        highlightPadding: 20
      },
      {
        title: "Ansybl Feed 📡",
        content: "Click here to view the live Ansybl feed. It's a JSON document containing all posts with cryptographic signatures for authenticity verification.",
        target: "a[href='/feed.ansybl']",
        position: "bottom",
        action: null,
        highlightPadding: 10
      },
      {
        title: "Create Posts ✍️",
        content: "You can create new posts right from the website! Posts support multiple formats: plain text, HTML, and Markdown. All posts are automatically added to the Ansybl feed.",
        target: ".create-post-section",
        position: "bottom",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Rich Content Editor 📝",
        content: "Click the 'Create Post' button to reveal the form. The content editor supports real-time Markdown preview, syntax highlighting, and media attachments.",
        target: ".create-post-btn",
        position: "bottom",
        action: () => {
          const btn = document.querySelector('.create-post-btn');
          if (btn && window.toggleCreateForm) {
            setTimeout(() => {
              const form = document.getElementById('create-post-form');
              if (!form || form.style.display === 'none') {
                window.toggleCreateForm();
              }
            }, 500);
          }
        },
        highlightPadding: 10
      },
      {
        title: "Post Format Support 🎨",
        content: "Each post can include a title, summary, rich content (text, HTML, or Markdown), and tags. The content editor provides real-time preview and formatting tools.",
        target: "#content-editor-container",
        position: "top",
        action: null,
        highlightPadding: 15,
        waitForElement: true
      },
      {
        title: "Media Attachments 📎",
        content: "Posts can include images, videos, and audio files. Media is automatically processed, optimized, and included in the Ansybl feed with proper metadata.",
        target: "#post-form",
        position: "top",
        action: null,
        highlightPadding: 10,
        waitForElement: true
      },
      {
        title: "Post Previews 📰",
        content: "All published posts appear here with summaries, publication dates, tags, and interaction counts. Click any post title to view the full content.",
        target: ".posts .post-preview:first-child",
        position: "right",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Social Interactions 💬",
        content: "Each post shows likes, shares, and reply counts. These interactions are tracked and included in the Ansybl feed for syndication.",
        target: ".post-interactions-preview",
        position: "top",
        action: null,
        highlightPadding: 10
      },
      {
        title: "Tags & Discovery 🏷️",
        content: "Posts can be tagged for better organization and discoverability. Tags help users find related content across the feed.",
        target: ".tags",
        position: "top",
        action: null,
        highlightPadding: 8
      },
      {
        title: "API Endpoints 🔧",
        content: "Ansybl provides a complete REST API for validation, parsing, and interaction. Scroll down to see all available endpoints.",
        target: "#api-demo",
        position: "top",
        action: () => {
          const apiDemo = document.getElementById('api-demo');
          if (apiDemo) {
            apiDemo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        highlightPadding: 20
      },
      {
        title: "Validation API ✅",
        content: "The validation endpoint checks any Ansybl document against the official JSON schema. It provides detailed error messages and suggestions for fixes.",
        target: ".api-endpoints .endpoint:nth-child(2)",
        position: "top",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Parser & Verification 🔐",
        content: "The parser API processes Ansybl documents and verifies cryptographic signatures using Ed25519. This ensures content authenticity and prevents tampering.",
        target: ".api-endpoints .endpoint:nth-child(3)",
        position: "top",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Comments System 💭",
        content: "Comments are first-class citizens in Ansybl. They're automatically added to the feed as reply items with proper threading support.",
        target: ".api-endpoints .endpoint:nth-child(4)",
        position: "top",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Interaction Tracking 👍",
        content: "The interactions API handles likes, shares, and other social signals. All interactions are tracked in the feed metadata.",
        target: ".api-endpoints .endpoint:nth-child(5)",
        position: "top",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Media Upload 🖼️",
        content: "Upload images, videos, and audio through the API. Media is automatically processed, optimized (images are resized, videos are compressed), and securely stored.",
        target: ".api-endpoints .endpoint:nth-child(6)",
        position: "top",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Protocol Bridges 🌉",
        content: "Ansybl feeds can be converted to other popular formats like RSS 2.0, JSON Feed, and ActivityPub for maximum interoperability.",
        target: ".protocol-bridges",
        position: "top",
        action: () => {
          const bridges = document.querySelector('.protocol-bridges');
          if (bridges) {
            bridges.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        highlightPadding: 20
      },
      {
        title: "RSS 2.0 Bridge 📻",
        content: "Convert your Ansybl feed to RSS 2.0 format for compatibility with traditional feed readers like Feedly, NewsBlur, and others.",
        target: ".bridge-endpoints .endpoint:nth-child(1)",
        position: "top",
        action: null,
        highlightPadding: 15
      },
      {
        title: "JSON Feed Bridge 📋",
        content: "JSON Feed is a modern, JSON-based syndication format. The bridge preserves all metadata and content while converting between formats.",
        target: ".bridge-endpoints .endpoint:nth-child(2)",
        position: "top",
        action: null,
        highlightPadding: 15
      },
      {
        title: "ActivityPub Federation 🌐",
        content: "ActivityPub support enables federation with Mastodon, Pleroma, and other Fediverse platforms. Your Ansybl feed becomes part of the decentralized social web!",
        target: ".bridge-endpoints .endpoint:nth-child(3)",
        position: "top",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Advanced Features 🚀",
        content: "This site also includes search, filtering, real-time updates via WebSocket, accessibility features, and user preference management. Explore the interface to discover more!",
        target: ".site-header",
        position: "bottom",
        action: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        highlightPadding: 20
      },
      {
        title: "Tour Complete! 🎉",
        content: "You've seen all the major features of the Ansybl protocol implementation. Click on any post to see detailed content, interact with it, and leave comments. Try creating your own post to see the full workflow!",
        target: ".site-header",
        position: "bottom",
        action: null,
        highlightPadding: 20
      }
    ];
  }

  loadPreferences() {
    try {
      const prefs = localStorage.getItem('ansybl_walkthrough_prefs');
      return prefs ? JSON.parse(prefs) : { completed: false, dontShowAgain: false };
    } catch (e) {
      return { completed: false, dontShowAgain: false };
    }
  }

  savePreferences() {
    try {
      localStorage.setItem('ansybl_walkthrough_prefs', JSON.stringify(this.preferences));
    } catch (e) {
      console.warn('Could not save walkthrough preferences');
    }
  }

  start() {
    if (this.isActive) return;

    this.isActive = true;
    this.currentStep = 0;
    this.createOverlay();
    this.showStep(0);
  }

  stop() {
    this.isActive = false;
    this.removeOverlay();
    this.removeTooltip();
  }

  createOverlay() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'walkthrough-overlay';
    this.overlay.innerHTML = `
      <div class="walkthrough-highlight"></div>
    `;
    document.body.appendChild(this.overlay);

    // Close walkthrough when clicking overlay (outside highlighted area)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.stop();
      }
    });
  }

  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  createTooltip() {
    if (this.tooltip) return this.tooltip;

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'walkthrough-tooltip';
    document.body.appendChild(this.tooltip);
    return this.tooltip;
  }

  removeTooltip() {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  async showStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    this.currentStep = stepIndex;
    const step = this.steps[stepIndex];

    // Execute step action if provided
    if (step.action) {
      step.action();
    }

    // Wait for element if needed
    if (step.waitForElement) {
      await this.waitForElement(step.target);
    }

    const targetElement = document.querySelector(step.target);
    if (!targetElement) {
      console.warn(`Walkthrough: Target element not found: ${step.target}`);
      // Skip to next step if element not found
      if (stepIndex < this.steps.length - 1) {
        setTimeout(() => this.showStep(stepIndex + 1), 1000);
      } else {
        this.complete();
      }
      return;
    }

    // Scroll target into view
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Highlight the target element
    this.highlightElement(targetElement, step.highlightPadding || 10);

    // Show tooltip
    this.showTooltip(step, targetElement);
  }

  highlightElement(element, padding = 10) {
    const rect = element.getBoundingClientRect();
    const highlight = this.overlay.querySelector('.walkthrough-highlight');

    highlight.style.top = `${rect.top + window.scrollY - padding}px`;
    highlight.style.left = `${rect.left + window.scrollX - padding}px`;
    highlight.style.width = `${rect.width + padding * 2}px`;
    highlight.style.height = `${rect.height + padding * 2}px`;
  }

  showTooltip(step, targetElement) {
    const tooltip = this.createTooltip();
    const rect = targetElement.getBoundingClientRect();

    tooltip.innerHTML = `
      <div class="walkthrough-tooltip-header">
        <h3>${step.title}</h3>
        <button class="walkthrough-close" aria-label="Close walkthrough">×</button>
      </div>
      <div class="walkthrough-tooltip-body">
        <p>${step.content}</p>
      </div>
      <div class="walkthrough-tooltip-footer">
        <div class="walkthrough-progress">
          Step ${this.currentStep + 1} of ${this.steps.length}
        </div>
        <div class="walkthrough-controls">
          ${this.currentStep > 0 ? '<button class="walkthrough-btn walkthrough-btn-back">← Back</button>' : ''}
          ${this.currentStep < this.steps.length - 1
            ? '<button class="walkthrough-btn walkthrough-btn-next">Next →</button>'
            : '<button class="walkthrough-btn walkthrough-btn-finish">Finish</button>'}
        </div>
      </div>
    `;

    // Position tooltip
    this.positionTooltip(tooltip, rect, step.position || 'bottom');

    // Add event listeners
    tooltip.querySelector('.walkthrough-close').addEventListener('click', () => this.stop());

    const backBtn = tooltip.querySelector('.walkthrough-btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showStep(this.currentStep - 1));
    }

    const nextBtn = tooltip.querySelector('.walkthrough-btn-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.showStep(this.currentStep + 1));
    }

    const finishBtn = tooltip.querySelector('.walkthrough-btn-finish');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => this.complete());
    }

    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyboard.bind(this), { once: true });
  }

  positionTooltip(tooltip, targetRect, position) {
    const tooltipWidth = 400;
    const tooltipGap = 20;

    // Wait for tooltip to be rendered
    setTimeout(() => {
      const tooltipHeight = tooltip.offsetHeight;
      let top, left;

      switch (position) {
        case 'top':
          top = targetRect.top + window.scrollY - tooltipHeight - tooltipGap;
          left = targetRect.left + window.scrollX + (targetRect.width / 2) - (tooltipWidth / 2);
          break;
        case 'bottom':
          top = targetRect.bottom + window.scrollY + tooltipGap;
          left = targetRect.left + window.scrollX + (targetRect.width / 2) - (tooltipWidth / 2);
          break;
        case 'left':
          top = targetRect.top + window.scrollY + (targetRect.height / 2) - (tooltipHeight / 2);
          left = targetRect.left + window.scrollX - tooltipWidth - tooltipGap;
          break;
        case 'right':
          top = targetRect.top + window.scrollY + (targetRect.height / 2) - (tooltipHeight / 2);
          left = targetRect.right + window.scrollX + tooltipGap;
          break;
        default:
          top = targetRect.bottom + window.scrollY + tooltipGap;
          left = targetRect.left + window.scrollX + (targetRect.width / 2) - (tooltipWidth / 2);
      }

      // Keep tooltip within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < 10) left = 10;
      if (left + tooltipWidth > viewportWidth - 10) {
        left = viewportWidth - tooltipWidth - 10;
      }

      if (top < 10) top = 10;
      if (top + tooltipHeight > viewportHeight + window.scrollY - 10) {
        top = viewportHeight + window.scrollY - tooltipHeight - 10;
      }

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.width = `${tooltipWidth}px`;
    }, 10);
  }

  handleKeyboard(e) {
    if (!this.isActive) return;

    switch (e.key) {
      case 'Escape':
        this.stop();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        if (this.currentStep < this.steps.length - 1) {
          this.showStep(this.currentStep + 1);
        }
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        if (this.currentStep > 0) {
          this.showStep(this.currentStep - 1);
        }
        break;
    }
  }

  complete() {
    this.preferences.completed = true;
    this.savePreferences();
    this.stop();

    // Show completion message
    this.showCompletionMessage();
  }

  showCompletionMessage() {
    const message = document.createElement('div');
    message.className = 'walkthrough-completion-message';
    message.innerHTML = `
      <div class="walkthrough-completion-content">
        <h3>🎉 Tour Complete!</h3>
        <p>You've explored all the major features of Ansybl. Ready to try it yourself?</p>
        <button class="walkthrough-btn walkthrough-btn-primary" onclick="this.parentElement.parentElement.remove()">Get Started</button>
        <button class="walkthrough-btn" onclick="window.walkthroughInstance.start(); this.parentElement.parentElement.remove()">Restart Tour</button>
      </div>
    `;
    document.body.appendChild(message);

    setTimeout(() => {
      message.classList.add('show');
    }, 100);

    setTimeout(() => {
      message.classList.remove('show');
      setTimeout(() => message.remove(), 300);
    }, 5000);
  }

  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }
}

// Create global instance
window.walkthroughInstance = new AnsyblWalkthrough();

// Add walkthrough button when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Create floating walkthrough button
  const walkthroughBtn = document.createElement('button');
  walkthroughBtn.className = 'walkthrough-trigger-btn';
  walkthroughBtn.innerHTML = '📖 Take a Tour';
  walkthroughBtn.setAttribute('aria-label', 'Start interactive walkthrough');
  walkthroughBtn.addEventListener('click', () => {
    window.walkthroughInstance.start();
  });
  document.body.appendChild(walkthroughBtn);

  // Auto-start walkthrough for first-time visitors (optional)
  const prefs = window.walkthroughInstance.preferences;
  if (!prefs.completed && !prefs.dontShowAgain) {
    // Show prompt after a short delay
    setTimeout(() => {
      const shouldStart = confirm('Welcome to Ansybl! Would you like to take a guided tour of the features?');
      if (shouldStart) {
        window.walkthroughInstance.start();
      } else {
        // Mark as "don't show again" if user declines
        prefs.dontShowAgain = true;
        window.walkthroughInstance.savePreferences();
      }
    }, 2000);
  }
});
