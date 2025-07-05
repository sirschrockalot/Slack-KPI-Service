const AircallSlackAgent = require('./index.js');

async function runTests() {
  try {
    console.log('🧪 Testing Aircall Slack Agent...');
    
    const agent = new AircallSlackAgent();
    
    console.log('✅ Agent initialized successfully');
    
    // Test Slack connection
    console.log('🔗 Testing Slack connection...');
    const slackValid = await agent.validateSlackConnection();
    if (!slackValid) {
      throw new Error('Slack connection validation failed');
    }
    console.log('✅ Slack connection validated');
    
    // Test afternoon report
    console.log('🌅 Testing afternoon report...');
    await agent.runAfternoonReport();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test night report
    console.log('🌙 Testing night report...');
    await agent.runNightReport();
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}