# Ansybl Documentation

## Protocol Specification

- **[Ansybl 1.1 Whitepaper](whitepaper.html)** — The main protocol overview. A static-first, cryptographically signed format for publishing social content you own — public, private, or paid.

### Sub-specifications

- **[ANSYBL-CHUNK](ANSYBL-CHUNK.md)** — Chunked Feeds. Defines the append-only NDJSON chunk layout, signed head pointers, hash chaining, sealing rules, differential retrieval, and caching semantics.

- **[ANSYBL-PM](ANSYBL-PM.md)** — Private Messaging. Defines sealed-envelope encryption, key bundles, recipient scanning, channel mode with key trees, restricted audiences, cold contact, and retention.

## Operational Guides

- **[Deployment Guide](deployment-guide.md)** — How to deploy and host an Ansybl node, including R2/S3 configuration, DNS, and bridge setup.

- **[Troubleshooting](troubleshooting.md)** — Common issues, error codes, and debugging procedures.
