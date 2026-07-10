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
    const result=await chrome.storage.local.get("cameraPermission");
    if(result.cameraPermission=="received"){
        await createOffscreen();
    }
    else{
        chrome.tabs.create({url:"permission.html"});
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
    }
    else{
        await checkPermission(); 
    }
    updateButtonText();
}

document.querySelector("#togglecamera").addEventListener("click",toggleCamera);
updateButtonText();