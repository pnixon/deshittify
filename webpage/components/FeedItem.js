// webpage/components/FeedItem.js
// Individual feed item component with interactions

window.FeedItem = function FeedItem({ item, onMarkAsRead }) {
  const { useState, useEffect } = React;
  const [interactions, setInteractions] = useState(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Load interactions on mount
  useEffect(() => {
    const itemInteractions = window.InteractionHandler.getInteractionSummary(
      item.id, 
      item.interactions
    );
    setInteractions(itemInteractions);
  }, [item.id]);

  const handleLike = () => {
    const result = window.InteractionHandler.toggleLike(
      item.id, 
      interactions.likes_count
    );
    
    setInteractions(prev => ({
      ...prev,
      likes_count: result.count,
      user_liked: result.liked
    }));
  };

  const handleShare = () => {
    setShowShareMenu(!showShareMenu);
  };

  const handleReply = () => {
    setShowReplyForm(!showReplyForm);
  };

  const submitReply = () => {
    if (!replyText.trim()) return;
    
    const result = window.InteractionHandler.addReply(
      item.id,
      replyText.trim(),
      interactions.replies_count
    );
    
    setInteractions(prev => ({
      ...prev,
      replies_count: result.count,
      user_replied: true
    }));
    
    setReplyText('');
    setShowReplyForm(false);
  };

  const handleExternalShare = (platform) => {
    window.InteractionHandler.shareToExternal(item, platform);
    setShowShareMenu(false);
    
    // Update local share count
    setInteractions(prev => ({
      ...prev,
      shares_count: prev.shares_count + 1,
      user_shared: true
    }));
  };

  const handleCopyLink = async () => {
    const success = await window.InteractionHandler.copyLink(item);
    if (success) {
      alert('Link copied to clipboard!');
      setInteractions(prev => ({
        ...prev,
        shares_count: prev.shares_count + 1,
        user_shared: true
      }));
    } else {
      alert('Failed to copy link');
    }
    setShowShareMenu(false);
  };

  const renderContent = () => {
    if (item.content_html) {
      return (
        <div 
          className="item-content"
          dangerouslySetInnerHTML={{ __html: item.content_html }}
        />
      );
    } else if (item.content_text) {
      return (
        <div className="item-content">
          {item.content_text.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < item.content_text.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderAttachments = () => {
    if (!item.attachments || item.attachments.length === 0) return null;

    return (
      <div className="attachments">
        {item.attachments.map((attachment, index) => {
          const url = attachment.url;
          const mimeType = attachment.mime_type || '';

          if (mimeType.startsWith('image/')) {
            return (
              <div key={index} className="attachment">
                <img 
                  src={url} 
                  alt={attachment.alt_text || attachment.title || 'Image attachment'}
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                  loading="lazy"
                />
                {attachment.title && (
                  <div style={{ fontSize: '14px', color: '#8b949e', marginTop: '4px' }}>
                    {attachment.title}
                  </div>
                )}
              </div>
            );
          } else if (mimeType.startsWith('video/')) {
            return (
              <div key={index} className="attachment">
                <video 
                  controls 
                  src={url}
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                >
                  Your browser does not support video playback.
                </video>
                {attachment.title && (
                  <div style={{ fontSize: '14px', color: '#8b949e', marginTop: '4px' }}>
                    {attachment.title}
                  </div>
                )}
              </div>
            );
          } else if (mimeType.startsWith('audio/')) {
            return (
              <div key={index} className="attachment">
                <audio controls src={url} style={{ width: '100%' }}>
                  Your browser does not support audio playback.
                </audio>
                {attachment.title && (
                  <div style={{ fontSize: '14px', color: '#8b949e', marginTop: '4px' }}>
                    {attachment.title}
                  </div>
                )}
              </div>
            );
          } else {
            return (
              <div key={index} className="attachment">
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    display: 'inline-block',
                    padding: '8px 12px',
                    background: '#21262d',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    color: '#58a6ff'
                  }}
                >
                  📎 {attachment.title || 'Download attachment'}
                  {attachment.size_in_bytes && (
                    <span style={{ color: '#8b949e', fontSize: '12px', marginLeft: '8px' }}>
                      ({(attachment.size_in_bytes / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </a>
              </div>
            );
          }
        })}
      </div>
    );
  };

  if (!interactions) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <article className="feed-item">
      <div className="item-header">
        <div>
          {item.title && (
            <h2 className="item-title">
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {item.title}
              </a>
            </h2>
          )}
          
          <div className="item-meta">
            <time dateTime={item.date_published}>
              {window.AnsyblParser.formatTimestamp(item.date_published)}
            </time>
            
            {item.author && item.author.name && (
              <span>by {item.author.name}</span>
            )}
            
            {!item.signature && (
              <span style={{ color: '#d29922' }} title="Content signature missing">
                ⚠️ Unverified
              </span>
            )}
          </div>
        </div>
      </div>

      {item.summary && (
        <div style={{ 
          fontStyle: 'italic', 
          color: '#8b949e', 
          marginBottom: '12px',
          fontSize: '14px'
        }}>
          {item.summary}
        </div>
      )}

      {renderContent()}
      {renderAttachments()}

      {item.tags && item.tags.length > 0 && (
        <div className="item-tags">
          {item.tags.map(tag => (
            <span key={tag} className="tag">#{tag}</span>
          ))}
        </div>
      )}

      <div className="interactions">
        <button 
          className={`interaction-button ${interactions.user_liked ? 'active' : ''}`}
          onClick={handleLike}
          title={interactions.user_liked ? 'Unlike' : 'Like'}
        >
          {interactions.user_liked ? '❤️' : '🤍'} {interactions.likes_count}
        </button>

        <div style={{ position: 'relative' }}>
          <button 
            className={`interaction-button ${interactions.user_shared ? 'active' : ''}`}
            onClick={handleShare}
            title="Share"
          >
            🔄 {interactions.shares_count}
          </button>

          {showShareMenu && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: '8px',
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '8px',
              padding: '8px',
              minWidth: '200px',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}>
              <button 
                onClick={handleCopyLink}
                className="secondary"
                style={{ width: '100%', textAlign: 'left', marginBottom: '4px' }}
              >
                🔗 Copy link
              </button>
              <button 
                onClick={() => handleExternalShare('twitter')}
                className="secondary"
                style={{ width: '100%', textAlign: 'left', marginBottom: '4px' }}
              >
                🐦 Share on Twitter
              </button>
              <button 
                onClick={() => handleExternalShare('mastodon')}
                className="secondary"
                style={{ width: '100%', textAlign: 'left', marginBottom: '4px' }}
              >
                🐘 Share on Mastodon
              </button>
              <button 
                onClick={() => handleExternalShare('email')}
                className="secondary"
                style={{ width: '100%', textAlign: 'left' }}
              >
                ✉️ Share via email
              </button>
            </div>
          )}
        </div>

        <button 
          className={`interaction-button ${interactions.user_replied ? 'active' : ''}`}
          onClick={handleReply}
          title="Reply"
        >
          💬 {interactions.replies_count}
        </button>
      </div>

      {showReplyForm && (
        <div style={{ marginTop: '16px', padding: '16px', background: '#0d1117', borderRadius: '8px' }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            rows={3}
            style={{ marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={submitReply} disabled={!replyText.trim()}>
              Post Reply
            </button>
            <button onClick={() => setShowReplyForm(false)} className="secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close share menu */}
      {showShareMenu && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99
          }}
          onClick={() => setShowShareMenu(false)}
        />
      )}
    </article>
  );
};