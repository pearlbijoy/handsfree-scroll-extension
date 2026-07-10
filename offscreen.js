async function getCamera(){
    console.log("Asking for camera..");
    const videoFeed= await navigator.mediaDevices.getUserMedia({video:true});
    const videoElement=document.querySelector("#livecam");
    videoElement.srcObject=videoFeed;
    console.log("Camera Active");
}
getCamera()