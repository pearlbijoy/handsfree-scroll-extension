chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background received:", message);
    if (message.action === "takeScreenshot") {
        chrome.tabs.captureVisibleTab(null, {format: "png"}, (dataUrl) => {
            chrome.downloads.download({
                url: dataUrl,
                filename: "gesture-screenshot.png"
            });
        });
    }
    //to find which tab is active at the moment so that the action can be applied on that tab
    chrome.tabs.query(
        { active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, message);
            }
        }
    );
});
