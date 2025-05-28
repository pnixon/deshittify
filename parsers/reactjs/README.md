# Subspace Ansybl Feed Reader (AI Generated)

A modern, web-based ActivityStreams feed reader designed for the Ansybl format. This proof-of-concept application demonstrates advanced social media feed rendering with multi-stream merging capabilities.

## ✨ Key Features

### 🔄 **Multi-Stream Merging**
- **Additive Loading**: Load multiple feeds and comment streams that merge together
- **Smart Deduplication**: Prevents duplicate content based on item IDs
- **Flexible Order**: Load comments before feeds, feeds before comments, or mix freely
- **Persistent Data**: Previously loaded content stays visible when adding new streams

### 📱 **Rich Media Support**
- **Images**: Grid layouts for multi-image posts, automatic resizing
- **Videos**: YouTube embeds with responsive players, native video support
- **Audio**: Built-in audio players with duration display
- **Documents**: Markdown rendering, plain text formatting

### 💬 **Advanced Comment System**
- **Nested Threading**: Multi-level comment replies with visual indentation
- **Comment Linking**: Comments automatically associate with their parent posts
- **Standalone Comments**: View comment-only feeds independently
- **Author Attribution**: Rich author information display

### 🎨 **Modern Interface**
- **Dark Theme**: GitHub-inspired dark mode interface
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Interactive Elements**: Hover effects, smooth animations
- **Typography**: Hashtag and mention highlighting

## 🚀 Getting Started

### Quick Setup

1. **Clone or download** the repository
2. **Serve the files** using any local web server:
   ```bash
   # Python 3
   python -m http.server 3000
   
   # Node.js (if you have http-server installed)
   npx http-server -p 3000
   
   # Or use the included servers
   node simple-server.js
   
   # or
   npm run dev
   ```
3. **Open your browser** to `http://localhost:3000`

## 📖 How to Use

### Loading Your First Feed

1. **From URL**: 
   - Paste an ActivityStreams feed URL into the text field
   - Click "Add from URL"
   - The feed content will appear below

2. **From File**:
   - Click "Choose File" and select a `.ansybl` or `.json` file
   - The feed loads automatically after selection

### Multi-Stream Workflow

The reader's power comes from combining multiple streams:

```
Step 1: Load main feed      →  Posts appear
Step 2: Add comment stream  →  Comments link to posts  
Step 3: Add another feed    →  More posts merge in
Step 4: Add more comments   →  Enhanced discussions
```

**Example Workflow:**
1. Load your main social feed from `https://example.com/feed.ansybl`
2. Add comments from `https://example.com/comments.ansybl` 
3. Add a friend's feed from a local file
4. View everything merged with full comment threading

### Stream Management

- **View Loaded Streams**: See all loaded sources with timestamps and item counts
- **Clear All**: Reset everything to start fresh
- **Additive Loading**: Each new stream adds to existing content

## 📋 Supported Formats

### ActivityStreams 2.0 Objects
- ✅ **Collections & OrderedCollections**
- ✅ **Articles, Notes, Images, Videos, Audio**
- ✅ **Nested Collections** (collections within collections)
- ✅ **Comment Objects** with `inReplyTo` relationships

### Media Types
- **Images**: JPEG, PNG, GIF, SVG, WebP
- **Videos**: YouTube URLs (auto-embed), MP4, WebM, AVI
- **Audio**: MP3, WAV, OGG, AAC
- **Content**: Markdown, HTML, Plain text

### Metadata Support
- Author attribution with profiles
- Publication timestamps
- Tags and hashtags
- Media attachments
- Content summaries
- Duration information

## 🎯 Use Cases

### Social Media Feeds
- Personal timeline aggregation
- Multi-platform content merging
- Comment system integration

### Content Publishing
- Blog post collections with comments
- Portfolio showcases with descriptions
- Documentation with community feedback

### Research & Analysis
- Social media data visualization
- Comment thread analysis
- Multi-source content comparison

## 🔧 Technical Details

### File Structure
```
├── index.html          # Main application entry point
├── styles.css          # Complete styling (dark theme)
├── app.js             # React application with multi-stream logic
├── simple-server.js   # Basic static file server
└── README.md          # This documentation
```

### Dependencies (CDN-loaded)
- **React 18**: Component framework
- **Axios**: HTTP client for URL loading
- **Marked**: Markdown parsing
- **Babel**: JSX transformation

### Browser Compatibility
- Modern browsers with ES6+ support
- Chrome 70+, Firefox 65+, Safari 12+, Edge 79+

## 🎨 Customization

### Theme Colors
The interface uses a GitHub-inspired dark theme with these key colors:
- **Background**: `#0d1117` (Dark blue-black)
- **Cards**: `#161b22` (Slightly lighter)
- **Accent**: `#58a6ff` (Bright blue)
- **Text**: `#e6edf3` (Light gray)

### Layout Options
- Responsive breakpoints at 768px
- Image grids adapt from 2-4 columns
- Comment threading with depth limits
- Collapsible sections for large feeds

## 🚀 Advanced Features

### Smart Content Detection
- Automatically identifies feeds vs. comment streams
- YouTube URL detection and embedding
- Hashtag and mention parsing
- Image collection optimization

### Performance Optimizations
- Lazy loading for large feeds
- Error handling for broken media
- Duplicate content prevention
- Efficient DOM updates

### Extensibility
- Modular rendering functions
- Pluggable media handlers
- Customizable content processors
- Open architecture for new features

## 📝 Example Data Formats

### Basic Feed Structure
```json
{
  "type": "OrderedCollection",
  "name": "My Social Feed",
  "totalItems": 25,
  "orderedItems": [...]
}
```

### Comment Stream Structure
```json
{
  "type": "OrderedCollection", 
  "name": "Comments",
  "orderedItems": [
    {
      "type": "Note",
      "inReplyTo": "post-id-123",
      "content": "Great post!",
      "attributedTo": "user@example.com"
    }
  ]
}
```

---

**Built for the Ansybl ecosystem** • **Open source** • **No tracking or analytics**