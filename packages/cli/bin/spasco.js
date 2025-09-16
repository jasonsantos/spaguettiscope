#!/usr/bin/env node

/**
 * SpaguettiScope CLI Executable
 * Beautiful command-line interface for code entropy analysis
 */

import { CLI } from '../src/cli.js';

// Create and run CLI
const cli = new CLI();
cli.run().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

