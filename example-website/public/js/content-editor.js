/**
 * Advanced Content Editor for Ansybl
 * Provides rich text editing, markdown support, and drag-and-drop media upload
 */

class AnsyblContentEditor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      enableMarkdown: true,
      enableRichText: true,
      enablePreview: true,
      enableDragDrop: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
      ...options
    };
    
    this.currentMode = 'markdown'; // 'markdown', 'richtext', 'preview'
    this.content = '';
    this.attachments = [];
    this.isDirty = false;
    
    this.init();
  }

  init() {
    this.createEditorInterface();
    this.setupEventHandlers();
    this.setupDragAndDrop();
    this.loadFromStorage();
  }

  createEditorInterface() {
    this.container.innerHTML = `
      <div class="content-editor">
        <div class="editor-toolbar">
          <div class="editor-modes">
            <button class="mode-btn active" data-mode="markdown">
              <span class="icon">📝</span> Markdown
            </button>
            <button class="mode-btn" data-mode="richtext">
              <span class="icon">✏️</span> Rich Text
            </button>
            <button class="mode-btn" data-mode="preview">
              <span class="icon">👁️</span> Preview
            </button>
          </div>
          
          <div class="editor-actions">
            <button class="action-btn" id="save-draft" title="Save Draft">
              <span class="icon">💾</span>
            </button>
            <button class="action-btn" id="load-draft" title="Load Draft">
              <span class="icon">📂</span>
            </button>
            <button class="action-btn" id="clear-editor" title="Clear All">
              <span class="icon">🗑️</span>
            </button>
          </div>
        </div>

        <div class="editor-content">
          <div class="editor-panel markdown-panel active">
            <div class="markdown-toolbar">
              <button class="format-btn" data-format="bold" title="Bold">
                <strong>B</strong>
              </button>
              <button class="format-btn" data-format="italic" title="Italic">
                <em>I</em>
              </button>
              <button class="format-btn" data-format="heading" title="Heading">
                H1
              </button>
              <button class="format-btn" data-format="link" title="Link">
                🔗
              </button>
              <button class="format-btn" data-format="image" title="Image">
                🖼️
              </button>
              <button class="format-btn" data-format="code" title="Code">
                &lt;/&gt;
              </button>
              <button class="format-btn" data-format="quote" title="Quote">
                💬
              </button>
              <button class="format-btn" data-format="list" title="List">
                📋
              </button>
            </div>
            <textarea class="editor-textarea" placeholder="Write your content in Markdown..."></textarea>
          </div>

          <div class="editor-panel richtext-panel">
            <div class="richtext-toolbar">
              <select class="format-select" data-format="formatBlock">
                <option value="p">Paragraph</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
              </select>
              <button class="format-btn" data-format="bold" title="Bold">
                <strong>B</strong>
              </button>
              <button class="format-btn" data-format="italic" title="Italic">
                <em>I</em>
              </button>
              <button class="format-btn" data-format="underline" title="Underline">
                <u>U</u>
              </button>
              <button class="format-btn" data-format="createLink" title="Link">
                🔗
              </button>
              <button class="format-btn" data-format="insertUnorderedList" title="Bullet List">
                • List
              </button>
              <button class="format-btn" data-format="insertOrderedList" title="Numbered List">
                1. List
              </button>
            </div>
            <div class="editor-richtext" contenteditable="true" 
                 placeholder="Write your content with rich formatting..."></div>
          </div>

          <div class="editor-panel preview-panel">
            <div class="preview-content"></div>
          </div>
        </div>

        <div class="media-upload-area">
          <div class="upload-zone" id="upload-zone">
            <div class="upload-prompt">
              <span class="upload-icon">📎</span>
              <p>Drag and drop files here, or <button class="upload-btn">choose files</button></p>
              <small>Supports images, videos, audio, and PDFs (max 10MB each)</small>
            </div>
            <input type="file" id="file-input" multiple accept="image/*,video/*,audio/*,application/pdf" hidden>
          </div>
          
          <div class="attachments-list" id="attachments-list"></div>
        </div>

        <div class="editor-status">
          <span class="word-count">0 words</span>
          <span class="char-count">0 characters</span>
          <span class="save-status"></span>
        </div>
      </div>
    `;
  }  setupE
