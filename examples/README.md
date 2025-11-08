# Ansybl Examples

This directory contains example Ansybl feed files demonstrating various features and use cases of the protocol.

## Contents

### Basic Examples

- **[basic_post_feed.ansybl](./basic_post_feed.ansybl)** - Simple text-based post feed
- **[basic_post_with_image.ansybl](./basic_post_with_image.ansybl)** - Post with image attachment
- **[sample-ansybl-feed.json](./sample-ansybl-feed.json)** - Sample feed in JSON format
- **[sample-multimedia-feed.json](./sample-multimedia-feed.json)** - Feed with various media types

### Media Examples

- **[example_podcast_feed.ansybl](./example_podcast_feed.ansybl)** - Podcast feed with audio episodes

### Comments

- **[comments/](./comments/)** - Examples demonstrating comment and discussion features
  - `blog-stream.ansybl` - Blog post with comment stream
  - `comment-stream.ansybl` - Standalone comment stream
  - `comments_for_basic_post_feed.ansybl` - Comments linked to basic posts

## Usage

These examples can be used to:

1. Understand the Ansybl feed format
2. Test parsers and validators
3. Learn best practices for creating feeds
4. Prototype new features

## Validation

You can validate these examples using the schema validator:

```bash
cd ../schema
node validator.js ../examples/basic_post_feed.ansybl
```

## Related Resources

- [Schema Documentation](../schema/README.md) - Schema and validation tools
- [Parsers](../parsers/README.md) - Tools for reading Ansybl feeds
- [Writers](../writers/README.md) - Tools for creating Ansybl feeds
