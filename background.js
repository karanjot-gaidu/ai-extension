const DEFAULT_API_KEY = config.GOOGLE_API_KEY;

// Store the default API key
chrome.storage.local.set({ 
    defaultApiKey: DEFAULT_API_KEY,
    GOOGLE_API_KEY: DEFAULT_API_KEY,
    isCustomKey: false 
});
