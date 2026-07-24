let panelInjected = false;

function injectPanel(startCollapsed = true) {
    if (panelInjected) return;
    panelInjected = true;
    fetch(chrome.runtime.getURL("panel.html"))
        .then(res => res.text())
        .then(html => {
            document.body.insertAdjacentHTML("beforeend", html);
            initPanel();
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

function makeDraggable(el, handle) {
    let offsetX = 0, offsetY = 0, isDragging = false;

    handle.addEventListener("mousedown", (e) => {
        isDragging = true;
        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        el.style.left = (e.clientX - offsetX) + "px";
        el.style.top = (e.clientY - offsetY) + "px";
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
    });
}

function syncPosition(fromEl, toEl) {
    const fromRect = fromEl.getBoundingClientRect();
    const centerX = fromRect.left + fromRect.width / 2;
    const centerY = fromRect.top + fromRect.height / 2;

    let newLeft = centerX - toEl.offsetWidth / 2;
    let newTop = centerY - toEl.offsetHeight / 2;

    // shouldn't end up partially or fully off-screen
    const maxLeft = window.innerWidth - toEl.offsetWidth - 8;
    const maxTop = window.innerHeight - toEl.offsetHeight - 8;
    newLeft = Math.min(Math.max(newLeft, 8), maxLeft);
    newTop = Math.min(Math.max(newTop, 8), maxTop);

    toEl.style.left = newLeft + "px";
    toEl.style.top = newTop + "px";
}

function initPanel() {
    const panel = document.getElementById("gesture-panel");
    const collapsed = document.getElementById("gesture-collapsed");
    const collapseBtn = document.getElementById("collapse-btn");
    document.getElementById("end-btn").addEventListener("click", () => {
    chrome.runtime.sendMessage({action: "requestStopCamera"});
    });

    collapseBtn.addEventListener("click", () => {
        syncPosition(panel, collapsed);
        panel.style.display = "none";
        collapsed.style.display = "flex";
    });

    collapsed.addEventListener("click", () => {
        syncPosition(panel, collapsed);
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
    makeDraggable(panel, document.querySelector(".drag-handle"));
    makeDraggable(collapsed, collapsed);
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