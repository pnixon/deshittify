// webpage/components/Header.js
// Main application header with navigation and actions

window.Header = function Header({ onAddFeed, onRefreshAll, isRefreshing }) {
  const { useState } = React;
  const [showMenu, setShowMenu] = useState(false);

  const handleExportSubscriptions = () => {
    try {
      const exportData = window.SubscriptionManager.exportSubscriptions();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `ansybl-subscriptions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setShowMenu(false);
    } catch (error) {
      alert('Failed to export subscriptions: ' + error.message);
    }
  };

  const handleImportSubscriptions = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = window.SubscriptionManager.importSubscriptions(e.target.result);
          alert(`Import complete!\nImported: ${result.imported.length} feeds\nSkipped: ${result.skipped.length} feeds (already subscribed)`);
          window.location.reload(); // Refresh to show new subscriptions
        } catch (error) {
          alert('Failed to import subscriptions: ' + error.message);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
    setShowMenu(false);
  };

  return (
    <header className="header">
      <div>
        <h1>Ansybl Reader</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#8b949e' }}>
          Universal Social Feed Reader
        </p>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={onRefreshAll}
          disabled={isRefreshing}
          title="Refresh all feeds"
        >
          {isRefreshing ? (
            <>
              <span className="spinner" style={{ width: '14px', height: '14px', marginRight: '6px' }}></span>
              Refreshing...
            </>
          ) : (
            '🔄 Refresh All'
          )}
        </button>
        
        <button onClick={onAddFeed}>
          ➕ Add Feed
        </button>
        
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="secondary"
          >
            ⚙️ Menu
          </button>
          
          {showMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '8px',
              padding: '8px',
              minWidth: '200px',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}>
              <button 
                onClick={handleExportSubscriptions}
                className="secondary"
                style={{ 
                  width: '100%', 
                  marginBottom: '4px',
                  textAlign: 'left',
                  padding: '8px 12px'
                }}
              >
                📤 Export Subscriptions
              </button>
              
              <button 
                onClick={handleImportSubscriptions}
                className="secondary"
                style={{ 
                  width: '100%', 
                  marginBottom: '4px',
                  textAlign: 'left',
                  padding: '8px 12px'
                }}
              >
                📥 Import Subscriptions
              </button>
              
              <button 
                onClick={() => {
                  if (confirm('Clear all interactions? This cannot be undone.')) {
                    window.InteractionHandler.clearAll();
                    alert('Interactions cleared');
                  }
                  setShowMenu(false);
                }}
                className="secondary"
                style={{ 
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px'
                }}
              >
                🗑️ Clear Interactions
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Click outside to close menu */}
      {showMenu && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setShowMenu(false)}
        />
      )}
    </header>
  );
};