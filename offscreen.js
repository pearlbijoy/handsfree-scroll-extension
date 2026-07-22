import { HandLandmarker, FilesetResolver } from "./vision_bundle.mjs";
let videoElement;
let handLandmarker;
let fingers;
let previousY=null
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

function getDistance(hand,indexA,indexB){
    let dx=hand[indexA].x-hand[indexB].x;
    let dy=hand[indexA].y-hand[indexB].y;
    return Math.sqrt(dx*dx+dy*dy);
}

function isFingerExtendedByDistance(hand,tipIndex,knuckleIndex){
    const tipDist = getDistance(hand, tipIndex, 0);
    const knuckleDist = getDistance(hand, knuckleIndex, 0);
    return tipDist > knuckleDist * 1.1; // 1.1 = small margin to avoid noise at the threshold
}

function getFingerState(hand) {
    return {
        thumb: getDistance(hand, 4, 17) > getDistance(hand, 2, 17) * 1.1, //checking if closer to pinky bcs thumb folds sideways
        index: isFingerExtendedByDistance(hand, 8, 6),
        middle: isFingerExtendedByDistance(hand, 12, 10),
        ring: isFingerExtendedByDistance(hand, 16, 14),
        pinky: isFingerExtendedByDistance(hand, 20, 18)
    };
}

function isScrollPose(fingers){
    return fingers.index && fingers.middle && !fingers.ring && !fingers.pinky
}

function detectScrollGesture(hand) {
    const currentY = (hand[8].y + hand[12].y) / 2;
    if (previousY !== null) {
        const deltaY = currentY - previousY;
        const MAX_REASONABLE_DELTA = 0.08;

        if (Math.abs(deltaY) > MAX_REASONABLE_DELTA) {
            // discard this frame — likely a tracking glitch, not real motion
            previousY = currentY;
            return;
        }
        let SENSITIVITY_MULTIPLIER=3000;
        const scrollAmount = deltaY * SENSITIVITY_MULTIPLIER;
        chrome.runtime.sendMessage({scrollAmount: scrollAmount});
    }
    previousY = currentY;
}

function detectHands(){
    const result= handLandmarker.detectForVideo(videoElement, performance.now());
    console.log(result);
    console.log(videoElement.videoWidth, videoElement.videoHeight);
    if (result.landmarks.length > 0) {
        let hand=result.landmarks[0];
        fingers=getFingerState(hand);
        //console.log(fingers);

        if(isScrollPose(fingers)){
            detectScrollGesture(hand);

        }
        else{
            previousY=null;
        }
        
    }
    else{
        console.log("NO HAND DETECTED");
    }
    
    setTimeout(detectHands, 100);
}

async function main(){
    await getCamera();
    await loadHandLandmarker();
    detectHands();
}
main();