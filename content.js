// Track the active textarea
let activeTextArea = null;
let activeSpan = null;
let remainingText = "";

// Listen for focus events on text areas
document.addEventListener("focusin", (event) => {
    if (event.target.tagName.toLowerCase() === "textarea") {
        activeTextArea = event.target;
    }
});

// Retrieve the API key from Chrome storage
let GOOGLE_API_KEY = null;
chrome.storage.local.get("GOOGLE_API_KEY", (result) => {
    GOOGLE_API_KEY = result.GOOGLE_API_KEY;
});

// Initialize chat history with a persistent system instruction
const chat = {
    history: [
        {
            role: "user",
            parts: [
                {
                    text: "System prompt: You are an AI that completes user-written text. You do not modify or repeat existing text—only generate what comes next. You are a helpful assistant that completes text based on the user's input."
                }
            ]
        },
        {
            role: "model",
            parts: [{ text: "Understood." }]
        },
        {
            role: "user",
            parts: [{ text: "Hello, h" }]
        },
        {
            role: "model",
            parts: [{ text: "ow are you?" }]
        },
        {
            role: "user",
            parts: [{ text: "I am good," }]
        },
        {
            role: "model",
            parts: [{ text: " thanks for asking." }]
        }
    ]
};

// Function to generate text using Gemini API
async function generateText(existingText) {
    if (!GOOGLE_API_KEY) {
        console.error("API Key is missing.");
        return "";
    }

    // Add user input to chat history
    chat.history.push({
        role: "user",
        parts: [{ text: existingText }]
    });

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chat.history, generationConfig: {maxOutputTokens: 15}})
        }
    );

    if (!response.ok) {
        throw new Error("Network response was not ok");
    }

    const data = await response.json();
    const generatedText = data.candidates[0]?.content?.parts[0]?.text.trim() || "";

    // Store model response in history
    chat.history.push({
        role: "model",
        parts: [{ text: generatedText }]
    });

    return generatedText;
}

// Function to insert an overlay span with predicted text
function insertSpan(text) {
    if (!activeTextArea) return;

    remainingText = text;
    if (activeSpan) {
        activeSpan.remove();
    }

    activeSpan = document.createElement("span");
    activeSpan.textContent = remainingText;
    
    // Copy textarea's computed style
    const textareaStyle = window.getComputedStyle(activeTextArea);
    
    activeSpan.style.cssText = `
        position: absolute;
        pointer-events: none;
        color: gray;
        font-size: ${textareaStyle.fontSize};
        font-family: ${textareaStyle.fontFamily};
        line-height: ${textareaStyle.lineHeight};
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        max-width: ${activeTextArea.clientWidth - 
            (parseInt(textareaStyle.paddingLeft) + 
             parseInt(textareaStyle.paddingRight))}px;
    `;

    document.body.appendChild(activeSpan);
    updateSpanPosition();
}

// Function to update the span position
function updateSpanPosition() {
    if (!activeTextArea || !activeSpan) return;
    const { top, left } = getCursorPosition(activeTextArea);
    activeSpan.style.left = `${left + 1}px`;
    activeSpan.style.top = `${top + 1}px`;
}

// Function to get cursor position inside a textarea
function getCursorPosition(textarea) {
    // Create a mirror div to measure text
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(textarea);

    // Copy the textarea's style to the mirror
    mirror.style.cssText = `
        position: absolute;
        visibility: hidden;
        height: auto;
        width: ${textarea.clientWidth}px;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        font: ${style.font};
        line-height: ${style.lineHeight};
        padding: 0;  // Reset padding
        border: none;
        margin: 0;
    `;

    // Create a span for the text before cursor
    const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
    mirror.textContent = textBeforeCursor;
    
    // Create a span to mark cursor position
    const cursorSpan = document.createElement('span');
    cursorSpan.textContent = '|';
    mirror.appendChild(cursorSpan);

    // Add mirror to document temporarily
    document.body.appendChild(mirror);

    // Get positions and measurements
    const textareaRect = textarea.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    const cursorRect = cursorSpan.getBoundingClientRect();
    
    // Get textarea's padding
    const paddingTop = parseInt(style.paddingTop, 10) || 0;
    const paddingLeft = parseInt(style.paddingLeft, 10) || 0;

    // Clean up
    document.body.removeChild(mirror);

    // Calculate final position
    return {
        top: textareaRect.top + window.scrollY + paddingTop + (cursorRect.top - mirrorRect.top),
        left: textareaRect.left + window.scrollX + paddingLeft + (cursorRect.left - mirrorRect.left)
    };
}

// Add debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Modify the handleTyping function to include automatic suggestions
function handleTyping(event) {
    if (!activeTextArea) return;

    // Handle existing span text matching
    if (activeSpan && remainingText.length > 0) {
        const typedChar = event.data;
        if (typedChar && !remainingText.startsWith(typedChar)) {
            activeSpan.remove();
            activeSpan = null;
            remainingText = "";
        } else if (typedChar && remainingText.startsWith(typedChar)) {
            remainingText = remainingText.substring(1);
            activeSpan.textContent = remainingText;
            if (remainingText.length === 0) {
                activeSpan.remove();
                activeSpan = null;
            }
        }
        updateSpanPosition();
        return;
    }

    // If no span exists and we have text, trigger suggestion
    if (!activeSpan && activeTextArea.value.trim().length > 0) {
        debouncedGenerateSuggestion();
    }
}

// Create debounced version of suggestion generator
const debouncedGenerateSuggestion = debounce(async () => {
    if (!activeTextArea || activeSpan) return;
    
    const existingText = activeTextArea.value;
    try {
        const generatedText = await generateText(existingText);
        if (generatedText) {
            insertSpan(generatedText);
        }
    } catch (error) {
        console.error("Error generating text:", error);
    }
}, 1000); // 1 second debounce

// Replace the keydown event listener with a simpler one just for Tab
document.addEventListener("keydown", (event) => {
    if (activeTextArea && event.key === "Tab") {
        event.preventDefault();
        mergeSpanIntoTextarea();
    }
});

function mergeSpanIntoTextarea() {
    if (!activeTextArea || !activeSpan) return;
    const start = activeTextArea.selectionStart;
    activeTextArea.value =
        activeTextArea.value.substring(0, start) + remainingText + activeTextArea.value.substring(start);
    activeTextArea.selectionStart = activeTextArea.selectionEnd = start + remainingText.length;
    activeSpan.remove();
    activeSpan = null;
    remainingText = "";
}

// Listen for user input instead of keydown to prevent double input
document.addEventListener("input", (event) => {
    if (event.target === activeTextArea) {
        handleTyping(event);
    }
});
