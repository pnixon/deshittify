/**
 * Ansybl API Playground JavaScript
 */

// Example data
const examples = {
  validate: {
    valid: {
      version: "https://ansybl.org/version/1.0",
      title: "Valid Ansybl Feed",
      description: "This is a valid feed example",
      home_page_url: "https://example.com",
      feed_url: "https://example.com/feed.ansybl",
      author: {
        name: "Demo Author",
        url: "https://example.com/author"
      },
      items: [
        {
          id: "https://example.com/post/1",
          title: "Example Post",
          content_text: "This is an example post",
          date_published: "2025-11-09T10:00:00Z"
        }
      ]
    },
    invalid: {
      version: "https://ansybl.org/version/1.0",
      title: "Invalid Feed",
      home_page_url: "http://example.com", // HTTP not HTTPS
      // Missing required feed_url
      items: []
    },
    minimal: {
      version: "https://ansybl.org/version/1.0",
      title: "Minimal Feed",
      home_page_url: "https://example.com",
      feed_url: "https://example.com/feed.ansybl",
      items: []
    }
  },
  parse: {
    signed: null, // Will be fetched from server
    unsigned: {
      version: "https://ansybl.org/version/1.0",
      title: "Unsigned Feed",
      home_page_url: "https://example.com",
      feed_url: "https://example.com/feed.ansybl",
      items: []
    }
  }
};

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Clear response
    clearResponse();
  });
});

// Load example data
function loadExample(tab, type) {
  const input = document.getElementById(`${tab}-input`);
  const example = examples[tab][type];
  
  if (example) {
    input.value = JSON.stringify(example, null, 2);
  } else if (type === 'signed') {
    // Fetch signed feed from server
    fetch('/feed.ansybl')
      .then(r => r.json())
      .then(feed => {
        input.value = JSON.stringify(feed, null, 2);
      })
      .catch(err => {
        showError('Failed to load signed feed: ' + err.message);
      });
  }
}

// Clear input
function clearInput(tab) {
  document.getElementById(`${tab}-input`).value = '';
  clearResponse();
}

// Clear search
function clearSearch() {
  document.getElementById('search-query').value = '';
  document.getElementById('search-tags').value = '';
  document.getElementById('search-sort').value = 'date';
  clearResponse();
}

// Clear response
function clearResponse() {
  const response = document.getElementById('response');
  response.className = 'response';
  response.innerHTML = '<pre>Response will appear here...</pre>';
}

// Show loading
function showLoading() {
  const response = document.getElementById('response');
  response.className = 'response';
  response.innerHTML = '<pre><span class="status-indicator pending"></span>Loading...</pre>';
}

// Show success
function showSuccess(data) {
  const response = document.getElementById('response');
  response.className = 'response success';
  response.innerHTML = `<pre><span class="status-indicator success"></span>${JSON.stringify(data, null, 2)}</pre>`;
}

// Show error
function showError(message, data = null) {
  const response = document.getElementById('response');
  response.className = 'response error';
  
  let content = `<span class="status-indicator error"></span>Error: ${message}`;
  if (data) {
    content += '\n\n' + JSON.stringify(data, null, 2);
  }
  
  response.innerHTML = `<pre>${content}</pre>`;
}

// Execute validate
async function executeValidate() {
  const input = document.getElementById('validate-input').value;
  
  if (!input.trim()) {
    showError('Please enter a JSON document to validate');
    return;
  }
  
  let document;
  try {
    document = JSON.parse(input);
  } catch (e) {
    showError('Invalid JSON: ' + e.message);
    return;
  }
  
  const warnings = document.getElementById('validate-warnings').checked;
  const strict = document.getElementById('validate-strict').checked;
  const extensions = document.getElementById('validate-extensions').checked;
  
  showLoading();
  
  try {
    const response = await fetch(
      `/api/validate?warnings=${warnings}&strict=${strict}&extensions=${extensions}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document)
      }
    );
    
    const result = await response.json();
    
    if (result.valid) {
      showSuccess(result);
    } else {
      showError('Validation failed', result);
    }
  } catch (error) {
    showError('Request failed: ' + error.message);
  }
}

// Execute parse
async function executeParse() {
  const input = document.getElementById('parse-input').value;
  
  if (!input.trim()) {
    showError('Please enter a JSON document to parse');
    return;
  }
  
  let document;
  try {
    document = JSON.parse(input);
  } catch (e) {
    showError('Invalid JSON: ' + e.message);
    return;
  }
  
  const verify = document.getElementById('parse-verify').checked;
  const metadata = document.getElementById('parse-metadata').checked;
  
  showLoading();
  
  try {
    const response = await fetch(
      `/api/parse?verify=${verify}&metadata=${metadata}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document)
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(result);
    } else {
      showError('Parse failed', result);
    }
  } catch (error) {
    showError('Request failed: ' + error.message);
  }
}

// Execute generate
async function executeGenerate(format = 'ansybl') {
  showLoading();
  
  try {
    let url;
    switch (format) {
      case 'rss':
        url = '/feed.rss';
        break;
      case 'json':
        url = '/feed.json';
        break;
      default:
        url = '/feed.ansybl';
    }
    
    const response = await fetch(url);
    
    if (format === 'rss') {
      const text = await response.text();
      const formatted = formatXML(text);
      showSuccess({ format: 'RSS 2.0', content: formatted });
    } else {
      const data = await response.json();
      showSuccess(data);
    }
  } catch (error) {
    showError('Request failed: ' + error.message);
  }
}

// Execute search
async function executeSearch() {
  const query = document.getElementById('search-query').value;
  const tags = document.getElementById('search-tags').value;
  const sortBy = document.getElementById('search-sort').value;
  
  showLoading();
  
  try {
    const searchParams = {
      query: query || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
      sortBy: sortBy,
      sortOrder: 'desc',
      limit: 10
    };
    
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchParams)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess(result);
    } else {
      showError('Search failed', result);
    }
  } catch (error) {
    showError('Request failed: ' + error.message);
  }
}

// Format XML for display
function formatXML(xml) {
  const PADDING = '  ';
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;
  
  xml = xml.replace(reg, '$1\n$2$3');
  
  return xml.split('\n').map(node => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) {
        pad -= 1;
      }
    } else if (node.match(/^<\w([^>]*[^\/])?>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }
    
    const padding = PADDING.repeat(pad);
    pad += indent;
    
    return padding + node;
  }).join('\n');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('Ansybl API Playground loaded');
  
  // Load default example
  loadExample('validate', 'valid');
});
