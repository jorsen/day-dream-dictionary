// API Configuration
// Dynamically determine API URL based on current location
const API_CONFIG = (() => {
    // Check if we're running on localhost (development)
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';

    if (isLocalhost) {
        // Local development
        return {
            API_BASE_URL: 'http://localhost:5000/api/v1'
        };
    } else {
        // Production - Try multiple API endpoints with fallback
        const possibleAPIs = [
            'https://day-dream-dictionary.onrender.com/api/v1',
            'https://day-dream-dictionary-api.onrender.com/api/v1',
            'https://day-dream-dictionary.onrender.com/api'
        ];
        
        return {
            API_BASE_URL: possibleAPIs[0], // Primary API URL
            FALLBACK_URLS: possibleAPIs.slice(1) // Backup URLs
        };
    }
})();

// Export for use in HTML files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
