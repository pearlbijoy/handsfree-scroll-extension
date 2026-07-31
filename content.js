let panelInjected = false;
let lastGestureTimestamp = null;
let reinjectInProgress = false;
let cameraIsActive = false;

//For detection rate display 
function formatElapsed(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
}
// Recomputes and redraws the last gesture timestamp
function updateLastGestureTimeDisplay() {
    if (lastGestureTimestamp == null) return;
    const timeEl = document.getElementById("last-gesture-time");
    if (!timeEl) return;
    timeEl.lastChild.textContent = " " + formatElapsed(Date.now() - lastGestureTimestamp);
}
//keeps the the update timestamp function running every second
setInterval(updateLastGestureTimeDisplay, 1000);

//Injects panel.html into the current page's DOM
function injectPanel(startCollapsed = true) {
    if (panelInjected) return; //if the panel is already there then dont run
    reinjectInProgress = true;
    panelInjected = true;
    console.log("injectPanel: starting fetch");
    fetch(chrome.runtime.getURL("panel.html"))
        .then(res => res.text())
        .then(html => {
            console.log("injectPanel: fetch done, inserting HTML");
            document.body.insertAdjacentHTML("beforeend", html);
            initPanel();
            if (startCollapsed) {
                document.getElementById("gesture-panel").style.display = "none";
                document.getElementById("gesture-collapsed").style.display = "flex";
            }
            reinjectInProgress = false;
            console.log("injectPanel: done");
        });
}

//Removes panel from page when camera is stopped(end is clicked)
function removePanel() {
    const panel = document.getElementById("gesture-panel");
    const collapsed = document.getElementById("gesture-collapsed");
    if (panel) panel.remove();
    if (collapsed) collapsed.remove();
    panelInjected = false;
}

//updates colors/panel variables every detection cycle with current variables form offscreen.js
function updatePanelStatus(message) {
    const dotHand = document.getElementById("dot-hand");
    const handSub = document.getElementById("hand-sub");
    const modeValue = document.getElementById("mode-value");
    const dotCollapsed = document.getElementById("dot-collapsed");
    const guideModeText = document.getElementById("guide-mode-text");
    const guideModeDot = document.getElementById("guide-mode-dot");

    if (!dotHand) return; // panel not injected yet

    // Hand detected dot
    dotHand.className = "status-dot" + (message.handDetected ? "" : " red");
    handSub.textContent = message.handDetected ? "On track" : "No hand in frame";

    // green = action mode, orange = scroll mode,red = detection off
    let modeColorClass = "";
    let modeText = "";

    if (message.isPaused) {
        modeColorClass = "red";
        modeText = "Paused";
    } 
    else if (message.currentMode === "action") {
        modeColorClass = "";
        modeText = "Action Mode";
    } 
    else if (message.currentMode === "nav") {
        modeColorClass = "blue";
        modeText = "Nav Mode";
    }
    else {
        modeColorClass = "orange";
        modeText = "Scroll Mode";
    }

    modeValue.textContent = modeText;
    dotCollapsed.className = "status-dot-mini" + (modeColorClass ? " " + modeColorClass : "");
    
    //to update the guide panel on what mode the user is currently in
    if (guideModeText) {
        guideModeText.textContent = modeText;
        guideModeDot.className = "status-dot" + (modeColorClass ? " " + modeColorClass : "");
    }

    const dotScroll = document.getElementById("dot-scroll");
    const scrollSub = document.getElementById("scroll-sub");
    dotScroll.className = "status-dot" + (message.isScrollPaused ? "" : "orange");
    scrollSub.textContent = message.isScrollPaused ? "Scroll gestures disabled" : "Ready to scroll";

    if (message.lastGesture) {
        document.getElementById("last-gesture").textContent = message.lastGesture;
        lastGestureTimestamp = Date.now();
        updateLastGestureTimeDisplay();
    }

    const rateEl = document.getElementById("detection-rate");
    if (rateEl) rateEl.textContent = `~${message.detectionRate} ms / frame`;    
}

//for the switch mode pallete
const MODE_INFO = {
    scroll: { icon: "☝️", label: "Scroll Mode" },
    action: { icon: "✋", label: "Action Mode" },
    nav: { icon: "🧭", label: "Nav Mode" }
};

