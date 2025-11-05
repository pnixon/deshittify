// cli/commands/validate.js
// Validation command implementation

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const AnsyblValidator = require('../lib/validator');

const validateCommand = new Command('validate');

validateCommand
  .description('Validate Ansybl feed documents')
  .argument('[input]', 'Feed file path or URL to validate')
  .option('-f, --file <path>', 'Validate feed from file')
  .option('-u, --url <url>', 'Validate feed from URL')
  .option('-d, --directory <path>', 'Validate all .ansybl and .json files in directory')
  .option('-r, --recursive', 'Recursively validate files in subdirectories')
  .option('-q, --quiet', 'Only show errors, suppress warnings')
  .option('-j, --json', 'Output results in JSON format')
  .option('--strict', 'Treat warnings as errors')
  .action(async (input, options) => {
    const validator = new AnsyblValidator();
    const results = [];

    try {
      // Determine validation targets
      const targets = [];
      
      if (input) {
        if (input.startsWith('http://') || input.startsWith('https://')) {
          targets.push({ type: 'url', path: input });
        } else {
          targets.push({ type: 'file', path: input });
        }
      }
      
      if (options.file) {
        targets.push({ type: 'file', path: options.file });
      }
      
      if (options.url) {
        targets.push({ type: 'url', path: options.url });
      }
      
      if (options.directory) {
        const files = await findFeedFiles(options.directory, options.recursive);
        files.forEach(file => targets.push({ type: 'file', path: file }));
      }

      if (targets.length === 0) {
        console.error(chalk.red('Error: No input specified.'));
        console.log('Use --help to see available options.');
        process.exit(1);
      }

      // Validate each target
      for (const target of targets) {
        let result;
        
        if (target.type === 'file') {
          result = await validator.validateFile(target.path);
        } else {
          result = await validator.validateUrl(target.path);
        }
        
        result.target = target;
        results.push(result);
      }

      // Output results
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        displayResults(results, options);
      }

      // Exit with appropriate code
      const hasErrors = results.some(r => !r.valid);
      const hasWarnings = results.some(r => r.warnings.length > 0);
      
      if (hasErrors || (options.strict && hasWarnings)) {
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('Validation failed:'), error.message);
      process.exit(1);
    }
  });

// Find feed files in directory
async function findFeedFiles(directory, recursive = false) {
  const files = [];
  
  async function scanDirectory(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = require('path').join(dir, entry.name);
      
      if (entry.isDirectory() && recursive) {
        await scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = require('path').extname(entry.name).toLowerCase();
        if (ext === '.ansybl' || ext === '.json') {
          files.push(fullPath);
        }
      }
    }
  }
  
  await scanDirectory(directory);
  return files;
}

// Display validation results
function displayResults(results, options) {
  let totalValid = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const result of results) {
    const { target, valid, errors, warnings } = result;
    
    // Header
    console.log('\n' + chalk.bold(`Validating: ${target.path}`));
    console.log('─'.repeat(50));
    
    if (valid && warnings.length === 0) {
      console.log(chalk.green('✓ Valid Ansybl feed'));
      totalValid++;
    } else {
      // Show errors
      if (errors.length > 0) {
        console.log(chalk.red(`✗ ${errors.length} error(s) found:`));
        errors.forEach((error, index) => {
          console.log(chalk.red(`  ${index + 1}. ${error.path}: ${error.message}`));
          if (error.value !== undefined) {
            console.log(chalk.gray(`     Value: ${JSON.stringify(error.value)}`));
          }
        });
        totalErrors += errors.length;
      }
      
      // Show warnings (unless quiet mode)
      if (warnings.length > 0 && !options.quiet) {
        console.log(chalk.yellow(`⚠ ${warnings.length} warning(s):`));
        warnings.forEach((warning, index) => {
          console.log(chalk.yellow(`  ${index + 1}. ${warning}`));
        });
        totalWarnings += warnings.length;
      }
      
      if (valid) {
        console.log(chalk.green('✓ Valid with warnings'));
        totalValid++;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(chalk.bold('Validation Summary:'));
  console.log(`Files processed: ${results.length}`);
  console.log(`Valid: ${chalk.green(totalValid)}`);
  console.log(`Errors: ${chalk.red(totalErrors)}`);
  
  if (!options.quiet) {
    console.log(`Warnings: ${chalk.yellow(totalWarnings)}`);
  }
}

module.exports = validateCommand;