# Ansybl CLI

Command-line tools for Ansybl feed management and validation.

## Installation

```bash
npm install -g ansybl-cli
```

Or run directly with npx:

```bash
npx ansybl-cli --help
```

## Commands

### Validate Feeds

Validate Ansybl feed documents against the official schema:

```bash
# Validate a local file
ansybl validate feed.ansybl

# Validate a remote feed
ansybl validate https://example.com/feed.ansybl

# Validate all feeds in a directory
ansybl validate -d ./feeds --recursive

# JSON output for automation
ansybl validate feed.ansybl --json

# Strict mode (treat warnings as errors)
ansybl validate feed.ansybl --strict
```

### Generate Feeds

Create new Ansybl feed documents:

```bash
# Generate a template
ansybl generate --template -o my-feed.ansybl

# Interactive creation
ansybl generate --interactive -o my-feed.ansybl

# Generate from command line options
ansybl generate \
  --title "My Blog" \
  --home-url "https://myblog.com" \
  --feed-url "https://myblog.com/feed.ansybl" \
  --author-name "John Doe" \
  -o my-feed.ansybl

# Add item to existing feed
ansybl generate add my-feed.ansybl \
  --title "New Post" \
  --content "This is my new post content" \
  --url "https://myblog.com/posts/new-post"
```

### Fetch Feeds

Fetch and monitor remote feeds:

```bash
# Fetch a feed
ansybl fetch https://example.com/feed.ansybl

# Save to file
ansybl fetch https://example.com/feed.ansybl -o local-copy.ansybl

# Validate while fetching
ansybl fetch https://example.com/feed.ansybl --validate

# Monitor for changes
ansybl fetch https://example.com/feed.ansybl --follow --interval 60

# Show feed statistics
ansybl fetch https://example.com/feed.ansybl --stats
```

### Manage Subscriptions

Manage your feed subscriptions:

```bash
# Add subscription
ansybl subscribe add https://example.com/feed.ansybl

# List subscriptions
ansybl subscribe list

# Remove subscription
ansybl subscribe remove "Feed Title"

# Update subscription metadata
ansybl subscribe update "Feed Title" --refresh

# Export subscriptions
ansybl subscribe export -o my-subscriptions.json

# Import subscriptions
ansybl subscribe import my-subscriptions.json
```

### Convert Formats

Convert between Ansybl and other feed formats:

```bash
# Convert JSON Feed to Ansybl
ansybl convert feed.json --from json-feed --to ansybl -o feed.ansybl

# Convert Ansybl to JSON Feed
ansybl convert feed.ansybl --to json-feed -o feed.json

# Auto-detect input format
ansybl convert feed.json --to ansybl -o feed.ansybl
```

## Configuration

The CLI stores subscription data in `~/.ansybl-subscriptions.json` by default. You can specify a different location with the `--config` option:

```bash
ansybl subscribe --config ./my-subscriptions.json list
```

## Examples

### Complete Workflow

```bash
# 1. Create a new feed
ansybl generate --interactive -o my-feed.ansybl

# 2. Validate the feed
ansybl validate my-feed.ansybl

# 3. Add a new post
ansybl generate add my-feed.ansybl \
  --title "Hello World" \
  --content "This is my first post!" \
  --url "https://myblog.com/posts/hello-world"

# 4. Subscribe to someone else's feed
ansybl subscribe add https://alice.example.com/feed.ansybl

# 5. Monitor your subscriptions
ansybl subscribe list --verbose
```

### Batch Operations

```bash
# Validate all feeds in a directory
ansybl validate -d ./feeds --recursive --json > validation-results.json

# Convert multiple JSON Feeds to Ansybl
for file in *.json; do
  ansybl convert "$file" --to ansybl -o "${file%.json}.ansybl"
done
```

## Exit Codes

- `0`: Success
- `1`: Error (validation failed, command failed, etc.)

## Development

To run from source:

```bash
git clone <repository>
cd cli
npm install
node bin/ansybl.js --help
```

## License

MIT