function renderPalette(currentMode, leftMode, rightMode) {
    const slots = [
        { id: "palette-left", mode: leftMode },
        { id: "palette-center", mode: currentMode },
        { id: "palette-right", mode: rightMode }
    ];
    slots.forEach(({ id, mode }) => {
        const el = document.getElementById(id);
        el.dataset.mode = mode;
        el.innerHTML = `<div class="palette-icon">${MODE_INFO[mode].icon}</div><div class="palette-label">${MODE_INFO[mode].label}</div>`;
    });
    highlightPaletteMode(currentMode);
}

function highlightPaletteMode(mode) {
    document.querySelectorAll(".palette-option").forEach(el => {
        el.classList.toggle("palette-highlighted", el.dataset.mode === mode);
    });
}

//Allows the panels to be draggable, prevents it from being dragged off the screen
function makeDraggable(el, handle,onClick) {
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
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        const maxLeft = window.innerWidth - el.offsetWidth - 8;
        const maxTop = window.innerHeight - el.offsetHeight - 8;
        newLeft = Math.min(Math.max(newLeft, 8), maxLeft);
        newTop = Math.min(Math.max(newTop, 8), maxTop);

        el.style.left = newLeft + "px";
        el.style.top = newTop + "px";
    });

    document.addEventListener("mouseup", () => {
        if (isDragging && onClick) {
            onClick();
        }
        isDragging = false;
    });
}

function ensurePanelExists() {
    if (cameraIsActive && !document.getElementById("gesture-panel")&& !reinjectInProgress) {
        console.log("Panel missing — reinjecting");
        panelInjected = false;
        injectPanel();
    }
    else {
        console.log("ensurePanelExists: panel present or camera off, no action");
    }
}

function scheduleReinjectCheck() {
    setTimeout(ensurePanelExists, 1000);
}

if (document.readyState === "complete") {
    scheduleReinjectCheck();
} else {
    window.addEventListener("load", scheduleReinjectCheck);
}
setInterval(ensurePanelExists, 2000);

//to sync the position of collapsed and expanded panels.
function syncPosition(fromEl, toEl) {
    const fromRect = fromEl.getBoundingClientRect();
    const centerX = fromRect.left + fromRect.width / 2;
    const centerY = fromRect.top + fromRect.height / 2;

    let newLeft = centerX - toEl.offsetWidth / 2;
    let newTop = centerY - toEl.offsetHeight / 2;

    //shouldn't end up partially or fully off-screen
    const maxLeft = window.innerWidth - toEl.offsetWidth - 8;
    const maxTop = window.innerHeight - toEl.offsetHeight - 8;
    newLeft = Math.min(Math.max(newLeft, 8), maxLeft);
    newTop = Math.min(Math.max(newTop, 8), maxTop);

    toEl.style.left = newLeft + "px";
    toEl.style.top = newTop + "px";
}

