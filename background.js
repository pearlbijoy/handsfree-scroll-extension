chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background received:", message);
    if (message.action === "takeScreenshot") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            const tabId = tabs[0].id;

            chrome.tabs.sendMessage(tabId, {action: "hidePanelForCapture"}, () => {
                chrome.tabs.captureVisibleTab(null, {format: "png"}, (dataUrl) => {
                    chrome.downloads.download({
                        url: dataUrl,
                        filename: "gesture-screenshot.png"
                    });
                    chrome.tabs.sendMessage(tabId, {action: "showPanelAfterCapture"});
                });
            });
        });
        return;
    }
    if (message.action === "requestStopCamera") {
        chrome.offscreen.closeDocument();
        chrome.storage.local.set({cameraActive: false});
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, {action: "cameraStopped"}).catch(() => {}));
        });
    }
    if (message.type === "statusUpdate") {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {});
            });
        });
        return;
    }

    const offscreenOnlyActions = ["togglePauseFromPanel", "setSensitivity", "setHoldFrames","setMode"];
    if (offscreenOnlyActions.includes(message.action)) {
        chrome.runtime.sendMessage(message); 
        return;
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
