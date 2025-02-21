document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('api-key');
    const saveButton = document.getElementById('save-api');
    const statusDiv = document.getElementById('status');

    // Load existing custom API key if any
    const result = await chrome.storage.local.get(['GOOGLE_API_KEY', 'isCustomKey']);
    if (result.isCustomKey) {
        apiKeyInput.value = result.GOOGLE_API_KEY;
    }

    saveButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (apiKey) {
            try {
                // Test the API key with a simple request
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
                        })
                    }
                );

                if (response.ok) {
                    // Save the custom API key
                    await chrome.storage.local.set({ 
                        GOOGLE_API_KEY: apiKey,
                        isCustomKey: true 
                    });
                    showStatus('API key saved successfully!', 'success');
                } else {
                    showStatus('Invalid API key', 'error');
                }
            } catch (error) {
                showStatus('Error validating API key', 'error');
            }
        } else {
            // Revert to default API key
            const defaultKey = await getDefaultApiKey();
            await chrome.storage.local.set({ 
                GOOGLE_API_KEY: defaultKey,
                isCustomKey: false 
            });
            apiKeyInput.value = '';
            showStatus('Reverted to default API key', 'success');
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }, 3000);
    }

    async function getDefaultApiKey() {
        // Get the default key from background script
        const result = await chrome.storage.local.get('defaultApiKey');
        return result.defaultApiKey;
    }
}); 