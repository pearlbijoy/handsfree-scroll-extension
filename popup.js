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
        createOffscreen();
    }
    else{
        chrome.tabs.create({url:"permission.html"});
    }
}
checkPermission(); 
