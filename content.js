// Track the active textarea
let activeElement = null;
let activeSpan = null;
let remainingText = "";

// Listen for focus events on text areas
document.addEventListener("focusin", (event) => {
    const isEditable = event.target.tagName.toLowerCase() === "textarea" ||
        (event.target.tagName.toLowerCase() === "input" && event.target.type === "text") ||
        event.target.contentEditable === "true";
    
    if (isEditable) {
        activeElement = event.target;
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
                    text: "System prompt: You are a text and code completion model. Your task is to complete the text or code that the user is currently typing, considering the context of where they are typing. Important rules:\n\n1. Only generate the direct continuation of the text - never include explanations, greetings, or chat-like responses\n2. Consider the HTML context if provided (e.g., if inside a <p> tag, maintain HTML structure)\n3. For code, maintain the same style and indentation\n4. If the last word is complete, start with a space\n5. Keep completions concise and relevant to the current context\n6. Never introduce yourself or explain what you're doing\n7. Never use phrases like 'Here's the completion' or 'I would suggest'\n8. Just provide the direct continuation of the text or code"
                }
            ]
        },
        {
            role: "model",
            parts: [{ text: "Understood." }]
        },
        {
            role: "user",
            parts: [{ text: "Context: <p class='description'>\nThis is a product" }]
        },
        {
            role: "model",
            parts: [{ text: " description that highlights the key features and benefits of our solution." }]
        },
        {
            role: "user",
            parts: [{ text: "Context: function calculate" }]
        },
        {
            role: "model",
            parts: [{ text: "Total(items) {\n    return items.reduce((sum, item) => sum + item.price, 0);\n}" }]
        },
        {
            role: "user",
            parts: [{text: "we can me"}]
        },
        {
            role: "model",
            parts: [{text: "et tomorrow at your place."}]
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: chat.history, generationConfig: {maxOutputTokens: 15}})
        }
    );

    if (!response.ok) {
        const error = await response.json();
        console.error("API Error Details:", error);
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
    if (!activeElement) return;

    remainingText = text;
    if (activeSpan) {
        activeSpan.remove();
    }

    activeSpan = document.createElement("span");
    activeSpan.textContent = remainingText;
    
    // Copy textarea's computed style
    const textareaStyle = window.getComputedStyle(activeElement);
    
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
        max-width: ${activeElement.clientWidth - 
            (parseInt(textareaStyle.paddingLeft) + 
             parseInt(textareaStyle.paddingRight))}px;
    `;

    document.body.appendChild(activeSpan);
    updateSpanPosition();
}

// Function to update the span position
function updateSpanPosition() {
    if (!activeElement || !activeSpan) return;
    const { top, left } = getCursorPosition(activeElement);
    activeSpan.style.left = `${left + 1}px`;
    activeSpan.style.top = `${top + 1}px`;
}

// Function to get text content from any editable element
function getElementText(element) {
    if (element.tagName.toLowerCase() === "textarea" || 
        (element.tagName.toLowerCase() === "input" && element.type === "text")) {
        return element.value;
    } else if (element.contentEditable === "true") {
        return element.textContent;
    }
    return "";
}

// Function to set text content for any editable element
function setElementText(element, text, start, end) {
    if (element.tagName.toLowerCase() === "textarea" || 
        (element.tagName.toLowerCase() === "input" && element.type === "text")) {
        element.value = text;
        element.selectionStart = start;
        element.selectionEnd = end;
    } else if (element.contentEditable === "true") {
        element.textContent = text;
        // Set cursor position for contentEditable
        const range = document.createRange();
        const sel = window.getSelection();
        const textNode = element.firstChild || element;
        range.setStart(textNode, start);
        range.setEnd(textNode, end);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

// Update getCursorPosition to work with contentEditable
function getCursorPosition(element) {
    // For regular inputs and textareas
    if (element.tagName.toLowerCase() === "textarea" || 
        (element.tagName.toLowerCase() === "input" && element.type === "text")) {
        // ... existing mirror code for textarea/input ...
        const mirror = document.createElement('div');
        const style = window.getComputedStyle(element);

        mirror.style.cssText = `
            position: absolute;
            visibility: hidden;
            height: auto;
            width: ${element.clientWidth}px;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            font: ${style.font};
            line-height: ${style.lineHeight};
            padding: 0;
            border: none;
            margin: 0;
        `;

        const textBeforeCursor = element.value.substring(0, element.selectionStart);
        mirror.textContent = textBeforeCursor;
        
        const cursorSpan = document.createElement('span');
        cursorSpan.textContent = '|';
        mirror.appendChild(cursorSpan);

        document.body.appendChild(mirror);

        const elementRect = element.getBoundingClientRect();
        const mirrorRect = mirror.getBoundingClientRect();
        const cursorRect = cursorSpan.getBoundingClientRect();
        
        const paddingTop = parseInt(style.paddingTop, 10) || 0;
        const paddingLeft = parseInt(style.paddingLeft, 10) || 0;

        document.body.removeChild(mirror);

        return {
            top: elementRect.top + window.scrollY + paddingTop + (cursorRect.top - mirrorRect.top),
            left: elementRect.left + window.scrollX + paddingLeft + (cursorRect.left - mirrorRect.left)
        };
    }
    
    // For contentEditable elements
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        
        // Get the last rect if there are multiple lines
        const rect = rects[rects.length] || range.getBoundingClientRect();
        
        // Get the computed style of the element
        const style = window.getComputedStyle(element);
        const elementRect = element.getBoundingClientRect();
        
        // Calculate offsets including padding and line height
        const paddingTop = parseInt(style.paddingTop) || 0;
        const paddingLeft = parseInt(style.paddingLeft) || 0;
        const lineHeight = parseInt(style.lineHeight) || parseInt(style.fontSize) || 16;
        
        // Add vertical offset only for contentEditable
        const verticalOffset = element.contentEditable === "true" ? -2 : 0;
        
        return {
            top: rect.top + window.scrollY - (lineHeight - rect.height) / 2 + verticalOffset,
            left: rect.left + window.scrollX
        };
    }
    
    // Fallback to element position
    const rect = element.getBoundingClientRect();
    return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX
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
    if (!activeElement) return;

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
    if (!activeSpan && getElementText(activeElement).trim().length > 0) {
        debouncedGenerateSuggestion();
    }
}

// Create debounced version of suggestion generator
const debouncedGenerateSuggestion = debounce(async () => {
    if (!activeElement || activeSpan) return;
    
    const existingText = getElementText(activeElement);
    if (!existingText) return;
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
    if (activeElement && event.key === "Tab") {
        event.preventDefault();
        mergeSpanIntoTextarea();
    }
});

// Update mergeSpanIntoTextarea function
function mergeSpanIntoTextarea() {
    if (!activeElement || !activeSpan) return;
    
    const currentText = getElementText(activeElement);
    let cursorPos;
    
    if (activeElement.tagName.toLowerCase() === "textarea" || 
        (activeElement.tagName.toLowerCase() === "input" && activeElement.type === "text")) {
        cursorPos = activeElement.selectionStart;
    } else {
        const selection = window.getSelection();
        cursorPos = selection.anchorOffset;
    }
    
    const newText = currentText.substring(0, cursorPos) + 
                   remainingText + 
                   currentText.substring(cursorPos);
    
    setElementText(activeElement, newText, cursorPos + remainingText.length, cursorPos + remainingText.length);
    
    activeSpan.remove();
    activeSpan = null;
    remainingText = "";
}

// Listen for user input instead of keydown to prevent double input
document.addEventListener("input", (event) => {
    if (event.target === activeElement) {
        handleTyping(event);
    }
});
