// cli/commands/fetch.js
// Feed fetching and monitoring command implementation

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const AnsyblValidator = require('../lib/validator');

const fetchCommand = new Command('fetch');

fetchCommand
  .description('Fetch and monitor Ansybl feeds')
  .argument('[url]', 'Feed URL to fetch')
  .option('-o, --output <path>', 'Save feed to file')
  .option('-f, --follow', 'Monitor feed for changes')
  .option('-i, --interval <seconds>', 'Check interval in seconds', '300')
  .option('-q, --quiet', 'Suppress output except errors')
  .option('-v, --validate', 'Validate fetched feed')
  .option('--headers', 'Show HTTP headers')
  .option('--stats', 'Show feed statistics')
  .action(async (url, options) => {
    if (!url) {
      console.error(chalk.red('Error: Feed URL is required.'));
      process.exit(1);
    }

    try {
      if (options.follow) {
        await monitorFeed(url, options);
      } else {
        await fetchFeed(url, options);
      }
    } catch (error) {
      console.error(chalk.red('Fetch failed:'), error.message);
      process.exit(1);
    }
  });

// Fetch single feed
async function fetchFeed(url, options) {
  if (!options.quiet) {
    console.log(chalk.blue(`Fetching: ${url}`));
  }

  const startTime = Date.now();
  const response = await fetch(url);
  const fetchTime = Date.now() - startTime;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Show headers if requested
  if (options.headers) {
    console.log(chalk.gray('\nResponse Headers:'));
    for (const [key, value] of response.headers.entries()) {
      console.log(chalk.gray(`  ${key}: ${value}`));
    }
    console.log();
  }

  const content = await response.text();
  
  // Parse and validate if requested
  let feedData;
  let validationResult;
  
  try {
    feedData = JSON.parse(content);
    
    if (options.validate) {
      const validator = new AnsyblValidator();
      validationResult = validator.validateFeed(feedData);
    }
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }

  // Save to file if requested
  if (options.output) {
    await fs.ensureDir(require('path').dirname(options.output));
    await fs.writeFile(options.output, content, 'utf8');
    
    if (!options.quiet) {
      console.log(chalk.green('✓ Saved to:'), options.output);
    }
  }

  // Show validation results
  if (validationResult) {
    if (validationResult.valid) {
      if (!options.quiet) {
        console.log(chalk.green('✓ Feed is valid'));
        if (validationResult.warnings.length > 0) {
          console.log(chalk.yellow(`⚠ ${validationResult.warnings.length} warning(s):`));
          validationResult.warnings.forEach(warning => {
            console.log(chalk.yellow(`  • ${warning}`));
          });
        }
      }
    } else {
      console.log(chalk.red('✗ Feed validation failed:'));
      validationResult.errors.forEach(error => {
        console.log(chalk.red(`  • ${error.path}: ${error.message}`));
      });
    }
  }

  // Show statistics
  if (options.stats && feedData) {
    showFeedStats(feedData, fetchTime);
  }

  // Output content if not saving to file and not quiet
  if (!options.output && !options.quiet) {
    console.log('\n' + chalk.gray('─'.repeat(50)));
    console.log(content);
  }
}

// Monitor feed for changes
async function monitorFeed(url, options) {
  const interval = parseInt(options.interval) * 1000;
  let lastETag = null;
  let lastModified = null;
  let lastContent = null;

  console.log(chalk.blue(`Monitoring: ${url}`));
  console.log(chalk.gray(`Check interval: ${options.interval} seconds`));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));

  while (true) {
    try {
      const headers = {};
      if (lastETag) headers['If-None-Match'] = lastETag;
      if (lastModified) headers['If-Modified-Since'] = lastModified;

      const response = await fetch(url, { headers });
      
      if (response.status === 304) {
        if (!options.quiet) {
          console.log(chalk.gray(`${new Date().toISOString()}: No changes`));
        }
      } else if (response.ok) {
        const content = await response.text();
        
        // Check if content actually changed
        if (content !== lastContent) {
          console.log(chalk.green(`${new Date().toISOString()}: Feed updated`));
          
          // Save to file if requested
          if (options.output) {
            await fs.writeFile(options.output, content, 'utf8');
            console.log(chalk.green('✓ Updated:'), options.output);
          }
          
          // Validate if requested
          if (options.validate) {
            try {
              const feedData = JSON.parse(content);
              const validator = new AnsyblValidator();
              const validationResult = validator.validateFeed(feedData);
              
              if (!validationResult.valid) {
                console.log(chalk.red('⚠ Updated feed has validation errors:'));
                validationResult.errors.forEach(error => {
                  console.log(chalk.red(`  • ${error.path}: ${error.message}`));
                });
              }
            } catch (error) {
              console.log(chalk.red('⚠ Updated feed is not valid JSON'));
            }
          }
          
          lastContent = content;
        }
        
        // Update cache headers
        lastETag = response.headers.get('etag');
        lastModified = response.headers.get('last-modified');
        
      } else {
        console.log(chalk.red(`${new Date().toISOString()}: HTTP ${response.status}`));
      }
      
    } catch (error) {
      console.log(chalk.red(`${new Date().toISOString()}: Error - ${error.message}`));
    }
    
    // Wait for next check
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

// Show feed statistics
function showFeedStats(feedData, fetchTime) {
  console.log(chalk.blue('\nFeed Statistics:'));
  console.log('─'.repeat(30));
  
  console.log(`Title: ${feedData.title || 'N/A'}`);
  console.log(`Author: ${feedData.author?.name || 'N/A'}`);
  console.log(`Items: ${feedData.items?.length || 0}`);
  console.log(`Language: ${feedData.language || 'N/A'}`);
  console.log(`Version: ${feedData.version || 'N/A'}`);
  console.log(`Signed: ${feedData.signature ? 'Yes' : 'No'}`);
  
  if (feedData.items && feedData.items.length > 0) {
    const dates = feedData.items
      .map(item => new Date(item.date_published))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => b - a);
    
    if (dates.length > 0) {
      console.log(`Latest post: ${dates[0].toLocaleDateString()}`);
      console.log(`Oldest post: ${dates[dates.length - 1].toLocaleDateString()}`);
    }
    
    // Count content types
    const contentTypes = {
      text: feedData.items.filter(item => item.content_text).length,
      html: feedData.items.filter(item => item.content_html).length,
      markdown: feedData.items.filter(item => item.content_markdown).length
    };
    
    console.log(`Content types: Text(${contentTypes.text}) HTML(${contentTypes.html}) Markdown(${contentTypes.markdown})`);
    
    // Count attachments
    const totalAttachments = feedData.items.reduce((sum, item) => 
      sum + (item.attachments?.length || 0), 0);
    console.log(`Attachments: ${totalAttachments}`);
    
    // Count signed items
    const signedItems = feedData.items.filter(item => item.signature).length;
    console.log(`Signed items: ${signedItems}/${feedData.items.length}`);
  }
  
  console.log(`Fetch time: ${fetchTime}ms`);
}

module.exports = fetchCommand;