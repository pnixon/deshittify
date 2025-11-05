// cli/commands/subscribe.js
// Subscription management command implementation

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const subscribeCommand = new Command('subscribe');

subscribeCommand
  .description('Manage feed subscriptions')
  .option('-c, --config <path>', 'Config file path', path.join(os.homedir(), '.ansybl-subscriptions.json'))
  .addCommand(createAddCommand())
  .addCommand(createListCommand())
  .addCommand(createRemoveCommand())
  .addCommand(createUpdateCommand())
  .addCommand(createExportCommand())
  .addCommand(createImportCommand());

// Subscription manager class
class SubscriptionManager {
  constructor(configPath) {
    this.configPath = configPath;
  }

  async loadSubscriptions() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const content = await fs.readFile(this.configPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not load subscriptions file'));
    }
    
    return {
      version: '1.0',
      subscriptions: []
    };
  }

  async saveSubscriptions(data) {
    await fs.ensureDir(path.dirname(this.configPath));
    await fs.writeFile(this.configPath, JSON.stringify(data, null, 2), 'utf8');
  }

  async addSubscription(url, title = null) {
    const data = await this.loadSubscriptions();
    
    // Check if already exists
    const existing = data.subscriptions.find(sub => sub.url === url);
    if (existing) {
      throw new Error('Already subscribed to this feed');
    }

    // Fetch feed to get metadata
    const fetch = require('node-fetch');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }

    const feedContent = await response.text();
    let feedData;
    
    try {
      feedData = JSON.parse(feedContent);
    } catch (error) {
      throw new Error('Feed is not valid JSON');
    }

    const subscription = {
      id: Date.now().toString(),
      url: url,
      title: title || feedData.title || 'Untitled Feed',
      author: feedData.author?.name || 'Unknown',
      description: feedData.description || '',
      dateAdded: new Date().toISOString(),
      lastFetched: new Date().toISOString(),
      itemCount: feedData.items?.length || 0,
      tags: []
    };

    data.subscriptions.push(subscription);
    await this.saveSubscriptions(data);
    
    return subscription;
  }

  async removeSubscription(identifier) {
    const data = await this.loadSubscriptions();
    const index = data.subscriptions.findIndex(sub => 
      sub.id === identifier || sub.url === identifier || sub.title === identifier
    );
    
    if (index === -1) {
      throw new Error('Subscription not found');
    }

    const removed = data.subscriptions.splice(index, 1)[0];
    await this.saveSubscriptions(data);
    
    return removed;
  }

  async updateSubscription(identifier, updates) {
    const data = await this.loadSubscriptions();
    const subscription = data.subscriptions.find(sub => 
      sub.id === identifier || sub.url === identifier || sub.title === identifier
    );
    
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    Object.assign(subscription, updates);
    await this.saveSubscriptions(data);
    
    return subscription;
  }
}

// Add subscription command
function createAddCommand() {
  const addCmd = new Command('add');
  
  addCmd
    .description('Add new feed subscription')
    .argument('<url>', 'Feed URL to subscribe to')
    .option('-t, --title <title>', 'Custom title for the feed')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (url, options, command) => {
      try {
        const manager = new SubscriptionManager(command.parent.opts().config);
        
        console.log(chalk.blue(`Adding subscription: ${url}`));
        
        const subscription = await manager.addSubscription(url, options.title);
        
        // Add tags if provided
        if (options.tags) {
          const tags = options.tags.split(',').map(tag => tag.trim());
          await manager.updateSubscription(subscription.id, { tags });
          subscription.tags = tags;
        }
        
        console.log(chalk.green('✓ Subscription added:'));
        console.log(`  ID: ${subscription.id}`);
        console.log(`  Title: ${subscription.title}`);
        console.log(`  Author: ${subscription.author}`);
        console.log(`  Items: ${subscription.itemCount}`);
        if (subscription.tags.length > 0) {
          console.log(`  Tags: ${subscription.tags.join(', ')}`);
        }
        
      } catch (error) {
        console.error(chalk.red('Failed to add subscription:'), error.message);
        process.exit(1);
      }
    });
  
  return addCmd;
}

