// API Configuration
// Dynamically determine API URL based on current location
const API_CONFIG = (() => {
    // Check if running in browser and on production domain
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        
        // Production environment (Render or custom domain)
        if (hostname.includes('onrender.com') || hostname.includes('daydreamdictionary.com')) {
            // Use the same host as the frontend so API calls are same-origin
            const protocol = window.location.protocol || 'https:';
            return {
                API_BASE_URL: `${protocol}//${hostname}/api/v1`,
                FALLBACK_URLS: ['/api/v1'] // Fallback to same-host relative URL
            };
        }
        
        // Local development
        return {
            API_BASE_URL: 'http://localhost:5000/api/v1',
            FALLBACK_URLS: ['http://localhost:5001/api/v1', 'http://localhost:5002/api/v1']
        };
    }
    
    // Node.js environment (server-side)
    return {
        API_BASE_URL: process.env.API_BASE || 'http://localhost:5000/api/v1',
        FALLBACK_URLS: []
    };
})();

// Export for use in HTML files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}