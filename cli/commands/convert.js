// cli/commands/convert.js
// Format conversion command implementation

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');

const convertCommand = new Command('convert');

convertCommand
  .description('Convert between Ansybl and other feed formats')
  .argument('<input>', 'Input file path')
  .option('-f, --from <format>', 'Input format (ansybl, rss, json-feed)', 'auto')
  .option('-t, --to <format>', 'Output format (ansybl, rss, json-feed)', 'ansybl')
  .option('-o, --output <path>', 'Output file path')
  .option('--pretty', 'Pretty-print output', true)
  .action(async (input, options) => {
    try {
      const inputContent = await fs.readFile(input, 'utf8');
      let inputData;
      let inputFormat = options.from;

      // Auto-detect input format
      if (inputFormat === 'auto') {
        inputFormat = detectFormat(inputContent, input);
      }

      // Parse input
      switch (inputFormat) {
        case 'ansybl':
          inputData = JSON.parse(inputContent);
          break;
        case 'json-feed':
          inputData = parseJsonFeed(inputContent);
          break;
        case 'rss':
          inputData = parseRssFeed(inputContent);
          break;
        default:
          throw new Error(`Unsupported input format: ${inputFormat}`);
      }

      // Convert to target format
      let outputContent;
      switch (options.to) {
        case 'ansybl':
          outputContent = convertToAnsybl(inputData, inputFormat);
          break;
        case 'json-feed':
          outputContent = convertToJsonFeed(inputData);
          break;
        case 'rss':
          outputContent = convertToRss(inputData);
          break;
        default:
          throw new Error(`Unsupported output format: ${options.to}`);
      }

      // Format output
      if (options.to === 'ansybl' || options.to === 'json-feed') {
        outputContent = options.pretty 
          ? JSON.stringify(outputContent, null, 2)
          : JSON.stringify(outputContent);
      }

      // Save or print output
      if (options.output) {
        await fs.ensureDir(require('path').dirname(options.output));
        await fs.writeFile(options.output, outputContent, 'utf8');
        console.log(chalk.green('✓ Converted:'), `${inputFormat} → ${options.to}`);
        console.log(chalk.green('✓ Saved to:'), options.output);
      } else {
        console.log(outputContent);
      }

    } catch (error) {
      console.error(chalk.red('Conversion failed:'), error.message);
      process.exit(1);
    }
  });

// Detect input format
function detectFormat(content, filename) {
  const ext = require('path').extname(filename).toLowerCase();
  
  if (ext === '.ansybl') return 'ansybl';
  if (ext === '.xml' || ext === '.rss') return 'rss';
  
  // Try to parse as JSON
  try {
    const data = JSON.parse(content);
    
    // Check for Ansybl markers
    if (data.version && data.version.includes('ansybl.org')) {
      return 'ansybl';
    }
    
    // Check for JSON Feed markers
    if (data.version && data.version.startsWith('https://jsonfeed.org/')) {
      return 'json-feed';
    }
    
    // Default to Ansybl for JSON
    return 'ansybl';
  } catch {
    // Not JSON, assume RSS/XML
    return 'rss';
  }
}

// Parse JSON Feed
function parseJsonFeed(content) {
  const data = JSON.parse(content);
  
  if (!data.version || !data.version.startsWith('https://jsonfeed.org/')) {
    throw new Error('Not a valid JSON Feed');
  }
  
  return data;
}

// Parse RSS Feed (simplified)
function parseRssFeed(content) {
  // This is a simplified RSS parser for demonstration
  // In a real implementation, you'd use a proper XML parser
  throw new Error('RSS parsing not implemented in this demo. Use a proper XML parser library.');
}

// Convert to Ansybl format
function convertToAnsybl(inputData, fromFormat) {
  switch (fromFormat) {
    case 'ansybl':
      return inputData; // Already Ansybl
      
    case 'json-feed':
      return convertJsonFeedToAnsybl(inputData);
      
    case 'rss':
      return convertRssToAnsybl(inputData);
      
    default:
      throw new Error(`Cannot convert from ${fromFormat} to Ansybl`);
  }
}

