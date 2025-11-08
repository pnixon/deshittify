# Ansybl Parsers

This directory contains parser implementations for reading and displaying Ansybl feeds across different platforms and languages.

## Contents

### Platform-Specific Parsers

- **[reactjs/](./reactjs/)** - React.js parser and components for web applications
  - See [reactjs/README.md](./reactjs/README.md) for detailed documentation

- **[php_web_reader/](./php_web_reader/)** - PHP-based web reader
  - `reader.php` - Main PHP reader implementation
  - `Parsedown.php` - Markdown parsing library

- **[android_reader.md](./android_reader.md)** - Documentation for Android parser implementation
  - See also: [android-example/](../android-example/) for full Android app

### Utilities

- **[args/](./args/)** - Command-line argument parsing utilities
  - `arg_parser.py` - Python-based argument parser

## Usage

Each parser is designed for a specific platform or use case:

### React.js Parser

For web applications using React:

```bash
cd reactjs
npm install
# See reactjs/README.md for usage
```

### PHP Web Reader

For PHP-based websites:

```php
require_once 'parsers/php_web_reader/reader.php';
// Use reader functions
```

### Android

For Android applications, see the [android-example](../android-example/) directory for a complete implementation.

## Examples

Example feeds to test parsers with can be found in the [examples/](../examples/) directory.

## Schema

All parsers should validate feeds against the [Ansybl schema](../schema/ansybl-feed.schema.json).

## Related Resources

- [Examples](../examples/README.md) - Sample feeds for testing
- [Schema](../schema/README.md) - Feed validation and schema
- [Writers](../writers/README.md) - Tools for creating feeds
