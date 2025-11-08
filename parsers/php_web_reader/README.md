# Ansybl PHP Web Reader

A lightweight PHP-based web reader for Ansybl social syndication feeds with an interactive walkthrough feature.

## Features

### Core Functionality
- **Feed Parsing**: Reads Ansybl feeds from URLs or local files
- **JSON Validation**: Validates feed structure and provides error messages
- **Rich Content Support**:
  - Markdown rendering via Parsedown library
  - Plain text with line break preservation
  - HTML escaping for security

### Media Support
- **Images**: Single and multiple image galleries
- **Videos**: HTML5 video player with YouTube embed support
- **Audio**: HTML5 audio player with duration display

### Advanced Features
- **Nested Collections**: Recursive rendering of collection items
- **Author Attribution**: Single and multiple author support
- **Feed Statistics**: Display item counts and content type breakdown
- **Raw JSON Viewer**: View the original feed data
- **Sample Feed Loading**: One-click loading of example content

### Interactive Walkthrough
- **20-Step Guided Tour**: Comprehensive walkthrough of all features
- **Keyboard Navigation**: Arrow keys to navigate, ESC to close
- **Progress Tracking**: Shows current step and total steps
- **User Preferences**: Remembers completion status via localStorage
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Accessibility**: Proper ARIA labels and focus management

## Installation

1. Ensure PHP 7.0 or higher is installed
2. Place the files in a web-accessible directory:
   ```
   php_web_reader/
   ├── reader.php           # Main application
   ├── Parsedown.php        # Markdown parser library
   ├── walkthrough.css      # Walkthrough styling
   ├── walkthrough.js       # Walkthrough functionality
   └── README.md            # This file
   ```

3. Configure your web server to serve PHP files
4. Access `reader.php` in your web browser

## Usage

### Loading a Feed

**From URL:**
```
https://example.com/feed.ansybl
```

**From Domain:**
```
www.example.com
(Automatically prefixes with https://)
```

**From Local File:**
```
../../example-website/data/feed.ansybl
```

### Using the Walkthrough

1. **Auto-Start**: First-time visitors are prompted to take the tour
2. **Manual Start**: Click the "Take a Tour" button (bottom-right)
3. **Navigation**:
   - Click "Next" or press → to advance
   - Click "Back" or press ← to go back
   - Press ESC to exit the tour
4. **Completion**: Tour progress is saved automatically

### Sample Feed Button

Click "Load Sample Feed" to load the example Ansybl feed from the project's example website.

## Walkthrough Steps

The interactive tour covers:

1. Welcome & introduction
2. Feed input form
3. URI input field (URLs, domains, local paths)
4. Sample feed loading
5. Feed metadata display
6. Feed statistics
7. Individual post rendering
8. Markdown rendering
9. Plain text content
10. Image support
11. Video embedding
12. Audio playback
13. Nested collections
14. Author attribution
15. Error handling
16. JSON validation
17. Raw JSON viewer
18. Responsive design
19. PHP implementation details
20. Tour completion

## File Structure

### reader.php
Main application file containing:
- Feed fetching and normalization
- JSON parsing and validation
- Recursive item rendering
- Media URL extraction
- Attribution handling
- Statistics calculation
- HTML template with enhanced UI

### walkthrough.css
Comprehensive styling for:
- Overlay and highlight system
- Tooltip positioning
- Button styles
- Responsive breakpoints (768px, 480px)
- Accessibility features
- Dark mode support
- Print styles
- Reduced motion support

### walkthrough.js
Interactive tour engine featuring:
- Step definition system
- Overlay management
- Tooltip positioning (top, bottom, left, right)
- Element highlighting
- Keyboard navigation
- Progress tracking
- Preference management
- Completion handling

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Security Features

- HTML special character escaping
- URL validation
- JSON error handling
- XSS prevention
- Safe media embedding

## Customization

### Changing the Sample Feed Path
Edit the `loadSample()` function in reader.php:
```javascript
function loadSample() {
    document.getElementById('feed_uri').value = 'path/to/your/feed.ansybl';
    document.getElementById('feed_form').submit();
}
```

### Modifying Walkthrough Steps
Edit the `defineSteps()` method in walkthrough.js to add, remove, or modify tour steps.

### Styling
Customize colors and layout in:
- `<style>` section in reader.php (main UI)
- walkthrough.css (tour styling)

## Technical Details

### Dependencies
- **PHP**: 7.0+
- **Parsedown**: Markdown parser (included)

### Performance
- Minimal server-side processing
- Client-side tour engine (no server requests)
- Efficient recursive rendering
- Optimized CSS animations

### Accessibility
- Semantic HTML5 structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus state management
- Screen reader friendly
- Reduced motion support

## Project Context

This PHP reader is part of the **Ansybl** (formerly Subspace) project - a decentralized social syndication protocol. It demonstrates how to implement an Ansybl feed reader in PHP.

### Related Files
- Main project: `/example-website/` (Node.js/Express implementation)
- Sample feed: `/example-website/data/feed.ansybl`
- Protocol schema: `/schema/`

## License

Part of the Ansybl/Deshittify project.
Repository: https://github.com/pnixon/deshittify

## Contributing

This is a demonstration implementation. For production use:
- Add caching for remote feeds
- Implement rate limiting
- Add feed validation against schema
- Include signature verification
- Add error logging
- Implement session-based preferences (server-side)

## Support

For issues or questions about Ansybl:
- GitHub: https://github.com/pnixon/deshittify
- Documentation: See `/docs` directory in main project
