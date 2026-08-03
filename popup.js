async function createOffscreen(){
    try{
        const offscreendocumentexists= await chrome.offscreen.hasDocument();
        if(offscreendocumentexists){
            console.log("Offscreen document already exists.");
            return;
        }
        await chrome.offscreen.createDocument({
            url:"offscreen.html",
            reasons:["USER_MEDIA"],
            justification:"This document is required to access the camera to track finger movement for scrolling",
        });
        console.log("Offscreen document was created.");}
    catch(err){
        console.error("Failed to create offscreen document:",err);
    }
}
async function checkPermission(){
    const permissionStatus = await navigator.permissions.query({ name: "camera" });
    if (permissionStatus.state === "granted") {
        await chrome.storage.local.set({ cameraPermission: "received" });
        await createOffscreen();
        return true;
    } 
    else {
        await chrome.storage.local.set({ cameraPermission: "not received" });
        chrome.tabs.create({url:"permission.html"});
        return false;
    }
}

async function updateButtonText(){
    const offscreendocumentexists=await chrome.offscreen.hasDocument();
    document.querySelector("#togglecamera").textContent=offscreendocumentexists?"Stop Camera":"Enable Camera";
}

async function toggleCamera(){
    const state=await chrome.offscreen.hasDocument();
    if(state){
        await chrome.offscreen.closeDocument();
        await chrome.storage.local.set({cameraActive: false});
        updateButtonText();
        broadcastToAllTabs({action: "cameraStopped"});
    }
    else{
        const granted = await checkPermission();
        if (!granted) return; // stop here — don't set cameraActive or broadcast anything
        await chrome.storage.local.set({cameraActive: true});
        updateButtonText();
        broadcastToAllTabs({action: "cameraStarted"});
    }
}

function broadcastToAllTabs(message) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        });
    });
}

document.querySelector("#togglecamera").addEventListener("click",toggleCamera);
updateButtonText();