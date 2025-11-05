# Ansybl Feed Discoverer Browser Extension

A browser extension for discovering and subscribing to Ansybl feeds across the web.

## Features

- **Automatic Feed Discovery**: Scans web pages for Ansybl feeds using multiple detection methods
- **Visual Indicators**: Shows when feeds are found on a page
- **Feed Validation**: Validates feeds against the Ansybl protocol specification
- **Subscription Management**: Subscribe to feeds and sync across devices
- **Import/Export**: Backup and restore your subscriptions
- **Reader Integration**: Open feeds in your preferred Ansybl reader

## Installation

### From Chrome Web Store
1. Visit the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"
3. Follow the installation prompts

### Manual Installation (Development)
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `browser-extension` folder
5. The extension should now appear in your browser toolbar

## Usage

### Discovering Feeds

The extension automatically scans web pages for Ansybl feeds when you visit them. When feeds are found:

1. A badge appears on the extension icon showing the number of feeds
2. A small indicator may appear on the page (if enabled in settings)
3. Click the extension icon to see discovered feeds

### Subscribing to Feeds

1. Click the extension icon when feeds are discovered
2. Click "Validate" to check if a feed is valid
3. Click "Subscribe" to add it to your subscriptions
4. Manage subscriptions in the options page

### Managing Subscriptions

1. Right-click the extension icon and select "Options"
2. Go to the "Subscriptions" tab
3. View, edit, or remove subscriptions
4. Export/import subscription lists

## Detection Methods

The extension uses multiple methods to discover Ansybl feeds:

- **HTML Link Tags**: `<link rel="feed" type="application/ansybl+json" href="...">`
- **Meta Tags**: Meta tags with Ansybl feed references
- **JSON-LD**: Structured data containing feed URLs
- **Content Scanning**: Searching page text for .ansybl URLs
- **Convention-based**: Checking common feed locations like `/feed.ansybl`

## Settings

Access settings by right-clicking the extension icon and selecting "Options":

### General Settings
- Auto-discover feeds on page load
- Show visual indicators on pages
- Validate feeds before subscribing
- Sync subscriptions across devices

### Discovery Settings
- Configure which detection methods to use
- Add custom URL patterns for specific sites
- Control suggestion behavior

### Reader Integration
- Set your preferred Ansybl reader URL
- Choose whether to open feeds in reader or as raw JSON

## Privacy

This extension:
- ✅ Stores subscriptions locally and optionally syncs via browser sync
- ✅ Only accesses the current tab when scanning for feeds
- ✅ Does not track your browsing or send data to third parties
- ✅ Validates feeds by fetching them directly (no proxy servers)

## Development

### Building the Extension

The extension is built with vanilla JavaScript and doesn't require a build process. Simply load the folder in Chrome's developer mode.

### File Structure

```
browser-extension/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── content.js            # Content script for page scanning
├── popup.html/js/css     # Extension popup interface
├── options.html/js/css   # Options/settings page
├── icons/                # Extension icons
└── README.md            # This file
```

### Testing

1. Load the extension in developer mode
2. Visit websites with Ansybl feeds
3. Check that feeds are discovered and can be subscribed to
4. Test import/export functionality
5. Verify settings are saved and applied

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Report issues on GitHub
- Visit https://ansybl.org for protocol documentation
- Join the community discussions

## Changelog

### Version 1.0.0
- Initial release
- Basic feed discovery and subscription management
- Support for multiple detection methods
- Import/export functionality
- Reader integration