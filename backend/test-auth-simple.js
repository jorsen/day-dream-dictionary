const jwt = require('jsonwebtoken');

const payload = {
  userId: 'test-user-id',
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';

try {
  const token = jwt.sign(payload, secret);
  console.log('Generated token:', token);

  const decoded = jwt.verify(token, secret);
  console.log('Decoded token:', decoded);
  console.log('User ID from token:', decoded.userId);
} catch (error) {
  console.error('Token error:', error.message);
}
