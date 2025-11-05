// webpage/app.js
// Main Ansybl Reader application

function AnsyblReaderApp() {
  const { useState, useEffect } = React;
  
  // State management
  const [subscriptions, setSubscriptions] = useState([]);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [feedData, setFeedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddFeedModal, setShowAddFeedModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Component references
  const Header = window.Header;
  const Sidebar = window.Sidebar;
  const FeedReader = window.FeedReader;
  const AddFeedModal = window.AddFeedModal;

  // Load subscriptions on mount
  useEffect(() => {
    const subs = window.SubscriptionManager.getSubscriptions();
    setSubscriptions(subs);
    
    // Auto-select first subscription if available
    if (subs.length > 0 && !activeSubscription) {
      setActiveSubscription(subs[0]);
    }
  }, []);

  // Load feed data when active subscription changes
  useEffect(() => {
    if (activeSubscription) {
      loadFeedData(activeSubscription);
    } else {
      setFeedData(null);
    }
  }, [activeSubscription]);

  // Load feed data from URL
  const loadFeedData = async (subscription) => {
    setIsLoading(true);
    setFeedData(null);

    try {
      const response = await fetch(subscription.feedUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const feedContent = await response.text();
      const parseResult = window.AnsyblParser.parseAnsyblFeed(feedContent);

      if (parseResult.error) {
        setFeedData({ error: parseResult.error });
      } else {
        setFeedData(parseResult);
        
        // Update subscription metadata
        try {
          window.SubscriptionManager.updateFeedData(subscription.id, parseResult.data);
          // Refresh subscriptions list to show updated counts
          const updatedSubs = window.SubscriptionManager.getSubscriptions();
          setSubscriptions(updatedSubs);
          
          // Update active subscription reference
          const updatedActive = updatedSubs.find(s => s.id === subscription.id);
          if (updatedActive) {
            setActiveSubscription(updatedActive);
          }
        } catch (error) {
          console.warn('Failed to update subscription metadata:', error);
        }
      }
    } catch (error) {
      setFeedData({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle subscription selection
  const handleSelectSubscription = (subscription) => {
    setActiveSubscription(subscription);
  };

  // Handle adding new feed
  const handleAddFeed = (subscription, feedData) => {
    const updatedSubs = window.SubscriptionManager.getSubscriptions();
    setSubscriptions(updatedSubs);
    
    // Auto-select the new subscription
    setActiveSubscription(subscription);
  };

  // Handle removing subscription
  const handleRemoveSubscription = (subscriptionId) => {
    try {
      window.SubscriptionManager.removeSubscription(subscriptionId);
      const updatedSubs = window.SubscriptionManager.getSubscriptions();
      setSubscriptions(updatedSubs);
      
      // If removed subscription was active, select first available or none
      if (activeSubscription && activeSubscription.id === subscriptionId) {
        setActiveSubscription(updatedSubs.length > 0 ? updatedSubs[0] : null);
      }
    } catch (error) {
      alert('Failed to remove subscription: ' + error.message);
    }
  };

  // Handle marking all items as read
  const handleMarkAllRead = (subscriptionId) => {
    try {
      window.SubscriptionManager.markAsRead(subscriptionId);
      const updatedSubs = window.SubscriptionManager.getSubscriptions();
      setSubscriptions(updatedSubs);
      
      // Update active subscription reference
      const updatedActive = updatedSubs.find(s => s.id === subscriptionId);
      if (updatedActive) {
        setActiveSubscription(updatedActive);
      }
    } catch (error) {
      console.warn('Failed to mark as read:', error);
    }
  };

  // Handle refreshing all feeds
  const handleRefreshAll = async () => {
    if (subscriptions.length === 0) return;
    
    setIsRefreshing(true);
    
    try {
      // Refresh all subscriptions
      for (const subscription of subscriptions) {
        try {
          const response = await fetch(subscription.feedUrl);
          if (response.ok) {
            const feedContent = await response.text();
            const parseResult = window.AnsyblParser.parseAnsyblFeed(feedContent);
            
            if (!parseResult.error) {
              window.SubscriptionManager.updateFeedData(subscription.id, parseResult.data);
            }
          }
        } catch (error) {
          console.warn(`Failed to refresh ${subscription.title}:`, error);
        }
      }
      
      // Update state
      const updatedSubs = window.SubscriptionManager.getSubscriptions();
      setSubscriptions(updatedSubs);
      
      // Update active subscription reference
      if (activeSubscription) {
        const updatedActive = updatedSubs.find(s => s.id === activeSubscription.id);
        if (updatedActive) {
          setActiveSubscription(updatedActive);
          // Reload feed data for active subscription
          loadFeedData(updatedActive);
        }
      }
      
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="app-container">
      <Header 
        onAddFeed={() => setShowAddFeedModal(true)}
        onRefreshAll={handleRefreshAll}
        isRefreshing={isRefreshing}
      />
      
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar
          subscriptions={subscriptions}
          activeSubscription={activeSubscription}
          onSelectSubscription={handleSelectSubscription}
          onRemoveSubscription={handleRemoveSubscription}
          onMarkAllRead={handleMarkAllRead}
        />
        
        <FeedReader
          subscription={activeSubscription}
          feedData={isLoading ? null : feedData}
          onMarkAsRead={handleMarkAllRead}
        />
      </div>

      <AddFeedModal
        isOpen={showAddFeedModal}
        onClose={() => setShowAddFeedModal(false)}
        onAddFeed={handleAddFeed}
      />
    </div>
  );
}

// Mount the application
if (typeof window !== "undefined" && window.ReactDOM && document.getElementById("root")) {
  window.ReactDOM.render(
    React.createElement(AnsyblReaderApp), 
    document.getElementById("root")
  );
}