chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received:", message);

    if (message.scrollAmount !== undefined) {
        window.scrollBy(0, message.scrollAmount);
    }
});