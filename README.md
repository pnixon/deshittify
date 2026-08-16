# Ansybl

A static-first, cryptographically signed format for the social web.

Ansybl is a decentralized social content publishing protocol. Authors publish signed JSON feeds as static files to any hosting provider — no servers, no databases, no vendor lock-in. Content is signed with Ed25519 for verifiable authorship and optionally encrypted with X25519 for private messaging.

## Specification

- [Whitepaper](docs/whitepaper.html) — full protocol specification
- [Chunked Feeds](docs/ANSYBL-CHUNK.md) — paginated feed format for scalable publishing
- [Private Messaging](docs/ANSYBL-PM.md) — encrypted envelope specification

## Key Properties

- **Static hosting** — publish to any CDN, object store, or web server. No runtime required.
- **Verifiable authorship** — every entry is Ed25519-signed; readers verify without trusting the host.
- **Encrypted messaging** — sealed envelopes via X25519 ECDH; metadata-minimal private channels.
- **Constant poll cost** — head files and conditional GET keep subscription cost O(1) per feed.
- **Full portability** — move your feed by copying files. Your identity is your key, not your URL.
- **Protocol bridges** — parsers and writers enable interop with existing platforms and formats.

## Repository Structure

| Directory | Description |
|-----------|-------------|
| `schema/` | JSON Schema definitions and validation tools |
| `cli/` | Command-line tools for feed authoring and verification |
| `browser-extension/` | Browser extension for reading Ansybl feeds |
| `parsers/` | Feed parsers (React.js, PHP) |
| `writers/subspace-writer/` | Feed writer implementations |
| `webpage/` | Client-side feed reader |
| `signal/` | Multi-stream encrypted reader demo |
| `examples/` | Sample feeds and usage examples |
| `example-website/` | Static site demonstrating feed integration |
| `android-example/` | Android client example |
| `docs/` | Protocol specifications and documentation |
| `deployment-templates/` | Infrastructure templates for feed hosting |
| `monitoring/` | Feed health and availability monitoring |

## Live Demo

The [Signal reader](https://pub-f1ec6e7db2c84f17afce200743cceef6.r2.dev/index.html) demonstrates multi-stream encrypted feed consumption — subscribing to multiple Ansybl feeds with real-time decryption in the browser.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/pnixon/deshittify.git
cd deshittify

# Validate a feed against the schema
cd schema && npm install
node validate.js ../examples/feed.ansybl

# Run the CLI tools
cd ../cli && npm install
node ansybl-cli.js --help
```

## Status

- **v1.0** — Reference implementation complete. Schema, parsers, writers, and reader all functional.
- **v1.1** — Specified (chunked NDJSON, BLAKE3 hash chains, key bundles, sealed envelopes). Implementation in progress.

## Contributing

Contributions welcome. Open an issue to discuss protocol changes before submitting a PR.

## License

MIT

## Authors

- Pete Nixon
- Matt
