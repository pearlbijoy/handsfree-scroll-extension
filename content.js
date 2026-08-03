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
    const palette = document.getElementById("mode-palette");
    if (palette) palette.style.display = "none";
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
    scroll: {
        label: "Scroll Mode",
        colorVar: "#22c55e",
        icon: `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M55.4792,47.6473c0,9.0883-7.3675,16.4558-16.4558,16.4558s-16.4558-7.3675-16.4558-16.4558"/><line x1="55.4792" x2="55.4792" y1="46.7738" y2="34.7738" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M48.4869,34.4804c0.081-1.9313,1.7123-3.4313,3.6436-3.3502c1.9313,0.081,3.4312,1.7123,3.3502,3.6436"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M41.49,34.2475c0.081-1.9313,1.7123-3.4312,3.6436-3.3502s3.4313,1.7123,3.3502,3.6436"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M41.494,34.1136c0.155-1.9268,1.8426-3.3631,3.7694-3.2081s3.3631,1.8426,3.2081,3.7694"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M34.4524,33.7692c0.1237-1.929,1.7878-3.3925,3.7168-3.2688s3.3925,1.7878,3.2688,3.7168"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M17.4986,35.9928c-1.3429-1.3904-1.3044-3.6061,0.086-4.949c1.3904-1.3429,3.6061-1.3044,4.949,0.086"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M27.4524,11.3969c0-1.933,1.567-3.5,3.5-3.5s3.5,1.567,3.5,3.5"/><line x1="34.4524" x2="34.4524" y1="33.7321" y2="11.3969" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><line x1="27.4524" x2="27.4524" y1="11.3969" y2="39.1875" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><line x1="24.4916" x2="22.5336" y1="33.3435" y2="31.1298" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M19.2663,38.3125c1.9526,2.1439,3.3734,5.1677,3.3013,9.5218"/><line x1="17.4986" x2="19.32" y1="35.9928" y2="38.373" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/></g></svg>`
      
    },
    action: {
        label: "Action Mode",
        colorVar: "#4a90e2",
        icon: `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M30.6145,13.7375 c0.284-1.9293-1.0499-3.7236-2.9792-4.0075s-3.7236,1.0498-4.0075,2.9792c-0.0455,0.3093-0.0498,0.6232-0.0126,0.9336 L23.358,32.641l0.0048,0.9513l0.1928-9.6253c0.284-1.9293-1.0499-3.7236-2.9792-4.0075s-3.7236,1.0498-4.0075,2.9792 c-0.0455,0.3093-0.0498,0.6232-0.0126,0.9336l-0.1759,12.9988l0.0526,10.0853c0.4248,8.3102,7.7518,13.6293,16.06,13.2046 c4.7918-0.2654,9.32-2.2781,12.7278-5.6572c2.9178-3.0904,10.0855-11.5349,10.0855-11.5349 c1.4629-2.1582,0.3282-5.4939-0.8007-4.6726l-9.8756,4.6509l-0.0389-5.3996l0.0389,5.3996l-0.0389-5.3996l0.0395-21.8505 c0.284-1.9293-1.0499-3.7236-2.9792-4.0075s-3.7236,1.0498-4.0075,2.9792c-0.0455,0.3093-0.0498,0.6232-0.0126,0.9336 l-0.0947,6.9994l-0.1861,10.6365l0.3671-22.1928c0.284-1.9293-1.0499-3.7236-2.9792-4.0075 c-1.9293-0.284-3.7236,1.0498-4.0075,2.9792c-0.0455,0.3093-0.0498,0.6232-0.0126,0.9336l-0.1758,20.4538"/></g></svg>`
    },
    nav: {
        label: "Nav Mode",
        colorVar: "#a78bfa",
        icon: `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M55.4792,47.6473c0,9.0883-7.3675,16.4558-16.4558,16.4558s-16.4558-7.3675-16.4558-16.4558"/><line x1="55.4792" x2="55.4792" y1="46.7738" y2="34.7738" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M48.4869,34.4804c0.081-1.9313,1.7123-3.4313,3.6436-3.3502c1.9313,0.081,3.4312,1.7123,3.3502,3.6436"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M41.49,34.2475c0.081-1.9313,1.7123-3.4312,3.6436-3.3502s3.4313,1.7123,3.3502,3.6436"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M41.494,34.1136c0.155-1.9268,1.8426-3.3631,3.7694-3.2081s3.3631,1.8426,3.2081,3.7694"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M34.4524,33.7692c0.1237-1.929,1.7878-3.3925,3.7168-3.2688s3.3925,1.7878,3.2688,3.7168"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M17.4986,35.9928c-1.3429-1.3904-1.3044-3.6061,0.086-4.949c1.3904-1.3429,3.6061-1.3044,4.949,0.086"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M27.4524,11.3969c0-1.933,1.567-3.5,3.5-3.5s3.5,1.567,3.5,3.5"/><line x1="34.4524" x2="34.4524" y1="33.7321" y2="11.3969" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><line x1="27.4524" x2="27.4524" y1="11.3969" y2="39.1875" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><line x1="24.4916" x2="22.5336" y1="33.3435" y2="31.1298" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2" d="M19.2663,38.3125c1.9526,2.1439,3.3734,5.1677,3.3013,9.5218"/><line x1="17.4986" x2="19.32" y1="35.9928" y2="38.373" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/></g></svg>`
    }
};

