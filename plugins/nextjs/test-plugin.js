/**
 * Test script for NextJS plugin
 */

import { NextJSPlugin } from './src/nextjs-plugin.js';
import { Analyzer } from '@spaguettiscope/core';

async function testPlugin() {
  console.log('Testing NextJS Plugin...\n');
  
  const plugin = new NextJSPlugin();
  const analyzer = new Analyzer();
  
  // Test plugin detection
  console.log('1. Testing plugin detection...');
  const testPath = '/home/ubuntu/spaguettiscope'; // Use our own project as test
  const canAnalyze = await plugin.canAnalyze(testPath);
  console.log(`Can analyze project: ${canAnalyze}\n`);
  
  if (!canAnalyze) {
    console.log('Plugin cannot analyze this project. Creating a mock NextJS structure...');
    // We'll test with our own project structure for now
  }
  
  // Test project discovery
  console.log('2. Testing project discovery...');
  try {
    const projectStructure = await plugin.discover(testPath);
    console.log('Project structure discovered:');
    console.log(`- Framework: ${projectStructure.metadata.framework}`);
    console.log(`- Version: ${projectStructure.metadata.version}`);
    console.log(`- Router type: ${projectStructure.metadata.routerType}`);
    console.log(`- Features: ${projectStructure.metadata.features.join(', ')}`);
    console.log(`- Routes found: ${projectStructure.routes.length}`);
    console.log(`- Components found: ${projectStructure.components.length}\n`);
  } catch (error) {
    console.log(`Discovery failed: ${error.message}\n`);
  }
  
  // Test file patterns
  console.log('3. Testing file patterns...');
  const filePatterns = plugin.getFilePatterns();
  const ignorePatterns = plugin.getIgnorePatterns();
  console.log(`File patterns: ${filePatterns.join(', ')}`);
  console.log(`Ignore patterns: ${ignorePatterns.join(', ')}\n`);
  
  console.log('NextJS Plugin test completed!');
}

testPlugin().catch(console.error);