//Connects every interactive element in the panel.html after it has been inserted into the page
function initPanel() {
    const panel = document.getElementById("gesture-panel");
    const collapsed = document.getElementById("gesture-collapsed");
    const collapseBtn = document.getElementById("collapse-btn");
    const SENSITIVITY_DEFAULT = 400;
    const HOLD_DEFAULT = 6;

    //Collapsing and expanding panel related:
   collapsed.addEventListener("click", () => {
        panel.style.visibility = "hidden";
        panel.style.display = "block";
        syncPosition(collapsed, panel);
        collapsed.style.display = "none";
        panel.style.visibility = "visible";
    });

    collapseBtn.addEventListener("click", () => {
        collapsed.style.visibility = "hidden";
        collapsed.style.display = "flex";
        syncPosition(panel, collapsed);
        panel.style.display = "none";
        collapsed.style.visibility = "visible";
        
    });

    //Sending message back to offscreen.js
    document.getElementById("pause-btn").addEventListener("click", () => {
        chrome.runtime.sendMessage({action: "togglePauseFromPanel"});
    });

    //Slider related:
    //Sliders pass their current value to offscreen.js
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

     //Reset buttons:restore a slider to its default and tell offscreen.js
    document.getElementById("sensitivity-reset").addEventListener("click", () => {
        document.getElementById("sensitivity-slider").value = SENSITIVITY_DEFAULT;
        document.getElementById("sensitivity-val").textContent = SENSITIVITY_DEFAULT;
        chrome.runtime.sendMessage({action: "setSensitivity", value: SENSITIVITY_DEFAULT});
    });

    document.getElementById("hold-reset").addEventListener("click", () => {
        document.getElementById("hold-slider").value = HOLD_DEFAULT;
        document.getElementById("hold-val").textContent = HOLD_DEFAULT;
        chrome.runtime.sendMessage({action: "setHoldFrames", value: HOLD_DEFAULT});
    });

    //Guide panel related:
    document.getElementById("guide-btn").addEventListener("click", () => {
        document.getElementById("guide-overlay").style.display = "flex";
    });
    document.getElementById("guide-close-btn").addEventListener("click", () => {
        document.getElementById("guide-overlay").style.display = "none";
    });
    document.getElementById("guide-overlay").addEventListener("click", (e) => {
        if (e.target.id === "guide-overlay") {
            document.getElementById("guide-overlay").style.display = "none";
        }
    });
    
    //Mode dropdown:
    //Manual mode override dropdown, lets the user force Scroll/Action mode
    document.querySelectorAll(".mode-option").forEach(option => {
        option.addEventListener("click", () => {
            chrome.runtime.sendMessage({action: "setMode", mode: option.dataset.mode});
        });
    });

    document.querySelector(".mode-box").addEventListener("click", () => {
        const dropdown = document.getElementById("mode-dropdown");
        dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    });

    //live feed related:
    //Live feed panel toggle, tells offscreen.js whether to render frames or not base don whether its closed or not
    document.getElementById("feed-toggle-btn").addEventListener("click", () => {
        const feedPanel = document.getElementById("hand-feed-panel");
        const isOpen = feedPanel.style.display !== "none";
        feedPanel.style.display = isOpen ? "none" : "block";
        chrome.runtime.sendMessage({action: "setFeedVisible", value: !isOpen});
    });

    document.getElementById("feed-close-btn").addEventListener("click", () => {
        document.getElementById("hand-feed-panel").style.display = "none";
        chrome.runtime.sendMessage({action: "setFeedVisible", value: false});
    });

    //everything draggable
    makeDraggable(document.getElementById("hand-feed-panel"), document.querySelector(".feed-panel-header"));
    makeDraggable(panel, document.querySelector(".drag-handle"));
    makeDraggable(collapsed, collapsed);

    //End everything when the button is clicked. Remove panels and live feed and stop camera
    document.getElementById("end-btn").addEventListener("click", () => {
        chrome.runtime.sendMessage({action: "requestStopCamera"});
        document.getElementById("hand-feed-panel").style.display = "none";
        chrome.runtime.sendMessage({action: "setFeedVisible", value: false});
    });   
}

//Receives every message from other scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "cameraStarted") {
        cameraIsActive = true;
        injectPanel();
    }
    if (message.action === "cameraStopped") {
        cameraIsActive = false;
        removePanel();
    }

    if (message.action === "openModePalette") {
        const palette = document.getElementById("mode-palette");
        if (palette) {
            const order = ["scroll", "action", "nav"];
            const i = order.indexOf(message.currentMode);
            const leftMode = order[(i - 1 + 3) % 3];
            const rightMode = order[(i + 1) % 3];
            renderPalette(message.currentMode, leftMode, rightMode);
            palette.style.display = "flex";
        }
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
        const guide = document.getElementById("guide-overlay");
        const feed = document.getElementById("hand-feed-panel");

        if (panel) panel.style.visibility = "hidden";
        if (collapsed) collapsed.style.visibility = "hidden";
        if (guide) guide.style.visibility = "hidden";
        if (feed) feed.style.visibility = "hidden";   

        sendResponse({done: true});
        return true;
    }

    if (message.action === "showPanelAfterCapture") {
        const panel = document.getElementById("gesture-panel");
        const collapsed = document.getElementById("gesture-collapsed");
        const guide = document.getElementById("guide-overlay");
        const feed = document.getElementById("hand-feed-panel"); 

        if (panel) panel.style.visibility = "visible";
        if (collapsed) collapsed.style.visibility = "visible";
        if (guide) guide.style.visibility = "visible";
        if (feed) feed.style.visibility = "visible";  
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

    if (message.type === "handFeedFrame") {
        const img = document.getElementById("hand-feed-img");
        if (img) img.src = message.image;
    }

    if (message.action === "openModePalette") {
        const palette = document.getElementById("mode-palette");
        if (palette) {
            palette.style.display = "flex";
            highlightPaletteMode(message.currentMode);
        }
    }

    if (message.action === "highlightMode") {
        highlightPaletteMode(message.mode);
    }

    if (message.action === "closeModePalette") {
        const palette = document.getElementById("mode-palette");
        if (palette) palette.style.display = "none";
    }
});

//to check whether camera is active and injects panel when a fresh page is loaded
chrome.storage.local.get("cameraActive", (result) => {
    if (result.cameraActive) {
        cameraIsActive = true;
        injectPanel();
    }
});