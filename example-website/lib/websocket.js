/**
 * WebSocket service for real-time interaction updates
 */

import { Server as SocketIOServer } from 'socket.io';

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.roomSubscriptions = new Map();
  }

  initialize(server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    console.log('✅ WebSocket service initialized');
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 User connected: ${socket.id}`);

      // Handle user identification
      socket.on('identify', (userData) => {
        this.connectedUsers.set(socket.id, {
          ...userData,
          socketId: socket.id,
          connectedAt: new Date().toISOString()
        });
        
        socket.emit('identified', { 
          success: true, 
          socketId: socket.id,
          message: 'Successfully identified'
        });
        
        console.log(`👤 User identified: ${userData.name} (${socket.id})`);
      });

      // Handle post subscription
      socket.on('subscribe_post', (postId) => {
        socket.join(`post_${postId}`);
        
        if (!this.roomSubscriptions.has(`post_${postId}`)) {
          this.roomSubscriptions.set(`post_${postId}`, new Set());
        }
        this.roomSubscriptions.get(`post_${postId}`).add(socket.id);
        
        socket.emit('subscribed', { 
          postId, 
          room: `post_${postId}`,
          message: `Subscribed to post ${postId} updates`
        });
        
        console.log(`📡 ${socket.id} subscribed to post ${postId}`);
      });

      // Handle post unsubscription
      socket.on('unsubscribe_post', (postId) => {
        socket.leave(`post_${postId}`);
        
        if (this.roomSubscriptions.has(`post_${postId}`)) {
          this.roomSubscriptions.get(`post_${postId}`).delete(socket.id);
        }
        
        socket.emit('unsubscribed', { 
          postId, 
          room: `post_${postId}`,
          message: `Unsubscribed from post ${postId} updates`
        });
        
        console.log(`📡 ${socket.id} unsubscribed from post ${postId}`);
      });

      // Handle global feed subscription
      socket.on('subscribe_feed', () => {
        socket.join('global_feed');
        socket.emit('subscribed', { 
          room: 'global_feed',
          message: 'Subscribed to global feed updates'
        });
        console.log(`📡 ${socket.id} subscribed to global feed`);
      });

      // Handle analytics subscription (for admin dashboards)
      socket.on('subscribe_analytics', () => {
        socket.join('analytics');
        socket.emit('subscribed', { 
          room: 'analytics',
          message: 'Subscribed to analytics updates'
        });
        console.log(`📊 ${socket.id} subscribed to analytics`);
      });

      // Handle typing indicators for comments
      socket.on('typing_start', (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (user && data.postId) {
          socket.to(`post_${data.postId}`).emit('user_typing', {
            userId: user.id,
            userName: user.name,
            postId: data.postId,
            timestamp: new Date().toISOString()
          });
        }
      });

      socket.on('typing_stop', (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (user && data.postId) {
          socket.to(`post_${data.postId}`).emit('user_stopped_typing', {
            userId: user.id,
            userName: user.name,
            postId: data.postId,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          console.log(`🔌 User disconnected: ${user.name} (${socket.id})`);
        } else {
          console.log(`🔌 Anonymous user disconnected: ${socket.id}`);
        }

        // Clean up subscriptions
        this.roomSubscriptions.forEach((subscribers, room) => {
          subscribers.delete(socket.id);
        });

        this.connectedUsers.delete(socket.id);
      });

      // Send initial connection stats
      socket.emit('connection_stats', {
        connectedUsers: this.connectedUsers.size,
        activeRooms: this.roomSubscriptions.size,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Broadcast new interaction to relevant subscribers
  broadcastInteraction(type, postId, interactionData) {
    if (!this.io) return;

    const payload = {
      type: 'interaction',
      action: type, // 'like', 'share', 'comment'
      postId: postId,
      data: interactionData,
      timestamp: new Date().toISOString()
    };

    // Broadcast to post subscribers
    this.io.to(`post_${postId}`).emit('interaction_update', payload);
    
    // Broadcast to global feed subscribers
    this.io.to('global_feed').emit('feed_update', payload);

    console.log(`📡 Broadcasted ${type} interaction for post ${postId} to subscribers`);
  }

  // Broadcast new comment to relevant subscribers
  broadcastComment(postId, commentData) {
    if (!this.io) return;

    const payload = {
      type: 'comment',
      action: 'new_comment',
      postId: postId,
      data: commentData,
      timestamp: new Date().toISOString()
    };

    // Broadcast to post subscribers
    this.io.to(`post_${postId}`).emit('comment_update', payload);
    
    // Broadcast to global feed subscribers
    this.io.to('global_feed').emit('feed_update', payload);

    console.log(`📡 Broadcasted new comment for post ${postId} to subscribers`);
  }

  // Broadcast comment edit/delete to relevant subscribers
  broadcastCommentUpdate(postId, commentId, action, commentData = null) {
    if (!this.io) return;

    const payload = {
      type: 'comment',
      action: action, // 'edit', 'delete', 'moderate'
      postId: postId,
      commentId: commentId,
      data: commentData,
      timestamp: new Date().toISOString()
    };

    // Broadcast to post subscribers
    this.io.to(`post_${postId}`).emit('comment_update', payload);

    console.log(`📡 Broadcasted comment ${action} for post ${postId} to subscribers`);
  }

  // Broadcast analytics updates to admin subscribers
  broadcastAnalytics(analyticsData) {
    if (!this.io) return;

    const payload = {
      type: 'analytics',
      data: analyticsData,
      timestamp: new Date().toISOString()
    };

    this.io.to('analytics').emit('analytics_update', payload);
    console.log(`📊 Broadcasted analytics update to subscribers`);
  }

  // Broadcast notification to specific user
  sendNotification(userId, notification) {
    if (!this.io) return;

    // Find user's socket
    const userSocket = Array.from(this.connectedUsers.entries())
      .find(([socketId, userData]) => userData.id === userId);

    if (userSocket) {
      const [socketId] = userSocket;
      this.io.to(socketId).emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
      console.log(`🔔 Sent notification to user ${userId}`);
    }
  }

  // Get connection statistics
  getConnectionStats() {
    const stats = {
      connectedUsers: this.connectedUsers.size,
      activeRooms: this.roomSubscriptions.size,
      roomDetails: {}
    };

    this.roomSubscriptions.forEach((subscribers, room) => {
      stats.roomDetails[room] = subscribers.size;
    });

    return stats;
  }

  // Get connected users list
  getConnectedUsers() {
    return Array.from(this.connectedUsers.values()).map(user => ({
      id: user.id,
      name: user.name,
      connectedAt: user.connectedAt,
      socketId: user.socketId
    }));
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;