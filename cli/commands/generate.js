// cli/commands/generate.js
// Feed generation command implementation

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const AnsyblGenerator = require('../lib/generator');

const generateCommand = new Command('generate');

generateCommand
  .description('Generate Ansybl feed documents')
  .option('-t, --template', 'Generate a template feed file')
  .option('-o, --output <path>', 'Output file path', 'feed.ansybl')
  .option('-i, --interactive', 'Interactive feed creation')
  .option('--title <title>', 'Feed title')
  .option('--home-url <url>', 'Home page URL')
  .option('--feed-url <url>', 'Feed URL')
  .option('--description <desc>', 'Feed description')
  .option('--author-name <name>', 'Author name')
  .option('--author-url <url>', 'Author URL')
  .option('--author-key <key>', 'Author public key')
  .option('--pretty', 'Pretty-print JSON output', true)
  .option('--backup', 'Create backup of existing file')
  .action(async (options) => {
    const generator = new AnsyblGenerator();

    try {
      if (options.template) {
        await generateTemplate(generator, options);
      } else if (options.interactive) {
        await generateInteractive(generator, options);
      } else {
        await generateFromOptions(generator, options);
      }
    } catch (error) {
      console.error(chalk.red('Generation failed:'), error.message);
      process.exit(1);
    }
  });

// Generate template
async function generateTemplate(generator, options) {
  console.log(chalk.blue('Generating Ansybl feed template...'));
  
  const template = generator.generateTemplate();
  await generator.saveFeed(template, options.output, {
    pretty: options.pretty,
    backup: options.backup
  });
  
  console.log(chalk.green('✓ Template generated:'), options.output);
  console.log('\nNext steps:');
  console.log('1. Edit the template file with your information');
  console.log('2. Replace placeholder signatures with real cryptographic signatures');
  console.log('3. Validate with:', chalk.cyan(`ansybl validate ${options.output}`));
}

// Interactive generation
async function generateInteractive(generator, options) {
  console.log(chalk.blue('Interactive Ansybl feed creation\n'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Feed title:',
      validate: input => input.trim() ? true : 'Title is required'
    },
    {
      type: 'input',
      name: 'homeUrl',
      message: 'Home page URL:',
      validate: input => {
        try {
          new URL(input);
          return input.startsWith('https://') ? true : 'URL must use HTTPS';
        } catch {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'feedUrl',
      message: 'Feed URL:',
      validate: input => {
        try {
          new URL(input);
          return input.startsWith('https://') ? true : 'URL must use HTTPS';
        } catch {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Feed description (optional):'
    },
    {
      type: 'input',
      name: 'authorName',
      message: 'Author name:',
      validate: input => input.trim() ? true : 'Author name is required'
    },
    {
      type: 'input',
      name: 'authorUrl',
      message: 'Author URL (optional):',
      validate: input => {
        if (!input.trim()) return true;
        try {
          new URL(input);
          return input.startsWith('https://') ? true : 'URL must use HTTPS';
        } catch {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'authorKey',
      message: 'Author public key (ed25519:...):',
      default: 'ed25519:REPLACE_WITH_YOUR_PUBLIC_KEY',
      validate: input => {
        if (input.startsWith('ed25519:')) return true;
        return 'Public key must start with "ed25519:"';
      }
    },
    {
      type: 'confirm',
      name: 'addSamplePost',
      message: 'Add a sample post?',
      default: true
    }
  ]);

  // Create feed
  const feed = generator.createFeed({
    title: answers.title,
    homePageUrl: answers.homeUrl,
    feedUrl: answers.feedUrl,
    description: answers.description || undefined,
    author: {
      name: answers.authorName,
      url: answers.authorUrl || undefined,
      public_key: answers.authorKey
    }
  });

  // Add sample post if requested
  if (answers.addSamplePost) {
    const postAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Post title:',
        default: 'Welcome to my Ansybl feed'
      },
      {
        type: 'editor',
        name: 'content',
        message: 'Post content (opens editor):',
        default: 'This is my first post using the Ansybl protocol!'
      }
    ]);

    generator.addItem(feed, {
      id: `${answers.feedUrl.replace(/\/$/, '')}/posts/${Date.now()}`,
      url: `${answers.homeUrl.replace(/\/$/, '')}/posts/${Date.now()}`,
      title: postAnswers.title,
      contentText: postAnswers.content,
      datePublished: new Date().toISOString()
    });
  }

  // Save feed
  await generator.saveFeed(feed, options.output, {
    pretty: options.pretty,
    backup: options.backup
  });

  console.log(chalk.green('\n✓ Feed generated:'), options.output);
  console.log('\nNext steps:');
  console.log('1. Replace placeholder signatures with real cryptographic signatures');
  console.log('2. Validate with:', chalk.cyan(`ansybl validate ${options.output}`));
}

// Generate from command line options
async function generateFromOptions(generator, options) {
  // Check required options
  if (!options.title || !options.homeUrl || !options.feedUrl || !options.authorName) {
    console.error(chalk.red('Error: Missing required options.'));
    console.log('Required: --title, --home-url, --feed-url, --author-name');
    console.log('Use --interactive for guided creation or --template for a template.');
    process.exit(1);
  }

  console.log(chalk.blue('Generating Ansybl feed from options...'));

  const feed = generator.createFeed({
    title: options.title,
    homePageUrl: options.homeUrl,
    feedUrl: options.feedUrl,
    description: options.description,
    author: {
      name: options.authorName,
      url: options.authorUrl,
      public_key: options.authorKey || 'ed25519:REPLACE_WITH_YOUR_PUBLIC_KEY'
    }
  });

  await generator.saveFeed(feed, options.output, {
    pretty: options.pretty,
    backup: options.backup
  });

  console.log(chalk.green('✓ Feed generated:'), options.output);
}

// Add subcommands
const addCommand = new Command('add');
addCommand
  .description('Add item to existing feed')
  .argument('<feed-file>', 'Feed file to modify')
  .option('--title <title>', 'Item title')
  .option('--content <content>', 'Item content (text)')
  .option('--content-file <path>', 'Read content from file')
  .option('--url <url>', 'Item URL')
  .option('--id <id>', 'Item ID (defaults to URL)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--summary <summary>', 'Item summary')
  .action(async (feedFile, options) => {
    try {
      const generator = new AnsyblGenerator();
      
      // Load existing feed
      const feedContent = await fs.readFile(feedFile, 'utf8');
      const feed = JSON.parse(feedContent);
      
      // Read content
      let content = options.content;
      if (options.contentFile) {
        content = await fs.readFile(options.contentFile, 'utf8');
      }
      
      if (!content) {
        console.error(chalk.red('Error: No content specified. Use --content or --content-file.'));
        process.exit(1);
      }
      
      // Generate item data
      const itemData = {
        id: options.id || options.url || `${feed.feed_url}/items/${Date.now()}`,
        url: options.url || `${feed.home_page_url}/posts/${Date.now()}`,
        title: options.title,
        contentText: content,
        summary: options.summary,
        datePublished: new Date().toISOString(),
        tags: options.tags ? options.tags.split(',').map(t => t.trim()) : undefined
      };
      
      // Add item
      generator.addItem(feed, itemData);
      
      // Save feed
      await generator.saveFeed(feed, feedFile, { backup: true });
      
      console.log(chalk.green('✓ Item added to feed:'), feedFile);
      
    } catch (error) {
      console.error(chalk.red('Failed to add item:'), error.message);
      process.exit(1);
    }
  });

generateCommand.addCommand(addCommand);

module.exports = generateCommand;