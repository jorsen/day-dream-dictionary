// API Configuration
// Dynamically determine API URL based on current location
// Rollback to original implementation without MongoDB
const API_CONFIG = (() => {
    // For rollback to mock servers - always use localhost mock server
    return {
        API_BASE_URL: 'http://localhost:5001/api/v1',
        FALLBACK_URLS: ['http://localhost:5002/api/v1', 'http://localhost:5003/api/v1']
    };
})();

// Export for use in HTML files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
