#!/usr/bin/env node

// cli/bin/ansybl.js
// Main CLI entry point

const { Command } = require('commander');
const chalk = require('chalk');
const packageJson = require('../package.json');

// Import command modules
const validateCommand = require('../commands/validate');
const generateCommand = require('../commands/generate');
const subscribeCommand = require('../commands/subscribe');
const fetchCommand = require('../commands/fetch');
const convertCommand = require('../commands/convert');

const program = new Command();

program
  .name('ansybl')
  .description('Command-line tools for Ansybl feed management and validation')
  .version(packageJson.version);

// Add commands
program.addCommand(validateCommand);
program.addCommand(generateCommand);
program.addCommand(subscribeCommand);
program.addCommand(fetchCommand);
program.addCommand(convertCommand);

// Global error handler
program.exitOverride();

try {
  program.parse();
} catch (err) {
  if (err.code === 'commander.help' || err.code === 'commander.version') {
    process.exit(0);
  } else if (err.code === 'commander.unknownCommand') {
    console.error(chalk.red('Error:'), err.message);
    console.log('\nRun', chalk.cyan('ansybl --help'), 'to see available commands.');
    process.exit(1);
  } else {
    console.error(chalk.red('Unexpected error:'), err.message);
    process.exit(1);
  }
}