function renderPalette(currentMode, leftMode, rightMode) {
    const slotModes = { left: leftMode, center: currentMode, right: rightMode };
    window._fanSlotModes = slotModes;

    Object.entries(slotModes).forEach(([slotId, modeId]) => {
        const info = MODE_INFO[modeId];
        if (!info) return;
        const iconWrap = document.getElementById("icon-" + slotId);
        const contentEl = document.getElementById("palette-" + slotId);
        if (iconWrap) {
            // keep the badge (direction arrows) if present, only swap the first svg
            const badge = iconWrap.querySelector(".badge");
            iconWrap.innerHTML = info.icon;
            if (badge) iconWrap.appendChild(badge);
            iconWrap.style.color = info.colorVar;
        }
        if (contentEl) {
            const labelEl = contentEl.querySelector(".label");
            if (labelEl) labelEl.textContent = info.label;
        }
    });

    highlightPaletteMode(currentMode); // center is always the active mode after a rotation
}

function highlightPaletteMode(mode) {
    const slots = window._fanSlotModes || { left: "scroll", center: "action", right: "nav" };
    const slotId = Object.keys(slots).find(key => slots[key] === mode) || "center";
    if (window.setFanHighlight) window.setFanHighlight(slotId);
}

//Allows the panels to be draggable, prevents it from being dragged off the screen
function makeDraggable(el, handle, onClick) {
    let offsetX = 0, offsetY = 0, isDragging = false, startX = 0, startY = 0;
    el._wasDragged = false;

    handle.addEventListener("mousedown", (e) => {
        isDragging = true;
        el._wasDragged = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
            el._wasDragged = true;
        }
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
        if (isDragging && !el._wasDragged && onClick) {
            onClick();
        }
        isDragging = false;
    });
}

function buildFanPalette() {
    const cx = 240, cy = 320;
    const rInner = 46, rOuter = 230;

    const wedgeDefs = [
        { id: "left",   startAngle: -75, endAngle: -25 },
        { id: "center", startAngle: -22, endAngle: 22  },
        { id: "right",  startAngle: 25,  endAngle: 75  },
    ];

    function polar(cx, cy, r, angleDeg) {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function arcPath(cx, cy, rInner, rOuter, startAngle, endAngle) {
        const p1 = polar(cx, cy, rOuter, startAngle);
        const p2 = polar(cx, cy, rOuter, endAngle);
        const p3 = polar(cx, cy, rInner, endAngle);
        const p4 = polar(cx, cy, rInner, startAngle);
        const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
        return `M ${p1.x} ${p1.y}
                A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}
                L ${p3.x} ${p3.y}
                A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}
                Z`;
    }

    const g = document.getElementById("fan-wedges");
    if (!g) return;
    g.innerHTML = ""; // clear in case this ever runs twice

    wedgeDefs.forEach(w => {
        const d = arcPath(cx, cy, rInner, rOuter, w.startAngle, w.endAngle);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("class", "wedge-path " + w.id + (w.id === "center" ? " highlighted" : ""));
        path.setAttribute("id", "path-" + w.id);
        g.appendChild(path);

        const midAngle = (w.startAngle + w.endAngle) / 2;
        const midR = (rInner + rOuter) / 2 + 20;
        const pos = polar(cx, cy, midR, midAngle);
        const contentEl = document.getElementById("palette-" + w.id);
        if (contentEl) {
            contentEl.style.left = pos.x + "px";
            contentEl.style.top = (pos.y + 10) + "px";
            contentEl.style.transform = "translate(-50%, -50%)" + (w.id === "center" ? " scale(1.08)" : "");
        }
    });
}

// Highlights the given wedge ("left" | "center" | "right") in the fanned palette
window.setFanHighlight = function (modeId) {
    ["left", "center", "right"].forEach(id => {
        const path = document.getElementById("path-" + id);
        const content = document.getElementById("palette-" + id);
        if (path) path.classList.toggle("highlighted", id === modeId);
        if (content) {
            content.classList.toggle("active", id === modeId);
            content.classList.toggle("dim", id !== modeId);
            content.style.transform = "translate(-50%, -50%)" + (id === modeId ? " scale(1.08)" : "");
        }
    });
};


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

    const nearLeft = centerX < window.innerWidth / 2;
    const nearTop = centerY < window.innerHeight / 2;

    let newLeft = nearLeft ? fromRect.left : fromRect.right - toEl.offsetWidth;
    let newTop = nearTop ? fromRect.top : fromRect.bottom - toEl.offsetHeight;

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

    buildFanPalette();

    //Collapsing and expanding panel related:
   collapsed.addEventListener("click", () => {
        if (collapsed._wasDragged) return; 
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


     //Reset buttons:restore a slider to its default and tell offscreen.js
    document.getElementById("sensitivity-reset").addEventListener("click", () => {
        document.getElementById("sensitivity-slider").value = SENSITIVITY_DEFAULT;
        document.getElementById("sensitivity-val").textContent = SENSITIVITY_DEFAULT;
        chrome.runtime.sendMessage({action: "setSensitivity", value: SENSITIVITY_DEFAULT});
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
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;

        const isYouTubeShorts = hostname.includes("youtube.com") && pathname.startsWith("/shorts/");
        const isInstagramReels = hostname.includes("instagram.com") && pathname.startsWith("/reels/");

        if (isInstagramReels) {
            const label = message.scrollAmount > 0 ? "Navigate to next Reel" : "Navigate to previous Reel";
            const btn = document.querySelector(`[aria-label="${label}"]`);
            if (btn) btn.click();
        } 
        else if (isYouTubeShorts) {
            const key = message.scrollAmount > 0 ? "ArrowDown" : "ArrowUp";
            document.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true }));
        } 
        else {
            window.scrollBy({
                top: message.scrollAmount,
                left: 0,
                behavior: "smooth"
            });
        }
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