// List subscriptions command
function createListCommand() {
  const listCmd = new Command('list');
  
  listCmd
    .description('List all subscriptions')
    .option('-v, --verbose', 'Show detailed information')
    .option('--tag <tag>', 'Filter by tag')
    .option('--json', 'Output as JSON')
    .action(async (options, command) => {
      try {
        const manager = new SubscriptionManager(command.parent.opts().config);
        const data = await manager.loadSubscriptions();
        
        let subscriptions = data.subscriptions;
        
        // Filter by tag if specified
        if (options.tag) {
          subscriptions = subscriptions.filter(sub => 
            sub.tags && sub.tags.includes(options.tag)
          );
        }
        
        if (options.json) {
          console.log(JSON.stringify(subscriptions, null, 2));
          return;
        }
        
        if (subscriptions.length === 0) {
          console.log(chalk.gray('No subscriptions found.'));
          return;
        }
        
        console.log(chalk.blue(`Found ${subscriptions.length} subscription(s):\n`));
        
        subscriptions.forEach((sub, index) => {
          console.log(`${index + 1}. ${chalk.bold(sub.title)}`);
          console.log(`   URL: ${sub.url}`);
          console.log(`   Author: ${sub.author}`);
          console.log(`   Items: ${sub.itemCount}`);
          console.log(`   Added: ${new Date(sub.dateAdded).toLocaleDateString()}`);
          
          if (options.verbose) {
            console.log(`   ID: ${sub.id}`);
            if (sub.description) {
              console.log(`   Description: ${sub.description}`);
            }
            if (sub.tags && sub.tags.length > 0) {
              console.log(`   Tags: ${sub.tags.join(', ')}`);
            }
            console.log(`   Last fetched: ${new Date(sub.lastFetched).toLocaleString()}`);
          }
          
          console.log();
        });
        
      } catch (error) {
        console.error(chalk.red('Failed to list subscriptions:'), error.message);
        process.exit(1);
      }
    });
  
  return listCmd;
}

// Remove subscription command
function createRemoveCommand() {
  const removeCmd = new Command('remove');
  
  removeCmd
    .description('Remove subscription')
    .argument('<identifier>', 'Subscription ID, URL, or title')
    .action(async (identifier, options, command) => {
      try {
        const manager = new SubscriptionManager(command.parent.opts().config);
        
        const removed = await manager.removeSubscription(identifier);
        
        console.log(chalk.green('✓ Subscription removed:'));
        console.log(`  Title: ${removed.title}`);
        console.log(`  URL: ${removed.url}`);
        
      } catch (error) {
        console.error(chalk.red('Failed to remove subscription:'), error.message);
        process.exit(1);
      }
    });
  
  return removeCmd;
}

// Update subscription command
function createUpdateCommand() {
  const updateCmd = new Command('update');
  
  updateCmd
    .description('Update subscription metadata')
    .argument('<identifier>', 'Subscription ID, URL, or title')
    .option('--title <title>', 'Update title')
    .option('--tags <tags>', 'Update tags (comma-separated)')
    .option('--refresh', 'Refresh metadata from feed')
    .action(async (identifier, options, command) => {
      try {
        const manager = new SubscriptionManager(command.parent.opts().config);
        const updates = {};
        
        if (options.title) {
          updates.title = options.title;
        }
        
        if (options.tags) {
          updates.tags = options.tags.split(',').map(tag => tag.trim());
        }
        
        if (options.refresh) {
          // Fetch latest feed data
          const data = await manager.loadSubscriptions();
          const subscription = data.subscriptions.find(sub => 
            sub.id === identifier || sub.url === identifier || sub.title === identifier
          );
          
          if (!subscription) {
            throw new Error('Subscription not found');
          }
          
          const fetch = require('node-fetch');
          const response = await fetch(subscription.url);
          
          if (response.ok) {
            const feedContent = await response.text();
            const feedData = JSON.parse(feedContent);
            
            updates.title = updates.title || feedData.title;
            updates.author = feedData.author?.name || subscription.author;
            updates.description = feedData.description || '';
            updates.itemCount = feedData.items?.length || 0;
            updates.lastFetched = new Date().toISOString();
          }
        }
        
        const updated = await manager.updateSubscription(identifier, updates);
        
        console.log(chalk.green('✓ Subscription updated:'));
        console.log(`  Title: ${updated.title}`);
        console.log(`  Author: ${updated.author}`);
        console.log(`  Items: ${updated.itemCount}`);
        if (updated.tags && updated.tags.length > 0) {
          console.log(`  Tags: ${updated.tags.join(', ')}`);
        }
        
      } catch (error) {
        console.error(chalk.red('Failed to update subscription:'), error.message);
        process.exit(1);
      }
    });
  
  return updateCmd;
}

