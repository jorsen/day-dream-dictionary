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
        // Production - Frontend and backend are on the same Render service
        return {
            API_BASE_URL: 'https://day-dream-dictionary.onrender.com/api/v1'
        };
    }
})();

// Export for use in HTML files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
