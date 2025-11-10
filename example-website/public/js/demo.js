/**
 * Ansybl Protocol Demo JavaScript
 */

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  });
});

// Show result
function showResult(data, success = true) {
  const result = document.getElementById('result');
  result.className = `result-content ${success ? 'success' : 'error'}`;
  result.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
}

// Show loading
function showLoading(message = 'Loading') {
  const result = document.getElementById('result');
  result.className = 'result-content';
  result.innerHTML = `<div class="loading">${message}</div>`;
}

// Show error
function showError(message) {
  const result = document.getElementById('result');
  result.className = 'result-content error';
  result.innerHTML = `<pre>Error: ${message}</pre>`;
}

// Update stats
async function updateStats() {
  try {
    const response = await fetch('/api/feed/info');
    const info = await response.json();
    
    document.getElementById('stat-posts').textContent = info.itemCount || 0;
    document.getElementById('stat-items').textContent = info.itemCount || 0;
    
    // Get interaction stats
    const interactionResponse = await fetch('/api/interactions/analytics');
    const interactionData = await interactionResponse.json();
    
    if (interactionData.summary) {
      const total = (interactionData.summary.totalLikes || 0) + 
                   (interactionData.summary.totalShares || 0) + 
                   (interactionData.summary.totalComments || 0);
      document.getElementById('stat-interactions').textContent = total;
      document.getElementById('stat-comments').textContent = interactionData.summary.totalComments || 0;
    }
  } catch (error) {
    console.error('Failed to update stats:', error);
  }
}

// Update info
async function updateInfo() {
  try {
    const response = await fetch('/api/feed/info');
    const info = await response.json();
    
    document.getElementById('info-content').textContent = JSON.stringify(info, null, 2);
  } catch (error) {
    document.getElementById('info-content').textContent = 'Failed to load feed information';
  }
}

// Demo: Feed Generation
async function demoFeedGeneration() {
  showLoading('Generating Ansybl feed');
  
  try {
    const response = await fetch('/feed.ansybl');
    const feed = await response.json();
    
    showResult({
      message: 'Feed generated successfully!',
      feed: {
        version: feed.version,
        title: feed.title,
        itemCount: feed.items.length,
        hasFeedSignature: !!feed.signature,
        signedItems: feed.items.filter(item => item.signature).length,
        sample: feed.items.slice(0, 2)
      }
    });
    
    await updateStats();
  } catch (error) {
    showError(error.message);
  }
}

// Demo: Validation
async function demoValidation() {
  showLoading('Running validation tests');
  
  try {
    // Get current feed
    const feedResponse = await fetch('/feed.ansybl');
    const feed = await feedResponse.json();
    
    // Validate it
    const validationResponse = await fetch('/api/validate?warnings=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feed)
    });
    
    const result = await validationResponse.json();
    
    showResult({
      message: result.valid ? 'Feed is valid!' : 'Feed has validation errors',
      validation: {
        valid: result.valid,
        errorCount: result.errors?.length || 0,
        warningCount: result.warnings?.length || 0,
        errors: result.errors || [],
        warnings: result.warnings || [],
        performance: result.performance
      }
    }, result.valid);
  } catch (error) {
    showError(error.message);
  }
}

// Demo: Signature Verification
async function demoSignatureVerification() {
  showLoading('Verifying cryptographic signatures');
  
  try {
    // Get current feed
    const feedResponse = await fetch('/feed.ansybl');
    const feed = await feedResponse.json();
    
    // Parse with verification
    const parseResponse = await fetch('/api/parse?verify=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feed)
    });
    
    const result = await parseResponse.json();
    
    showResult({
      message: 'Signature verification complete',
      verification: {
        success: result.success,
        feedSignatureValid: result.verification?.feedSignatureValid,
        itemSignaturesValid: result.verification?.itemSignaturesValid,
        invalidItems: result.verification?.invalidItems || [],
        totalItems: feed.items.length,
        signedItems: feed.items.filter(item => item.signature).length
      }
    }, result.success && result.verification?.feedSignatureValid);
  } catch (error) {
    showError(error.message);
  }
}

// Demo: Protocol Bridges
async function demoBridges() {
  showLoading('Testing protocol bridges');
  
  try {
    const results = {};
    
    // Test RSS bridge
    const rssResponse = await fetch('/feed.rss');
    results.rss = {
      status: rssResponse.ok ? 'Available' : 'Failed',
      contentType: rssResponse.headers.get('content-type'),
      size: rssResponse.headers.get('content-length')
    };
    
    // Test JSON Feed bridge
    const jsonFeedResponse = await fetch('/feed.json');
    const jsonFeed = await jsonFeedResponse.json();
    results.jsonFeed = {
      status: jsonFeedResponse.ok ? 'Available' : 'Failed',
      version: jsonFeed.version,
      itemCount: jsonFeed.items?.length
    };
    
    // Test ActivityPub bridge
    const actorResponse = await fetch('/actor');
    const actor = await actorResponse.json();
    results.activityPub = {
      status: actorResponse.ok ? 'Available' : 'Failed',
      actorType: actor.type,
      hasPublicKey: !!actor.publicKey
    };
    
    showResult({
      message: 'Protocol bridges tested successfully',
      bridges: results
    });
  } catch (error) {
    showError(error.message);
  }
}

// Demo: Content Search
async function demoSearch() {
  showLoading('Searching content');
  
  try {
    const searchResponse = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'ansybl',
        sortBy: 'date',
        sortOrder: 'desc',
        limit: 5
      })
    });
    
    const result = await searchResponse.json();
    
    showResult({
      message: `Found ${result.total} results`,
      search: {
        total: result.total,
        returned: result.results.length,
        hasMore: result.hasMore,
        results: result.results.map(r => ({
          id: r.id,
          title: r.title,
          type: r.type,
          datePublished: r.datePublished || r.date_published
        }))
      }
    });
  } catch (error) {
    showError(error.message);
  }
}

// Demo: Social Interactions
async function demoInteractions() {
  showLoading('Testing social interactions');
  
  try {
    // Get first post
    const feedResponse = await fetch('/feed.ansybl');
    const feed = await feedResponse.json();
    const firstPost = feed.items.find(item => !item.in_reply_to);
    
    if (!firstPost) {
      showError('No posts available for interaction demo');
      return;
    }
    
    const postId = firstPost.id.split('/').pop();
    
    // Get current interactions
    const interactionsResponse = await fetch(`/api/posts/${postId}/interactions`);
    const interactions = await interactionsResponse.json();
    
    showResult({
      message: 'Social interactions retrieved',
      post: {
        id: postId,
        title: firstPost.title
      },
      interactions: {
        likes: interactions.counts.likes,
        shares: interactions.counts.shares,
        replies: interactions.counts.replies,
        recentLikes: interactions.likes.slice(0, 3),
        recentShares: interactions.shares.slice(0, 3)
      }
    });
  } catch (error) {
    showError(error.message);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Ansybl Protocol Demo loaded');
  
  // Load initial stats and info
  await updateStats();
  await updateInfo();
  
  // Auto-run feed generation demo
  setTimeout(() => {
    demoFeedGeneration();
  }, 500);
});
