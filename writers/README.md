# Ansybl Writers

This directory contains tools and utilities for creating and publishing Ansybl feeds.

## Contents

- **[subspace-writer/](./subspace-writer/)** - Subspace integration for feed publishing
  - See [subspace-writer/README.md](./subspace-writer/README.md) for detailed documentation

## Overview

Writers are tools that help you create and publish Ansybl feeds. They can:

- Generate valid Ansybl feed files
- Publish feeds to various hosting platforms
- Integrate with content management systems
- Automate feed creation from other sources

## Creating Your Own Writer

To create a new writer implementation:

1. Review the [Ansybl schema](../schema/ansybl-feed.schema.json)
2. Use the [generator utilities](../schema/generator.js) for feed creation
3. Validate output using the [validator](../schema/validator.js)
4. Test with [example feeds](../examples/)

## Related Resources

- [Schema](../schema/README.md) - Feed generation and validation utilities
- [Examples](../examples/README.md) - Sample feeds
- [Parsers](../parsers/README.md) - Tools for reading feeds
