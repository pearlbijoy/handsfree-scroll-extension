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
function initPanel() {
    const panel = document.getElementById("gesture-panel");
    const collapsed = document.getElementById("gesture-collapsed");
    const collapseBtn = document.getElementById("collapse-btn");

    collapseBtn.addEventListener("click", () => {
        panel.style.display = "none";
        collapsed.style.display = "flex";
    });

    collapsed.addEventListener("click", () => {
        collapsed.style.display = "none";
        panel.style.display = "block";
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
    if (message.action === "toggleVideo") {
        const video = document.querySelector("video");
        if (video) {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
    }
});

if (message.action === "cameraStarted") {
    injectPanel(); // expanded by default when actively just turned on
}

chrome.storage.local.get("cameraActive", (result) => {
    if (result.cameraActive) {
        injectPanel();
    }
});