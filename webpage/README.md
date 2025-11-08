# Ansybl Streams Webpage

A modular, client-side web application for loading and viewing Ansybl streams.

## Overview

This webpage provides a user-friendly interface for loading and displaying various types of Ansybl content including image carousels, post feeds, comments, and podcasts.

## Project Structure

```
webpage/
  index.html          - Main HTML page
  styles.css          - Stylesheet
  app.js              - Application entry point
  components/         - React components
  streams/            - Stream-specific viewers
  utils/              - Utility functions
  plan.md            - Technical architecture plan
```

## Components

### Core Components

- **FileLoader** - Handles file picker, drag-and-drop, and URL input for loading .ansybl streams
- **StreamDashboard** - Main controller that manages loaded streams and routes them to viewers
- **StreamInfoPanel** - Displays loaded streams, statistics, and errors

### Viewers (in `streams/`)

- **CarouselViewer** - Displays image collections as carousels
- **PostFeed** - Displays posts, articles, notes, and mixed collections
- **CommentsSection** - Renders threaded comments
- **PodcastPlayer** - Specialized viewer for audio/video podcast streams

### Utilities (in `utils/`)

- **ansyblParser.js** - Parses .ansybl and .json files into stream objects
- **mergeUtils.js** - Merges multiple streams and deduplicates items
- **renderUtils.js** - Shared rendering helpers

## Features

- Load Ansybl streams via file upload, drag-and-drop, or URL
- Automatic stream type detection and routing
- Support for multiple stream types (images, posts, comments, podcasts)
- Modular and extensible architecture
- Clear error handling and feedback

## Usage

1. Open `index.html` in a web browser
2. Load one or more .ansybl files using:
   - File picker
   - Drag-and-drop
   - URL input
3. The viewer will automatically detect the stream type and display appropriately

## Development

For detailed technical architecture, see [plan.md](./plan.md).

## Examples

Test streams are available in the [examples/](../examples/) directory.

## Related Resources

- [Parsers](../parsers/README.md) - Other parser implementations
- [Schema](../schema/README.md) - Ansybl feed schema and validation
- [Examples](../examples/README.md) - Sample feeds for testing
