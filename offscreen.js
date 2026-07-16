import { HandLandmarker, FilesetResolver } from "./vision_bundle.mjs";
let videoElement;
let handLandmarker;
async function getCamera(){
    console.log("Asking for camera..");
    const videoFeed= await navigator.mediaDevices.getUserMedia({video:true});
    videoElement=document.querySelector("#livecam");
    videoElement.srcObject=videoFeed;
    console.log("Camera Active");
}

async function loadHandLandmarker(){
    const vision= await FilesetResolver.forVisionTasks("./wasm");
    handLandmarker = await HandLandmarker.createFromOptions(
    vision,
    {baseOptions: {modelAssetPath: "./hand_landmarker.task"},runningMode: "VIDEO",numHands: 2}
    );
    if(handLandmarker){
        console.log("Landmarker object was created successfully.");
    }
    const handLandmarkerReady=true;
}

function detectHands(){
    const timestamp= handLandmarker.detectForVideo(videoElement, performance.now());
    console.log(timestamp);
    console.log(videoElement.videoWidth, videoElement.videoHeight);
    setTimeout(detectHands, 100);
}

async function main(){
    await getCamera();
    await loadHandLandmarker();
    detectHands();
}
main();