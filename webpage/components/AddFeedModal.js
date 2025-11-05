// webpage/components/AddFeedModal.js
// Modal for adding new feed subscriptions

window.AddFeedModal = function AddFeedModal({ isOpen, onClose, onAddFeed }) {
  const { useState } = React;
  const [feedUrl, setFeedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedUrl.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // Validate URL format
      const url = new URL(feedUrl.trim());
      if (url.protocol !== 'https:') {
        throw new Error('Feed URL must use HTTPS');
      }

      // Check if already subscribed
      const existing = window.SubscriptionManager.getSubscriptionByUrl(feedUrl.trim());
      if (existing) {
        throw new Error('Already subscribed to this feed');
      }

      // Fetch and validate feed
      const response = await fetch(feedUrl.trim());
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
      }

      const feedContent = await response.text();
      const parseResult = window.AnsyblParser.parseAnsyblFeed(feedContent);

      if (parseResult.error) {
        throw new Error(`Invalid Ansybl feed: ${parseResult.error}`);
      }

      // Show preview
      setPreviewData({
        url: feedUrl.trim(),
        data: parseResult.data,
        warnings: parseResult.warnings
      });

    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAdd = () => {
    try {
      const subscription = window.SubscriptionManager.addSubscription(
        previewData.url,
        previewData.data
      );
      
      onAddFeed(subscription, previewData.data);
      handleClose();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleClose = () => {
    setFeedUrl('');
    setError('');
    setPreviewData(null);
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Add Ansybl Feed</h2>

        {!previewData ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="feedUrl">Feed URL</label>
              <input
                id="feedUrl"
                type="url"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://example.com/feed.ansybl"
                required
                disabled={isLoading}
              />
              <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
                Enter the HTTPS URL of an Ansybl feed document
              </div>
            </div>

            {error && (
              <div className="error">{error}</div>
            )}

            <div className="form-actions">
              <button type="button" onClick={handleClose} className="secondary">
                Cancel
              </button>
              <button type="submit" disabled={isLoading || !feedUrl.trim()}>
                {isLoading ? (
                  <>
                    <span className="spinner" style={{ width: '14px', height: '14px', marginRight: '6px' }}></span>
                    Validating...
                  </>
                ) : (
                  'Preview Feed'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div>
            {/* Feed Preview */}
            <div style={{ 
              background: '#0d1117', 
              border: '1px solid #21262d', 
              borderRadius: '8px', 
              padding: '16px',
              marginBottom: '16px'
            }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#f0f6fc' }}>
                {previewData.data.title}
              </h3>
              
              {previewData.data.description && (
                <p style={{ margin: '0 0 12px 0', color: '#8b949e' }}>
                  {previewData.data.description}
                </p>
              )}
              
              <div style={{ fontSize: '14px', color: '#8b949e' }}>
                <div>Author: {previewData.data.author.name}</div>
                <div>Items: {previewData.data.items.length}</div>
                <div>URL: {previewData.url}</div>
                {previewData.data.language && (
                  <div>Language: {previewData.data.language}</div>
                )}
              </div>

              {previewData.warnings.length > 0 && (
                <div className="warning" style={{ marginTop: '12px' }}>
                  <strong>Warnings:</strong>
                  <ul style={{ margin: '4px 0 0 20px' }}>
                    {previewData.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {error && (
              <div className="error">{error}</div>
            )}

            <div className="form-actions">
              <button 
                type="button" 
                onClick={() => setPreviewData(null)} 
                className="secondary"
              >
                Back
              </button>
              <button type="button" onClick={handleConfirmAdd}>
                Add Subscription
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};