const axios = require('axios');

// Test configuration
const AIRCALL_API_ID = 'test_api_id';
const AIRCALL_API_TOKEN = 'test_api_token';

// Create axios client with basic auth
const aircallClient = axios.create({
  baseURL: 'https://api.aircall.io/v1',
  auth: {
    username: AIRCALL_API_ID,
    password: AIRCALL_API_TOKEN
  },
  timeout: 10000
});

async function testUserCalls() {
  try {
    console.log('Testing Aircall API user filtering...');
    
    // First, get all users
    console.log('\n1. Fetching all users...');
    const usersResponse = await aircallClient.get('/users');
    const users = usersResponse.data.users || [];
    console.log(`Found ${users.length} users`);
    
    if (users.length === 0) {
      console.log('No users found. API credentials may be invalid.');
      return;
    }
    
    // Test with first two users
    const testUsers = users.slice(0, 2);
    
    // Set time range for today
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startTimestamp = Math.floor(startTime.getTime() / 1000);
    const endTimestamp = Math.floor(endTime.getTime() / 1000);
    
    console.log(`\n2. Testing calls from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    
    for (const user of testUsers) {
      console.log(`\n--- Testing user: ${user.name} (ID: ${user.id}) ---`);
      
      try {
        const response = await aircallClient.get('/calls', {
          params: {
            user_id: user.id,
            from: startTimestamp,
            to: endTimestamp,
            per_page: 10,
            page: 1
          }
        });
        
        const calls = response.data.calls || [];
        console.log(`API returned ${calls.length} calls for user ${user.name}`);
        
        if (calls.length > 0) {
          console.log('First call details:');
          console.log(`  - Call ID: ${calls[0].id}`);
          console.log(`  - Direction: ${calls[0].direction}`);
          console.log(`  - User ID in call: ${calls[0].user?.id}`);
          console.log(`  - Expected user ID: ${user.id}`);
          console.log(`  - Match: ${calls[0].user?.id === user.id ? 'YES' : 'NO'}`);
        }
        
      } catch (error) {
        console.error(`Error fetching calls for user ${user.name}:`, error.response?.data || error.message);
      }
    }
    
  } catch (error) {
    console.error('Error testing Aircall API:', error.response?.data || error.message);
  }
}

// Run the test
testUserCalls(); 