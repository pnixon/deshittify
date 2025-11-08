/**
 * Interactive Walkthrough System for Ansybl PHP Web Reader
 * Guides users through feed reading features with step-by-step instructions
 */

class AnsyblPHPWalkthrough {
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
        title: "Welcome to Ansybl PHP Web Reader!",
        content: "This is a lightweight PHP-based reader for Ansybl feeds. It demonstrates how to parse and display Ansybl content using PHP. Let's explore the features!",
        target: ".page-header",
        position: "bottom",
        action: null,
        highlightPadding: 20
      },
      {
        title: "Feed Input Form",
        content: "Enter an Ansybl feed URL or local file path here. The reader supports both remote feeds (via HTTP/HTTPS) and local JSON files.",
        target: "#feed_form",
        position: "bottom",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Feed URI Input",
        content: "You can enter: (1) Full URLs like 'https://example.com/feed.ansybl', (2) Domain names like 'www.example.com', or (3) Local file paths. URLs are automatically normalized.",
        target: "#feed_uri",
        position: "bottom",
        action: null,
        highlightPadding: 10
      },
      {
        title: "Try a Sample Feed",
        content: "Click the 'Load Sample Feed' button to see the reader in action with example Ansybl content. This demonstrates all supported features.",
        target: "#load-sample-btn",
        position: "bottom",
        action: null,
        highlightPadding: 10
      },
      {
        title: "Feed Metadata",
        content: "When a feed is loaded, the feed's summary and metadata are displayed here. This shows the feed title, description, and other top-level information.",
        target: ".feed-header",
        position: "bottom",
        action: null,
        highlightPadding: 15
      },
      {
        title: "Feed Statistics",
        content: "View quick statistics about the feed including total number of items, types of content (posts, images, videos, etc.), and last update time.",
        target: ".feed-stats",
        position: "bottom",
        action: null,
        highlightPadding: 10
      },
      {
        title: "Individual Posts",
        content: "Each post in the feed is rendered as a separate item with its title, content, and metadata. Posts are displayed in chronological order.",
        target: ".feed-item:first-child",
        position: "right",
        action: () => {
          const feedItem = document.querySelector('.feed-item');
          if (feedItem) {
            feedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        highlightPadding: 15
      },
      {
        title: "Markdown Rendering",
        content: "Posts with 'text/markdown' mediaType are automatically rendered as formatted HTML using the Parsedown library. This supports headings, lists, code blocks, and more.",
        target: ".markdown",
        position: "top",
        action: null,
        highlightPadding: 12
      },
      {
        title: "Plain Text Content",
        content: "Non-markdown content is displayed as plain text with line breaks preserved. HTML special characters are escaped for security.",
        target: ".feed-item",
        position: "top",
        action: null,
        highlightPadding: 10
      },
      {
        title: "Image Support",
        content: "Image posts are rendered with proper sizing and aspect ratios. Multiple images in a single post are displayed as a gallery.",
        target: ".feed-item img",
        position: "top",
        action: () => {
          const img = document.querySelector('.feed-item img');
          if (img) {
            img.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        highlightPadding: 15
      },
      {
        title: "Video Embedding",
        content: "Video posts support both native HTML5 video and YouTube embeds. YouTube URLs are automatically converted to iframe embeds.",
        target: "video, iframe",
        position: "top",
        action: () => {
          const video = document.querySelector('video, iframe');
          if (video) {
            video.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        highlightPadding: 15
      },
      {
        title: "Audio Playback",
        content: "Audio posts are rendered with HTML5 audio players. Duration information is displayed when available in the feed metadata.",
        target: "audio",
        position: "top",
        action: () => {
          const audio = document.querySelector('audio');
          if (audio) {
            audio.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        highlightPadding: 12
      },
      {
        title: "Nested Collections",
        content: "Ansybl supports collections (nested feeds). Collections are displayed with their own heading and contain multiple sub-items, which can themselves be collections.",
        target: ".collection",
        position: "top",
        action: () => {
          const collection = document.querySelector('.collection');
          if (collection) {
            collection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        highlightPadding: 20
      },
      {
        title: "Author Attribution",
        content: "Posts display author information when available in the 'attributedTo' field. Multiple authors are supported and displayed as a comma-separated list.",
        target: ".feed-item small, .collection small",
        position: "top",
        action: null,
        highlightPadding: 8
      },
      {
        title: "Error Handling",
        content: "The reader provides clear error messages for invalid JSON, missing feeds, or network errors. Error details help you troubleshoot feed issues.",
        target: ".error-message",
        position: "top",
        action: null,
        highlightPadding: 15
      },
      {
        title: "JSON Validation",
        content: "All feeds are validated as proper JSON. If parsing fails, you'll see the specific JSON error message to help identify the problem.",
        target: ".feed-info",
        position: "bottom",
        action: null,
        highlightPadding: 12
      },
      {
        title: "View Raw Feed",
        content: "Click 'View Raw JSON' to see the original Ansybl feed data. This is useful for debugging or understanding the feed structure.",
        target: "#view-raw-btn",
        position: "top",
        action: null,
        highlightPadding: 10
      },
      {
        title: "Responsive Design",
        content: "The reader is fully responsive and works on mobile devices, tablets, and desktop screens. Try resizing your browser to see the adaptive layout!",
        target: "body",
        position: "top",
        action: null,
        highlightPadding: 20
      },
      {
        title: "PHP Implementation",
        content: "This reader is built with vanilla PHP and demonstrates how to parse Ansybl feeds server-side. The source code shows best practices for handling JSON, media, and nested data.",
        target: ".page-footer",
        position: "top",
        action: () => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        },
        highlightPadding: 15
      },
      {
        title: "Tour Complete!",
        content: "You've explored all features of the Ansybl PHP Web Reader. Try loading different feeds to see how it handles various content types and structures. The reader is open source and ready for integration into your own PHP projects!",
        target: ".page-header",
        position: "bottom",
        action: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        highlightPadding: 20
      }
    ];
  }

  loadPreferences() {
    try {
      const prefs = localStorage.getItem('ansybl_php_walkthrough_prefs');
      return prefs ? JSON.parse(prefs) : { completed: false, dontShowAgain: false };
    } catch (e) {
      return { completed: false, dontShowAgain: false };
    }
  }

  savePreferences() {
    try {
      localStorage.setItem('ansybl_php_walkthrough_prefs', JSON.stringify(this.preferences));
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

    // Close walkthrough when clicking overlay
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

    // Wait a bit for any action to complete
    await new Promise(resolve => setTimeout(resolve, 300));

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
        <h3>Tour Complete!</h3>
        <p>You've explored all features of the Ansybl PHP Web Reader. Try loading your own feeds!</p>
        <button class="walkthrough-btn walkthrough-btn-primary" onclick="this.parentElement.parentElement.remove()">Start Reading</button>
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
}

// Create global instance
window.walkthroughInstance = new AnsyblPHPWalkthrough();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Create floating walkthrough button
  const walkthroughBtn = document.createElement('button');
  walkthroughBtn.className = 'walkthrough-trigger-btn';
  walkthroughBtn.innerHTML = 'Take a Tour';
  walkthroughBtn.setAttribute('aria-label', 'Start interactive walkthrough');
  walkthroughBtn.addEventListener('click', () => {
    window.walkthroughInstance.start();
  });
  document.body.appendChild(walkthroughBtn);

  // Auto-start for first-time visitors (optional)
  const prefs = window.walkthroughInstance.preferences;
  if (!prefs.completed && !prefs.dontShowAgain) {
    // Show prompt after a short delay
    setTimeout(() => {
      const shouldStart = confirm('Welcome to the Ansybl PHP Web Reader! Would you like a quick tour?');
      if (shouldStart) {
        window.walkthroughInstance.start();
      } else {
        prefs.dontShowAgain = true;
        window.walkthroughInstance.savePreferences();
      }
    }, 1500);
  }
});