// Convert JSON Feed to Ansybl
function convertJsonFeedToAnsybl(jsonFeed) {
  const ansybl = {
    version: 'https://ansybl.org/version/1.0',
    title: jsonFeed.title,
    home_page_url: jsonFeed.home_page_url,
    feed_url: jsonFeed.feed_url,
    author: {
      name: jsonFeed.author?.name || 'Unknown',
      public_key: 'ed25519:CONVERSION_PLACEHOLDER_KEY'
    },
    items: []
  };

  // Add optional fields
  if (jsonFeed.description) ansybl.description = jsonFeed.description;
  if (jsonFeed.icon) ansybl.icon = jsonFeed.icon;
  if (jsonFeed.language) ansybl.language = jsonFeed.language;
  if (jsonFeed.author?.url) ansybl.author.url = jsonFeed.author.url;
  if (jsonFeed.author?.avatar) ansybl.author.avatar = jsonFeed.author.avatar;

  // Convert items
  if (jsonFeed.items) {
    ansybl.items = jsonFeed.items.map(item => {
      const ansyblItem = {
        id: item.id,
        url: item.url,
        date_published: item.date_published,
        signature: 'ed25519:CONVERSION_PLACEHOLDER_SIGNATURE'
      };

      // Add optional fields
      if (item.title) ansyblItem.title = item.title;
      if (item.content_text) ansyblItem.content_text = item.content_text;
      if (item.content_html) ansyblItem.content_html = item.content_html;
      if (item.summary) ansyblItem.summary = item.summary;
      if (item.date_modified) ansyblItem.date_modified = item.date_modified;
      if (item.tags) ansyblItem.tags = item.tags;

      // Convert attachments
      if (item.attachments) {
        ansyblItem.attachments = item.attachments.map(att => ({
          url: att.url,
          mime_type: att.mime_type,
          title: att.title,
          size_in_bytes: att.size_in_bytes
        }));
      }

      // Add interaction counts (default to 0)
      ansyblItem.interactions = {
        replies_count: 0,
        likes_count: 0,
        shares_count: 0
      };

      return ansyblItem;
    });
  }

  ansybl.signature = 'ed25519:CONVERSION_PLACEHOLDER_SIGNATURE';
  return ansybl;
}

// Convert to JSON Feed
function convertToJsonFeed(ansyblData) {
  const jsonFeed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: ansyblData.title,
    home_page_url: ansyblData.home_page_url,
    feed_url: ansyblData.feed_url
  };

  // Add optional fields
  if (ansyblData.description) jsonFeed.description = ansyblData.description;
  if (ansyblData.icon) jsonFeed.icon = ansyblData.icon;
  if (ansyblData.language) jsonFeed.language = ansyblData.language;

  // Convert author
  if (ansyblData.author) {
    jsonFeed.author = {
      name: ansyblData.author.name
    };
    if (ansyblData.author.url) jsonFeed.author.url = ansyblData.author.url;
    if (ansyblData.author.avatar) jsonFeed.author.avatar = ansyblData.author.avatar;
  }

  // Convert items
  if (ansyblData.items) {
    jsonFeed.items = ansyblData.items.map(item => {
      const jsonItem = {
        id: item.id,
        url: item.url,
        date_published: item.date_published
      };

      // Add optional fields
      if (item.title) jsonItem.title = item.title;
      if (item.content_text) jsonItem.content_text = item.content_text;
      if (item.content_html) jsonItem.content_html = item.content_html;
      if (item.summary) jsonItem.summary = item.summary;
      if (item.date_modified) jsonItem.date_modified = item.date_modified;
      if (item.tags) jsonItem.tags = item.tags;

      // Convert attachments
      if (item.attachments) {
        jsonItem.attachments = item.attachments.map(att => ({
          url: att.url,
          mime_type: att.mime_type,
          title: att.title,
          size_in_bytes: att.size_in_bytes
        }));
      }

      return jsonItem;
    });
  }

  return jsonFeed;
}

// Convert to RSS (simplified)
function convertToRss(ansyblData) {
  // This is a simplified RSS generator for demonstration
  const items = ansyblData.items || [];
  const itemsXml = items.map(item => `
    <item>
      <title><![CDATA[${item.title || 'Untitled'}]]></title>
      <link>${item.url}</link>
      <guid>${item.id}</guid>
      <pubDate>${new Date(item.date_published).toUTCString()}</pubDate>
      <description><![CDATA[${item.content_html || item.content_text || item.summary || ''}]]></description>
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${ansyblData.title}]]></title>
    <link>${ansyblData.home_page_url}</link>
    <description><![CDATA[${ansyblData.description || ''}]]></description>
    <language>${ansyblData.language || 'en'}</language>
    <managingEditor>${ansyblData.author?.name || ''}</managingEditor>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${itemsXml}
  </channel>
</rss>`;
}

module.exports = convertCommand;