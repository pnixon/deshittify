// webpage/components/Sidebar.js
// Sidebar with subscription list and management

window.Sidebar = function Sidebar({ 
  subscriptions, 
  activeSubscription, 
  onSelectSubscription, 
  onRemoveSubscription,
  onMarkAllRead 
}) {
  const { useState } = React;
  const [showActions, setShowActions] = useState(null);

  const totalUnread = subscriptions.reduce((sum, sub) => sum + (sub.unreadCount || 0), 0);

  const handleRemoveSubscription = (subscription, event) => {
    event.stopPropagation();
    
    if (confirm(`Remove subscription to "${subscription.title}"?`)) {
      onRemoveSubscription(subscription.id);
    }
    setShowActions(null);
  };

  const handleMarkAllRead = (subscription, event) => {
    event.stopPropagation();
    onMarkAllRead(subscription.id);
    setShowActions(null);
  };

  const toggleActions = (subscriptionId, event) => {
    event.stopPropagation();
    setShowActions(showActions === subscriptionId ? null : subscriptionId);
  };

  return (
    <aside className="sidebar">
      <div style={{ marginBottom: '24px' }}>
        <h2>
          Subscriptions
          {totalUnread > 0 && (
            <span style={{
              background: '#58a6ff',
              color: '#fff',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
              marginLeft: '8px',
              fontWeight: 'normal'
            }}>
              {totalUnread}
            </span>
          )}
        </h2>
      </div>

      {subscriptions.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          color: '#8b949e', 
          padding: '20px',
          fontStyle: 'italic'
        }}>
          No subscriptions yet.
          <br />
          Add your first Ansybl feed!
        </div>
      ) : (
        <ul className="subscription-list">
          {subscriptions.map(subscription => (
            <li 
              key={subscription.id}
              className={`subscription-item ${activeSubscription?.id === subscription.id ? 'active' : ''}`}
              onClick={() => onSelectSubscription(subscription)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectSubscription(subscription);
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="subscription-title">
                    {subscription.icon && (
                      <img 
                        src={subscription.icon} 
                        alt=""
                        style={{
                          width: '16px',
                          height: '16px',
                          marginRight: '6px',
                          borderRadius: '2px',
                          verticalAlign: 'middle'
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    {subscription.title}
                    {subscription.unreadCount > 0 && (
                      <span style={{
                        background: '#58a6ff',
                        color: '#fff',
                        borderRadius: '10px',
                        padding: '1px 6px',
                        fontSize: '11px',
                        marginLeft: '6px',
                        fontWeight: 'normal'
                      }}>
                        {subscription.unreadCount}
                      </span>
                    )}
                  </div>
                  
                  <div className="subscription-url">
                    {subscription.author?.name && (
                      <span>by {subscription.author.name} • </span>
                    )}
                    {new URL(subscription.feedUrl).hostname}
                  </div>
                  
                  <div className="subscription-stats">
                    {subscription.itemCount} items
                    {subscription.lastFetched && (
                      <span> • Updated {window.AnsyblParser.formatTimestamp(subscription.lastFetched)}</span>
                    )}
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => toggleActions(subscription.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#8b949e',
                      cursor: 'pointer',
                      padding: '4px',
                      fontSize: '16px'
                    }}
                    title="Actions"
                  >
                    ⋮
                  </button>

                  {showActions === subscription.id && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      background: '#161b22',
                      border: '1px solid #21262d',
                      borderRadius: '6px',
                      padding: '4px',
                      minWidth: '150px',
                      zIndex: 100,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                    }}>
                      {subscription.unreadCount > 0 && (
                        <button
                          onClick={(e) => handleMarkAllRead(subscription, e)}
                          className="secondary"
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            marginBottom: '2px',
                            fontSize: '12px'
                          }}
                        >
                          ✓ Mark all read
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(subscription.homePageUrl || subscription.feedUrl, '_blank');
                          setShowActions(null);
                        }}
                        className="secondary"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 8px',
                          marginBottom: '2px',
                          fontSize: '12px'
                        }}
                      >
                        🔗 Visit site
                      </button>
                      
                      <button
                        onClick={(e) => handleRemoveSubscription(subscription, e)}
                        className="danger"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 8px',
                          fontSize: '12px'
                        }}
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Click outside to close actions menu */}
      {showActions && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99
          }}
          onClick={() => setShowActions(null)}
        />
      )}
    </aside>
  );
};