// Export subscriptions command
function createExportCommand() {
  const exportCmd = new Command('export');
  
  exportCmd
    .description('Export subscriptions to file')
    .option('-o, --output <path>', 'Output file path', 'ansybl-subscriptions-export.json')
    .action(async (options, command) => {
      try {
        const manager = new SubscriptionManager(command.parent.opts().config);
        const data = await manager.loadSubscriptions();
        
        const exportData = {
          version: '1.0',
          exported: new Date().toISOString(),
          subscriptions: data.subscriptions.map(sub => ({
            url: sub.url,
            title: sub.title,
            tags: sub.tags,
            dateAdded: sub.dateAdded
          }))
        };
        
        await fs.writeFile(options.output, JSON.stringify(exportData, null, 2), 'utf8');
        
        console.log(chalk.green('✓ Subscriptions exported:'), options.output);
        console.log(`  ${exportData.subscriptions.length} subscription(s) exported`);
        
      } catch (error) {
        console.error(chalk.red('Failed to export subscriptions:'), error.message);
        process.exit(1);
      }
    });
  
  return exportCmd;
}

// Import subscriptions command
function createImportCommand() {
  const importCmd = new Command('import');
  
  importCmd
    .description('Import subscriptions from file')
    .argument('<file>', 'Import file path')
    .option('--merge', 'Merge with existing subscriptions (default: replace)')
    .action(async (file, options, command) => {
      try {
        const manager = new SubscriptionManager(command.parent.opts().config);
        
        const importContent = await fs.readFile(file, 'utf8');
        const importData = JSON.parse(importContent);
        
        if (!importData.subscriptions || !Array.isArray(importData.subscriptions)) {
          throw new Error('Invalid import file format');
        }
        
        let data;
        if (options.merge) {
          data = await manager.loadSubscriptions();
        } else {
          data = { version: '1.0', subscriptions: [] };
        }
        
        let imported = 0;
        let skipped = 0;
        
        for (const importSub of importData.subscriptions) {
          if (!importSub.url) continue;
          
          // Check if already exists
          const existing = data.subscriptions.find(sub => sub.url === importSub.url);
          if (existing) {
            skipped++;
            continue;
          }
          
          try {
            const subscription = await manager.addSubscription(importSub.url, importSub.title);
            
            if (importSub.tags) {
              await manager.updateSubscription(subscription.id, { tags: importSub.tags });
            }
            
            imported++;
          } catch (error) {
            console.warn(chalk.yellow(`Warning: Failed to import ${importSub.url}: ${error.message}`));
            skipped++;
          }
        }
        
        console.log(chalk.green('✓ Import completed:'));
        console.log(`  Imported: ${imported}`);
        console.log(`  Skipped: ${skipped}`);
        
      } catch (error) {
        console.error(chalk.red('Failed to import subscriptions:'), error.message);
        process.exit(1);
      }
    });
  
  return importCmd;
}

module.exports = subscribeCommand;