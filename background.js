chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    //Screenshot request from offscreen.js as only background scripts can capture the visible tab
    if (message.action === "takeScreenshot") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, {action: "hidePanelForCapture"}, () => {
                setTimeout(() => {
                    chrome.tabs.captureVisibleTab(null, {format: "png"}, (dataUrl) => {
                        chrome.downloads.download({
                            url: dataUrl,
                            filename: "gesture-screenshot.png"
                        });
                        chrome.tabs.sendMessage(tabId, {action: "showPanelAfterCapture"});
                    });
                }, 100);
            });
        });
        return;
    }

    if(message.action=== "reload"){
        chrome.tabs.reload();
        return;
    }

    if (message.action === "zoomIn" || message.action === "zoomOut") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs[0]) return;
            const tabId = tabs[0].id;
            const ZOOM_STEP = 0.1; // 10% per zoom action
            chrome.tabs.getZoom(tabId, (currentZoom) => {
                let newZoom = message.action === "zoomIn" ? currentZoom + ZOOM_STEP : currentZoom - ZOOM_STEP;
                newZoom = Math.min(Math.max(newZoom, 0.25), 5); // clamp to Chrome's zoom range
                chrome.tabs.setZoom(tabId, newZoom);
            });
        });
        return;
    }
    if (message.action === "nextTab" || message.action === "prevTab") {
        chrome.tabs.query({currentWindow: true}, (tabs) => {
            tabs.sort((a, b) => a.index - b.index); // ensure correct left-to-right order
            const activeIndex = tabs.findIndex(t => t.active);
            if (activeIndex === -1) return;

            const newIndex = message.action === "nextTab"
                ? (activeIndex + 1) % tabs.length
                : (activeIndex - 1 + tabs.length) % tabs.length;

            chrome.tabs.update(tabs[newIndex].id, {active: true});
        });
        return;
    }

    if (message.action === "goBack") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) chrome.tabs.goBack(tabs[0].id);
        });
        return;
    }
    if (message.action === "goForward") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) chrome.tabs.goForward(tabs[0].id);
        });
        return;
    }

    //End button when clicked should shut the camera and detection and remove the panel from every tab
    if (message.action === "requestStopCamera") {
        chrome.offscreen.closeDocument();
        chrome.storage.local.set({cameraActive: false});
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, {action: "cameraStopped"}).catch(() => {}));
        });
    }

    //Status Broadcasts for variables from offscreen.js that need to be sent to every tab
    if (message.type === "statusUpdate") {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {});
            });
        });
        return;
    }

    //to find which tab is active at the moment so that the action can be applied on that tab only( scrolling, toggle video)
    chrome.tabs.query(
        { active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, message).catch(()=>{});
            }
        }
    );
});
