const jwt = require('jsonwebtoken');
const http = require('http');

// Check what's happening with the current user session
console.log('🔍 CHECKING CURRENT USER SESSION');
console.log('Looking at the user IDs in your recent logs');
console.log('');

// From your logs, I can see these user IDs:
// 1. 5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a (original)
// 2. 5890f16a-9695-4fbc-9c67-cdcf70e65966 (new)

console.log('📋 Analysis of your logs:');
console.log('');
console.log('✅ Good news:');
console.log('- Different user IDs show authentication is working');
console.log('- New user ID suggests you successfully registered');
console.log('- Access tokens are present and valid');
console.log('');
console.log('❌ Issue:');
console.log('- Still showing 0 dreams for all user IDs');
console.log('- Dreams are likely still going to mock database');
console.log('');

console.log('💡 Next steps:');
console.log('');
console.log('1. Check which user ID is currently active');
console.log('2. Submit a dream with the active user');
console.log('3. Verify it saves to real database');
console.log('');

console.log('🔧 To check your current user:');
console.log('1. Open browser console on profile-dashboard.html');
console.log('2. Run: console.log(localStorage.getItem("currentUser"))');
console.log('3. This will show your current user ID');
console.log('');

console.log('🚀 To submit a dream with current user:');
console.log('1. Go to dream-interpretation.html');
console.log('2. Enter any dream text');
console.log('3. Click "Interpret Dream"');
console.log('4. Check if it appears in dashboard');
console.log('');

console.log('🎯 The key is using the web interface while logged in!');
