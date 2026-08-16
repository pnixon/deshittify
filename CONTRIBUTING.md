# Contributing to Deshittify

Thanks for your interest in contributing! This project aims to make the web less hostile to users, and we welcome help from anyone who shares that goal.

## Filing Issues

- Search existing issues before opening a new one.
- For bugs: include steps to reproduce, expected vs. actual behavior, and your environment (Node version, browser if relevant).
- For feature requests: describe the problem you're trying to solve, not just the solution you envision.

## Submitting Pull Requests

1. Fork the repo and create a branch from `main`.
2. Keep PRs focused — one logical change per PR.
3. Include tests for new functionality (see Testing below).
4. Update documentation if your change affects the public API or protocol.
5. Ensure all existing tests pass before submitting.

## Code Style

- Standard JavaScript — no transpilation for schema and CLI packages.
- Use ES modules (`import`/`export`).
- Prefer clarity over cleverness.
- No unnecessary dependencies.

## Testing

The test suite lives in `schema/test/`. Run it with:

```bash
cd schema
npm test
```

Add tests for any new schema validators, transformers, or CLI behavior.

## Protocol Specification

The Ansybl protocol spec lives in `docs/`. Changes to the protocol itself (message format, feed structure, signing rules) require discussion in an issue before implementation. Open an issue tagged `[spec]` describing:

- What you want to change and why.
- Backward-compatibility implications.
- Migration path for existing feeds.

Small spec clarifications or typo fixes can go straight to PR.

## License

By contributing, you agree that your contributions will be licensed under the project's existing license.
