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

function isFingerExtended(landmarks,tipIndex,jointIndex){
    return landmarks[tipIndex].y<landmarks[jointIndex].y;
}

function detectHands(){
    const result= handLandmarker.detectForVideo(videoElement, performance.now());
    console.log(result);
    console.log(videoElement.videoWidth, videoElement.videoHeight);
    if (result.landmarks.length > 0) {
            const indexfinger = isFingerExtended(result.landmarks[0], 8, 6);
            const middlefinger = isFingerExtended(result.landmarks[0], 12, 10);
            console.log(`index extended ${indexfinger}; middle extended ${middlefinger}`);
        }
    setTimeout(detectHands, 100);
}

async function main(){
    await getCamera();
    await loadHandLandmarker();
    detectHands();
}
main();