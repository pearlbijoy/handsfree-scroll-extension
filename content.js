let panelInjected = false;

function injectPanel(startCollapsed = true) {
    if (panelInjected) return;
    fetch(chrome.runtime.getURL("panel.html"))
        .then(res => res.text())
        .then(html => {
            document.body.insertAdjacentHTML("beforeend", html);
            initPanel();
            panelInjected = true;
            if (startCollapsed) {
                
                document.getElementById("gesture-panel").style.display = "none";
                document.getElementById("gesture-collapsed").style.display = "flex";
            }
        });
}

function removePanel() {
    const panel = document.getElementById("gesture-panel");
    const collapsed = document.getElementById("gesture-collapsed");
    if (panel) panel.remove();
    if (collapsed) collapsed.remove();
    panelInjected = false;
}

function updatePanelStatus(message) {
    const dotHand = document.getElementById("dot-hand");
    const handSub = document.getElementById("hand-sub");
    const modeValue = document.getElementById("mode-value");
    const dotCollapsed = document.getElementById("dot-collapsed");

    if (!dotHand) return; // panel not injected yet

    // Hand detected dot
    dotHand.className = "status-dot" + (message.handDetected ? "" : " red");
    handSub.textContent = message.handDetected ? "On track" : "No hand in frame";

    // Mode label + collapsed dot color, per your scheme:
    // green = action mode, orange = scroll mode, red = detection off
    let modeColorClass = "";
    let modeText = "";
    if (message.isPaused) {
        modeColorClass = "red";
        modeText = "Paused";
    } else if (message.isScrollPaused) {
        modeColorClass = ""; // green (default)
        modeText = "Action Mode";
    } else {
        modeColorClass = "orange";
        modeText = "Scroll Mode";
    }
    modeValue.textContent = modeText;
    dotCollapsed.className = "status-dot-mini" + (modeColorClass ? " " + modeColorClass : "");
    console.log(modeColorClass);
    // Last gesture

    const dotScroll = document.getElementById("dot-scroll");
    const scrollSub = document.getElementById("scroll-sub");
    dotScroll.className = "status-dot" + (message.isScrollPaused ? "" : "orange");
    scrollSub.textContent = message.isScrollPaused ? "Scroll gestures disabled" : "Ready to scroll";

    if (message.lastGesture) {
        document.getElementById("last-gesture").textContent = message.lastGesture;
        document.getElementById("last-gesture-time").querySelector("span")?.remove(); // if you add a text node wrapper
        // simplest: just update a timestamp
        const timeEl = document.getElementById("last-gesture-time");
        timeEl.lastChild.textContent = " just now";
    }
}

function initPanel() {
    const panel = document.getElementById("gesture-panel");
    const collapsed = document.getElementById("gesture-collapsed");
    const collapseBtn = document.getElementById("collapse-btn");
    document.getElementById("end-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({action: "requestStopCamera"});
    });

    collapseBtn.addEventListener("click", () => {
        panel.style.display = "none";
        collapsed.style.display = "flex";
    });

    collapsed.addEventListener("click", () => {
        collapsed.style.display = "none";
        panel.style.display = "block";
    });

    //sending message back to offscreen.js
    document.getElementById("pause-btn").addEventListener("click", () => {
        chrome.runtime.sendMessage({action: "togglePauseFromPanel"});
    });

    document.getElementById("end-btn").addEventListener("click", () => {
        chrome.runtime.sendMessage({action: "requestStopCamera"});
    });

    document.getElementById("sensitivity-slider").addEventListener("input", (e) => {
        const val = Number(e.target.value);
        document.getElementById("sensitivity-val").textContent = val;
        chrome.runtime.sendMessage({action: "setSensitivity", value: val});
    });

    document.getElementById("hold-slider").addEventListener("input", (e) => {
        const val = Number(e.target.value);
        document.getElementById("hold-val").textContent = val;
        chrome.runtime.sendMessage({action: "setHoldFrames", value: val});
    });
    document.querySelectorAll(".mode-option").forEach(option => {
        option.addEventListener("click", () => {
            const scrollPausedValue = option.dataset.mode === "action";
            chrome.runtime.sendMessage({action: "setMode", isScrollPaused: scrollPausedValue});
        });
    });
    document.querySelector(".mode-box").addEventListener("click", () => {
        const dropdown = document.getElementById("mode-dropdown");
        dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received:", message);
    if (message.action === "cameraStarted") {
        injectPanel();
    }
    if (message.action === "cameraStopped") {
        removePanel();
    }
    if (message.scrollAmount !== undefined) {
        window.scrollBy({
            top: message.scrollAmount,
            left: 0,
            behavior: "smooth"
        });
    }
    if (message.action === "hidePanelForCapture") {
        const panel = document.getElementById("gesture-panel");
        const collapsed = document.getElementById("gesture-collapsed");
        if (panel) panel.style.visibility = "hidden";
        if (collapsed) collapsed.style.visibility = "hidden";
        sendResponse({done: true});
        return true;
    }
    if (message.action === "showPanelAfterCapture") {
        const panel = document.getElementById("gesture-panel");
        const collapsed = document.getElementById("gesture-collapsed");
        if (panel) panel.style.visibility = "visible";
        if (collapsed) collapsed.style.visibility = "visible";
    }
    if (message.action === "toggleVideo") {
        const video = document.querySelector("video");
        if (video) {
            video.paused ? video.play():video.pause();
        }
    }
    if (message.type === "statusUpdate") {
        updatePanelStatus(message);
    }
});

chrome.storage.local.get("cameraActive", (result) => {
    if (result.cameraActive) {
        injectPanel();
    }
});