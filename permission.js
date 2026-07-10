document.querySelector("button").addEventListener("click",getCamera);
async function getCamera(){
    try{
    const videoFeed= await navigator.mediaDevices.getUserMedia({video:true});
    videoFeed.getTracks().forEach(track => track.stop()); ////LOOK AT AGAIN
    await chrome.storage.local.set({cameraPermission:"received"});
    window.close();}
    catch(error){
        console.error("Error:",error);
    }
}
