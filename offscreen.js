import { HandLandmarker, FilesetResolver } from "./vision_bundle.mjs";
async function getCamera(){
    console.log("Asking for camera..");
    const videoFeed= await navigator.mediaDevices.getUserMedia({video:true});
    const videoElement=document.querySelector("#livecam");
    videoElement.srcObject=videoFeed;
    console.log("Camera Active");
}
getCamera()

async function loadHandLandmarker(){
    const vision= await FilesetResolver.forVisionTasks("./wasm");
    const handLandmarker = await HandLandmarker.createFromOptions(
    vision,
    {baseOptions: {modelAssetPath: "./hand_landmarker.task"},runningMode: "VIDEO",numHands: 2}
    );
    if(handLandmarker){
        console.log("Landmarker object was created successfully.");
    }
}
loadHandLandmarker()