// webpage/components/FeedReader.js
// Main feed reading component

window.FeedReader = function FeedReader({ subscription, feedData, onMarkAsRead }) {
  const { useState, useEffect } = React;
  const [sortBy, setSortBy] = useState('date_published');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterBy, setFilterBy] = useState('all');

  const FeedItem = window.FeedItem;

  if (!subscription) {
    return (
      <div className="main-content">
        <div style={{ 
          textAlign: 'center', 
          color: '#8b949e', 
          padding: '60px 20px',
          fontSize: '18px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📖</div>
          <h2 style={{ color: '#f0f6fc', marginBottom: '8px' }}>Welcome to Ansybl Reader</h2>
          <p>Select a feed from the sidebar to start reading, or add your first subscription.</p>
        </div>
      </div>
    );
  }

  if (!feedData) {
    return (
      <div className="main-content">
        <div className="loading">
          <span className="spinner"></span>
          Loading feed...
        </div>
      </div>
    );
  }

  if (feedData.error) {
    return (
      <div className="main-content">
        <div className="error">
          <h3>Failed to load feed</h3>
          <p>{feedData.error}</p>
          <p>Feed URL: {subscription.feedUrl}</p>
        </div>
      </div>
    );
  }

  const feed = feedData.data;
  const warnings = feedData.warnings || [];

  // Sort and filter items
  const processedItems = feed.items
    .filter(item => {
      if (filterBy === 'all') return true;
      if (filterBy === 'unread') {
        // In a real app, you'd track read status per item
        return true; // For now, show all items
      }
      if (filterBy === 'today') {
        const today = new Date();
        const itemDate = new Date(item.date_published);
        return itemDate.toDateString() === today.toDateString();
      }
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'date_published' || sortBy === 'date_modified') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

  return (
    <div className="main-content">
      {/* Feed Header */}
      <div className="feed-header">
        <h1 className="feed-title">{feed.title}</h1>
        
        {feed.description && (
          <p className="feed-description">{feed.description}</p>
        )}
        
        <div className="feed-meta">
          <div className="feed-author">
            {feed.author.avatar && (
              <img 
                src={feed.author.avatar} 
                alt={feed.author.name}
                className="author-avatar"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <span>by {feed.author.name}</span>
          </div>
          
          <span>{feed.items.length} items</span>
          
          {feed.language && (
            <span>Language: {feed.language}</span>
          )}
          
          <a 
            href={feed.home_page_url} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#58a6ff', textDecoration: 'none' }}
          >
            Visit website →
          </a>
        </div>

        {warnings.length > 0 && (
          <div className="warning" style={{ marginTop: '12px' }}>
            <strong>Feed warnings:</strong>
            <ul style={{ margin: '4px 0 0 20px' }}>
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px',
        padding: '16px',
        background: '#161b22',
        borderRadius: '8px',
        border: '1px solid #21262d'
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ marginRight: '8px', fontSize: '14px' }}>Sort by:</label>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '4px',
                color: '#e6edf3',
                padding: '4px 8px'
              }}
            >
              <option value="date_published">Date Published</option>
              <option value="title">Title</option>
            </select>
          </div>
          
          <div>
            <label style={{ marginRight: '8px', fontSize: '14px' }}>Order:</label>
            <select 
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '4px',
                color: '#e6edf3',
                padding: '4px 8px'
              }}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          
          <div>
            <label style={{ marginRight: '8px', fontSize: '14px' }}>Filter:</label>
            <select 
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              style={{
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '4px',
                color: '#e6edf3',
                padding: '4px 8px'
              }}
            >
              <option value="all">All items</option>
              <option value="today">Today</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: '14px', color: '#8b949e' }}>
          Showing {processedItems.length} of {feed.items.length} items
        </div>
      </div>

      {/* Feed Items */}
      {processedItems.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          color: '#8b949e', 
          padding: '40px',
          background: '#161b22',
          borderRadius: '8px',
          border: '1px solid #21262d'
        }}>
          No items match the current filter.
        </div>
      ) : (
        <div>
          {processedItems.map(item => (
            <FeedItem 
              key={item.id} 
              item={item}
              onMarkAsRead={onMarkAsRead}
            />
          ))}
        </div>
      )}
    </div>
  );
};