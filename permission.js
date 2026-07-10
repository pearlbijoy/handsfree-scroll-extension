document.querySelector("button").addEventListener("click",getCamera);
async function getCamera(){
    try{
    const videoFeed= await navigator.mediaDevices.getUserMedia({video:true});
    await chrome.storage.local.set({cameraPermission:"received"});}
    catch(error){
        console.error("Error:",error);
    }
}
