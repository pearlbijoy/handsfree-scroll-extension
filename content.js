fetch(chrome.runtime.getURL("panel.html"))
    .then(res => res.text())
    .then(html => {
        document.body.insertAdjacentHTML("beforeend", html);
        initPanel();
    });

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

    if (message.scrollAmount !== undefined) {
        window.scrollBy(0, message.scrollAmount);
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