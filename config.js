// API Configuration
// Update this URL to match your deployed backend
const API_CONFIG = {
    // For local development
    // API_BASE_URL: 'http://localhost:5000/api/v1'
    
    // For production - Update this with your actual Render backend URL
    API_BASE_URL: 'https://day-dream-dictionary-api.onrender.com/api/v1'
};

// Export for use in HTML files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}