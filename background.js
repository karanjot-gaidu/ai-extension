// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'getAISuggestion') {
//     // Using Chrome's built-in Gemini API (when available)
//     // Note: This is a placeholder as the exact API isn't public yet
//     chrome.runtime.sendNativeMessage(
//       'com.google.chrome.generative',
//       {
//         text: request.selection.text,
//         prompt: "Continue this text naturally:"
//       },
//       (response) => {
//         sendResponse({ suggestion: response.text });
//       }
//     );
//     return true; // Required for async response
//   }
// }); 