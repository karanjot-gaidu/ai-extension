// Track the active textarea
let activeTextArea = null;
let activeSpan = null;
let remainingText = "";

// Listen for focus events on text areas
document.addEventListener('focusin', (event) => {
  if (event.target.tagName.toLowerCase() === 'textarea') {
    activeTextArea = event.target;
  }
});

// Function to insert an overlay span
function insertSpan(text) {
    if (!activeTextArea) return;

    // Reset state
    remainingText = text;
    
    if (activeSpan) {
        activeSpan.remove();
    }

    activeSpan = document.createElement("span");
    activeSpan.textContent = remainingText;
    activeSpan.style.position = "absolute";
    activeSpan.style.pointerEvents = "none";
    activeSpan.style.color = "gray";
    activeSpan.style.fontSize = window.getComputedStyle(activeTextArea).fontSize;
    activeSpan.style.fontFamily = window.getComputedStyle(activeTextArea).fontFamily;
    activeSpan.style.whiteSpace = "pre"; // Preserve spaces

    document.body.appendChild(activeSpan);
    updateSpanPosition(); // Position span correctly
}

// Function to update span position dynamically
function updateSpanPosition() {
    if (!activeTextArea || !activeSpan) return;
    
    const { top, left } = getCursorPosition(activeTextArea);
    activeSpan.style.left = `${left + 1}px`;
    activeSpan.style.top = `${top + 1}px`;
}

// Function to get accurate cursor position inside a textarea
function getCursorPosition(textarea) {
    const rect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseInt(style.lineHeight, 10) || 20;
    const paddingTop = parseInt(style.paddingTop, 10) || 0;
    const paddingLeft = parseInt(style.paddingLeft, 10) || 0;

    // Approximate text position based on cursor index
    const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
    const lines = textBeforeCursor.split("\n");
    const lineNumber = lines.length - 1;
    const charCount = lines[lineNumber].length;

    // Use canvas to get accurate text width
    const textWidth = getTextWidth(lines[lineNumber], style);

    return {
        top: rect.top + window.scrollY + paddingTop + lineHeight * lineNumber,
        left: rect.left + window.scrollX + paddingLeft + textWidth
    };
}

// Function to get the width of the text before the cursor
function getTextWidth(text, style) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return ctx.measureText(text).width;
}

// Function to handle user typing inside the textarea
function handleTyping(event) {
    if (!activeTextArea || !activeSpan || remainingText.length === 0) return;

    const typedChar = event.data; // Get actual typed character

    if (typedChar && !remainingText.startsWith(typedChar)) {
        activeSpan.remove();
        activeSpan = null;
        remainingText = "";
        return;
    }
    else if (typedChar && remainingText.startsWith(typedChar)) {
        // Remove typed character from the span
        remainingText = remainingText.substring(1);
        activeSpan.textContent = remainingText;

        // If all text is typed, remove the span
        if (remainingText.length === 0) {
            activeSpan.remove();
            activeSpan = null;
        }
    }

    updateSpanPosition(); // Update span position dynamically
}

// Function to merge remaining span text into textarea (if user presses Tab)
function mergeSpanIntoTextarea() {
    if (!activeTextArea || !activeSpan) return;

    const start = activeTextArea.selectionStart;
    activeTextArea.value = 
        activeTextArea.value.substring(0, start) +
        remainingText + 
        activeTextArea.value.substring(start);

    activeTextArea.selectionStart = activeTextArea.selectionEnd = start + remainingText.length;
    
    activeSpan.remove();
    activeSpan = null;
    remainingText = "";
}

// Listen for keypress events inside the textarea
document.addEventListener('keydown', (event) => {
    if (activeTextArea) {
        if (event.ctrlKey && event.key === "Enter") { // Ctrl+Enter to insert span
            insertSpan("Hello, world!");
        } else if (event.key === "Tab") { // Tab to force merge remaining text
            event.preventDefault();
            mergeSpanIntoTextarea();
        }
    }
});

// Listen for actual text input instead of keydown to prevent double input
document.addEventListener('input', (event) => {
    if (event.target === activeTextArea) {
        handleTyping(event);
    }
});
