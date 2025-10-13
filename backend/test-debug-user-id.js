const jwt = require('jsonwebtoken');

// Test the user ID format issue
const userId = '5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a';
console.log('🔍 User ID:', userId);
console.log('Type:', typeof userId);
console.log('Is UUID format:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId));

// Test JWT token creation and decoding
const payload = {
  userId: userId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);
console.log('🔑 Token created successfully');

// Decode the token to verify
const decoded = jwt.verify(token, secret);
console.log('🔓 Decoded userId:', decoded.userId);
console.log('Decoded type:', typeof decoded.userId);

console.log('');
console.log('💡 Analysis:');
console.log('- User ID is a valid UUID format');
console.log('- JWT encoding/decoding works correctly');
console.log('- The issue is likely that no dreams exist for this user ID in the database');
console.log('- The user needs to submit their first dream to see data');
