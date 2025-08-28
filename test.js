async function runTests() {
  try {
    console.log('🧪 Testing Aircall Slack Agent...');
    
    // Test if we can load all required modules
    console.log('📦 Testing module imports...');
    
    const express = require('express');
    console.log('✅ Express loaded');
    
    const ApiServer = require('./ApiServer');
    console.log('✅ ApiServer loaded');
    
    const SlackService = require('./SlackService');
    console.log('✅ SlackService loaded');
    
    const AircallService = require('./AircallService');
    console.log('✅ AircallService loaded');
    
    console.log('✅ All modules loaded successfully!');
    
    // Test basic functionality without starting server
    console.log('🔧 Testing basic functionality...');
    
    // Check if the main classes exist
    if (typeof ApiServer === 'function') {
      console.log('✅ ApiServer is a constructor');
    } else {
      throw new Error('ApiServer is not a constructor');
    }
    
    if (typeof SlackService === 'function') {
      console.log('✅ SlackService is a constructor');
    } else {
      throw new Error('SlackService is not a constructor');
    }
    
    if (typeof AircallService === 'function') {
      console.log('✅ AircallService is a constructor');
    } else {
      throw new Error('AircallService is not a constructor');
    }
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}