ventHandlers() {
    // Mode switching
    this.container.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchMode(e.target.dataset.mode);
      });
    });

    // Markdown formatting
    this.container.querySelectorAll('.markdown-toolbar .format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.applyMarkdownFormat(e.target.dataset.format);
      });
    });

    // Rich text formatting
    this.container.querySelectorAll('.richtext-toolbar .format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.applyRichTextFormat(e.target.dataset.format);
      });
    });

    // Rich text format select
    const formatSelect = this.container.querySelector('.format-select');
    if (formatSelect) {
      formatSelect.addEventListener('change', (e) => {
        document.execCommand('formatBlock', false, e.target.value);
      });
    }

    // Content change handlers
    const textarea = this.container.querySelector('.editor-textarea');
    const richtext = this.container.querySelector('.editor-richtext');

    if (textarea) {
      textarea.addEventListener('input', () => {
        this.content = textarea.value;
        this.updatePreview();
        this.updateWordCount();
        this.markDirty();
      });
    }

    if (richtext) {
      richtext.addEventListener('input', () => {
        this.content = richtext.innerHTML;
        this.updateWordCount();
        this.markDirty();
      });
    }

    // File upload
    const fileInput = this.container.querySelector('#file-input');
    const uploadBtn = this.container.querySelector('.upload-btn');
    
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        this.handleFileUpload(e.target.files);
      });
    }

    // Editor actions
    const saveBtn = this.container.querySelector('#save-draft');
    const loadBtn = this.container.querySelector('#load-draft');
    const clearBtn = this.container.querySelector('#clear-editor');

    if (saveBtn) saveBtn.addEventListener('click', () => this.saveDraft());
    if (loadBtn) loadBtn.addEventListener('click', () => this.loadDraft());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearEditor());

    // Auto-save
    setInterval(() => {
      if (this.isDirty) {
        this.autoSave();
      }
    }, 30000); // Auto-save every 30 seconds
  }

  setupDragAndDrop() {
    const uploadZone = this.container.querySelector('#upload-zone');
    
    if (!uploadZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadZone.addEventListener(eventName, this.preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadZone.addEventListener(eventName, () => {
        uploadZone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadZone.addEventListener(eventName, () => {
        uploadZone.classList.remove('drag-over');
      }, false);
    });

    uploadZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      this.handleFileUpload(files);
    }, false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  switchMode(mode) {
    // Update active mode button
    this.container.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    this.container.querySelector(`[data-mode="${mode}"]`).classList.add('active');

    // Update active panel
    this.container.querySelectorAll('.editor-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    this.container.querySelector(`.${mode}-panel`).classList.add('active');

    // Convert content if switching modes
    if (mode === 'preview') {
      this.updatePreview();
    } else if (mode === 'richtext' && this.currentMode === 'markdown') {
      this.convertMarkdownToRichText();
    } else if (mode === 'markdown' && this.currentMode === 'richtext') {
      this.convertRichTextToMarkdown();
    }

    this.currentMode = mode;
  }  app
lyMarkdownFormat(format) {
    const textarea = this.container.querySelector('.editor-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let replacement = '';

    switch (format) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`;
        break;
      case 'heading':
        replacement = `# ${selectedText || 'Heading'}`;
        break;
      case 'link':
        const url = prompt('Enter URL:');
        replacement = `[${selectedText || 'link text'}](${url || 'https://example.com'})`;
        break;
      case 'image':
        const imgUrl = prompt('Enter image URL:');
        replacement = `![${selectedText || 'alt text'}](${imgUrl || 'https://example.com/image.jpg'})`;
        break;
      case 'code':
        replacement = selectedText.includes('\n') ? 
          `\`\`\`\n${selectedText || 'code'}\n\`\`\`` : 
          `\`${selectedText || 'code'}\``;
        break;
      case 'quote':
        replacement = `> ${selectedText || 'quote'}`;
        break;
      case 'list':
        replacement = `- ${selectedText || 'list item'}`;
        break;
    }

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    
    // Update cursor position
    const newPos = start + replacement.length;
    textarea.setSelectionRange(newPos, newPos);
    
    this.content = textarea.value;
    this.updatePreview();
    this.updateWordCount();
    this.markDirty();
  }

  applyRichTextFormat(format) {
    const richtext = this.container.querySelector('.editor-richtext');
    if (!richtext) return;

    richtext.focus();

    if (format === 'createLink') {
      const url = prompt('Enter URL:');
      if (url) {
        document.execCommand(format, false, url);
      }
    } else {
      document.execCommand(format, false, null);
    }

    this.content = richtext.innerHTML;
    this.updateWordCount();
    this.markDirty();
  }

  updatePreview() {
    const previewContent = this.container.querySelector('.preview-content');
    if (!previewContent) return;

    let htmlContent = '';
    
    if (this.currentMode === 'markdown') {
      // Convert markdown to HTML using marked library if available
      if (typeof marked !== 'undefined') {
        htmlContent = marked.parse(this.content);
      } else {
        // Basic markdown conversion
        htmlContent = this.basicMarkdownToHtml(this.content);
      }
    } else if (this.currentMode === 'richtext') {
      htmlContent = this.content;
    }

    previewContent.innerHTML = htmlContent;
  }

  basicMarkdownToHtml(markdown) {
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/!\[([^\]]*)\]\(([^\)]*)\)/gim, '<img alt="$1" src="$2" />')
      .replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2">$1</a>')
      .replace(/`([^`]*)`/gim, '<code>$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br>');
  }

  convertMarkdownToRichText() {
    const richtext = this.container.querySelector('.editor-richtext');
    if (!richtext) return;

    const htmlContent = this.basicMarkdownToHtml(this.content);
    richtext.innerHTML = htmlContent;
  }

  convertRichTextToMarkdown() {
    const textarea = this.container.querySelector('.editor-textarea');
    if (!textarea) return;

    // Basic HTML to markdown conversion
    let markdown = this.content
      .replace(/<h1>(.*?)<\/h1>/gim, '# $1\n')
      .replace(/<h2>(.*?)<\/h2>/gim, '## $1\n')
      .replace(/<h3>(.*?)<\/h3>/gim, '### $1\n')
      .replace(/<strong>(.*?)<\/strong>/gim, '**$1**')
      .replace(/<em>(.*?)<\/em>/gim, '*$1*')
      .replace(/<a href="([^"]*)">(.*?)<\/a>/gim, '[$2]($1)')
      .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gim, '![$1]($2)')
      .replace(/<code>(.*?)<\/code>/gim, '`$1`')
      .replace(/<blockquote>(.*?)<\/blockquote>/gim, '> $1')
      .replace(/<li>(.*?)<\/li>/gim, '- $1')
      .replace(/<br\s*\/?>/gim, '\n')
      .replace(/<[^>]*>/gim, ''); // Remove remaining HTML tags

    textarea.value = markdown;
    this.content = markdown;
  }  async 
handleFileUpload(files) {
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      if (!this.validateFile(file)) {
        continue;
      }

      try {
        const attachment = await this.uploadFile(file);
        this.attachments.push(attachment);
        this.renderAttachment(attachment);
        this.markDirty();
      } catch (error) {
        console.error('File upload failed:', error);
        this.showError(`Failed to upload ${file.name}: ${error.message}`);
      }
    }
  }

  validateFile(file) {
    // Check file size
    if (file.size > this.options.maxFileSize) {
      this.showError(`File ${file.name} is too large. Maximum size is ${this.options.maxFileSize / 1024 / 1024}MB`);
      return false;
    }

    // Check file type
    const isAllowed = this.options.allowedFileTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isAllowed) {
      this.showError(`File type ${file.type} is not allowed`);
      return false;
    }

    return true;
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('media', file);

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      id: Date.now() + Math.random(),
      file: result.file,
      url: result.url,
      type: file.type,
      name: file.name,
      size: file.size
    };
  }

  renderAttachment(attachment) {
    const attachmentsList = this.container.querySelector('#attachments-list');
    if (!attachmentsList) return;

    const attachmentEl = document.createElement('div');
    attachmentEl.className = 'attachment-item';
    attachmentEl.dataset.attachmentId = attachment.id;

    let preview = '';
    if (attachment.type.startsWith('image/')) {
      preview = `<img src="${attachment.url}" alt="${attachment.name}" class="attachment-preview">`;
    } else if (attachment.type.startsWith('video/')) {
      preview = `<video src="${attachment.url}" class="attachment-preview" controls></video>`;
    } else if (attachment.type.startsWith('audio/')) {
      preview = `<audio src="${attachment.url}" class="attachment-preview" controls></audio>`;
    } else {
      preview = `<div class="file-preview">📄 ${attachment.name}</div>`;
    }

    attachmentEl.innerHTML = `
      <div class="attachment-preview-container">
        ${preview}
      </div>
      <div class="attachment-info">
        <div class="attachment-name">${attachment.name}</div>
        <div class="attachment-size">${this.formatFileSize(attachment.size)}</div>
        <div class="attachment-actions">
          <button class="insert-btn" onclick="contentEditor.insertAttachment('${attachment.id}')">
            Insert
          </button>
          <button class="remove-btn" onclick="contentEditor.removeAttachment('${attachment.id}')">
            Remove
          </button>
        </div>
      </div>
    `;

    attachmentsList.appendChild(attachmentEl);
  }

  insertAttachment(attachmentId) {
    const attachment = this.attachments.find(a => a.id == attachmentId);
    if (!attachment) return;

    let insertText = '';
    if (attachment.type.startsWith('image/')) {
      insertText = `![${attachment.name}](${attachment.url})`;
    } else {
      insertText = `[${attachment.name}](${attachment.url})`;
    }

    if (this.currentMode === 'markdown') {
      const textarea = this.container.querySelector('.editor-textarea');
      if (textarea) {
        const cursorPos = textarea.selectionStart;
        textarea.value = textarea.value.substring(0, cursorPos) + 
                        insertText + 
                        textarea.value.substring(cursorPos);
        textarea.focus();
        textarea.setSelectionRange(cursorPos + insertText.length, cursorPos + insertText.length);
        this.content = textarea.value;
        this.updatePreview();
      }
    } else if (this.currentMode === 'richtext') {
      const richtext = this.container.querySelector('.editor-richtext');
      if (richtext) {
        richtext.focus();
        if (attachment.type.startsWith('image/')) {
          document.execCommand('insertImage', false, attachment.url);
        } else {
          document.execCommand('insertHTML', false, 
            `<a href="${attachment.url}">${attachment.name}</a>`);
        }
        this.content = richtext.innerHTML;
      }
    }

    this.updateWordCount();
    this.markDirty();
  }

  removeAttachment(attachmentId) {
    this.attachments = this.attachments.filter(a => a.id != attachmentId);
    const attachmentEl = this.container.querySelector(`[data-attachment-id="${attachmentId}"]`);
    if (attachmentEl) {
      attachmentEl.remove();
    }
    this.markDirty();
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }  u
pdateWordCount() {
    const wordCountEl = this.container.querySelector('.word-count');
    const charCountEl = this.container.querySelector('.char-count');
    
    if (!wordCountEl || !charCountEl) return;

    let textContent = '';
    if (this.currentMode === 'markdown') {
      textContent = this.content;
    } else if (this.currentMode === 'richtext') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.content;
      textContent = tempDiv.textContent || tempDiv.innerText || '';
    }

    const words = textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    const chars = textContent.length;

    wordCountEl.textContent = `${words} words`;
    charCountEl.textContent = `${chars} characters`;
  }

  markDirty() {
    this.isDirty = true;
    const saveStatus = this.container.querySelector('.save-status');
    if (saveStatus) {
      saveStatus.textContent = 'Unsaved changes';
      saveStatus.className = 'save-status unsaved';
    }
  }

  markClean() {
    this.isDirty = false;
    const saveStatus = this.container.querySelector('.save-status');
    if (saveStatus) {
      saveStatus.textContent = 'All changes saved';
      saveStatus.className = 'save-status saved';
    }
  }

  saveDraft() {
    const draft = {
      content: this.content,
      mode: this.currentMode,
      attachments: this.attachments,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('ansybl-draft', JSON.stringify(draft));
    this.markClean();
    this.showSuccess('Draft saved successfully');
  }

  loadDraft() {
    const draft = localStorage.getItem('ansybl-draft');
    if (!draft) {
      this.showError('No draft found');
      return;
    }

    try {
      const parsedDraft = JSON.parse(draft);
      this.content = parsedDraft.content || '';
      this.attachments = parsedDraft.attachments || [];
      
      // Load content into appropriate editor
      if (parsedDraft.mode === 'markdown') {
        const textarea = this.container.querySelector('.editor-textarea');
        if (textarea) textarea.value = this.content;
      } else if (parsedDraft.mode === 'richtext') {
        const richtext = this.container.querySelector('.editor-richtext');
        if (richtext) richtext.innerHTML = this.content;
      }

      // Switch to the saved mode
      this.switchMode(parsedDraft.mode || 'markdown');

      // Render attachments
      const attachmentsList = this.container.querySelector('#attachments-list');
      if (attachmentsList) {
        attachmentsList.innerHTML = '';
        this.attachments.forEach(attachment => {
          this.renderAttachment(attachment);
        });
      }

      this.updateWordCount();
      this.updatePreview();
      this.markClean();
      this.showSuccess('Draft loaded successfully');
    } catch (error) {
      this.showError('Failed to load draft: ' + error.message);
    }
  }

  autoSave() {
    if (this.content.trim().length > 0) {
      this.saveDraft();
    }
  }

  clearEditor() {
    if (this.isDirty && !confirm('You have unsaved changes. Are you sure you want to clear the editor?')) {
      return;
    }

    this.content = '';
    this.attachments = [];
    
    const textarea = this.container.querySelector('.editor-textarea');
    const richtext = this.container.querySelector('.editor-richtext');
    const attachmentsList = this.container.querySelector('#attachments-list');

    if (textarea) textarea.value = '';
    if (richtext) richtext.innerHTML = '';
    if (attachmentsList) attachmentsList.innerHTML = '';

    this.updateWordCount();
    this.updatePreview();
    this.markClean();
  }

  loadFromStorage() {
    // Auto-load draft if available
    const draft = localStorage.getItem('ansybl-draft');
    if (draft) {
      try {
        const parsedDraft = JSON.parse(draft);
        if (parsedDraft.content && parsedDraft.content.trim().length > 0) {
          // Show option to load draft
          setTimeout(() => {
            if (confirm('Found a saved draft. Would you like to load it?')) {
              this.loadDraft();
            }
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to parse saved draft:', error);
      }
    }
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `editor-notification ${type}`;
    notification.textContent = message;

    // Add to container
    this.container.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 3000);
  }

  // Public API methods
  getContent() {
    return {
      content: this.content,
      mode: this.currentMode,
      attachments: this.attachments
    };
  }

  setContent(content, mode = 'markdown') {
    this.content = content;
    this.switchMode(mode);
    
    if (mode === 'markdown') {
      const textarea = this.container.querySelector('.editor-textarea');
      if (textarea) textarea.value = content;
    } else if (mode === 'richtext') {
      const richtext = this.container.querySelector('.editor-richtext');
      if (richtext) richtext.innerHTML = content;
    }

    this.updateWordCount();
    this.updatePreview();
  }

  reset() {
    this.clearEditor();
  }
}

// Global instance for easy access
window.contentEditor = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const editorContainer = document.getElementById('content-editor-container');
  if (editorContainer) {
    window.contentEditor = new AnsyblContentEditor('content-editor-container');
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnsyblContentEditor;
}