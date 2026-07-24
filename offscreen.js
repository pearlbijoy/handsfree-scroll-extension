import { HandLandmarker, FilesetResolver } from "./vision_bundle.mjs";
//detecting hand
let videoElement;
let handLandmarker;
let fingers;

//pause states
let isPaused = false;
let isVideoPaused=false;
let isScrollPaused = false;

//for checking to pause scroll
let openPalmHoldCount = 0;
const HOLD_FRAMES_REQUIRED = 7;
let scrollPauseToggleFired = false; 

//for scrolling up and down
let wasIndexOnlyLastFrame = false;
let wasIndexMiddleLastFrame = false;
const FLICK_SCROLL_AMOUNT = 300; 

//to pause everything
let thumbsUpHoldCount = 0;
let thumbsUpToggleFired = false;
const THUMBS_UP_HOLD_FRAMES = 5;

//to pause/play yt video
let pauseHoldCount = 0;
const PAUSE_HOLD_FRAMES = 5; // ~1.5s
let pauseToggleFired = false;

// two (screenshot) tracking
let screenShotHoldCount = 0;
const SCREENSHOT_HOLD_FRAMES = 5;
let screenShotToggleFired = false;




let previousY=null;


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
    {baseOptions: {modelAssetPath: "./hand_landmarker.task"},runningMode: "VIDEO",numHands: 1}
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
    return tipDist > knuckleDist * 1.3; // 1.1 = small margin to avoid noise at the threshold
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

//defining the gestures
function isThumbsUpPose(fingers) {
    return fingers.thumb && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
}

function isOpenPalmPose(fingers) {
    return fingers.thumb && fingers.index && fingers.middle && fingers.ring && fingers.pinky;
}

function isScreenShotPose(fingers) {
    return fingers.index && fingers.middle && !fingers.ring && !fingers.pinky;
}

function isPauseVideoPose(fingers) {
    return !fingers.index && !fingers.pinky && !fingers.middle && !fingers.ring;
}

function isIndexOnlyPose(fingers) {
    return fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
}
function isIndexMiddlePose(fingers) {
    return fingers.index && fingers.middle && !fingers.ring && !fingers.pinky;
}

function sendStatusUpdate(handDetected, lastGestureText) {
    chrome.runtime.sendMessage({
        type: "statusUpdate",
        handDetected: handDetected,
        isPaused: isPaused,
        isScrollPaused: isScrollPaused,
        lastGesture: lastGestureText
    });
}

function detectHands(){
    const result= handLandmarker.detectForVideo(videoElement, performance.now());
    console.log(performance.now());
    if (result.landmarks.length === 0) {
        console.log("NO HAND DETECTED");
        // reset hold counters so a dropped hand doesn't carry over stale progress
        openPalmHoldCount = 0;
        pauseHoldCount = 0;
        screenShotHoldCount = 0;
        thumbsUpHoldCount = 0
        sendStatusUpdate(false, null);
        setTimeout(detectHands, 100);
        return;
    }

    let hand=result.landmarks[0];
    fingers=getFingerState(hand);
    //console.log(fingers);


    //CHEKCING IF EVERYTHING NEEDS TO BE PAUSED
    const currentThumbsUp = isThumbsUpPose(fingers);
    if (currentThumbsUp) {
        thumbsUpHoldCount++;
        if (thumbsUpHoldCount >= THUMBS_UP_HOLD_FRAMES && !thumbsUpToggleFired) {
            isPaused = !isPaused;
            thumbsUpToggleFired = true;
            console.log("Paused:", isPaused);
        }
    } else {
        thumbsUpHoldCount = 0;
        thumbsUpToggleFired = false;
    }

    if(!isPaused){
        //TOGGLING IF SCROLL MODE IS ACTIVE
        const currentOpenPalm = isOpenPalmPose(fingers);
        if (currentOpenPalm) {
            openPalmHoldCount++; //counting the number of frames the pose has been held for
            if (openPalmHoldCount >= HOLD_FRAMES_REQUIRED && !scrollPauseToggleFired) {
                isScrollPaused = !isScrollPaused;
                scrollPauseToggleFired = true; 
                console.log("Scroll paused:", isScrollPaused);
            }
        } 
        else {
            openPalmHoldCount = 0;
            scrollPauseToggleFired = false; // reset lock once palm is released
        }

        if (!isScrollPaused) {
            //  SCROLL MODE
            const currentIndexOnly = isIndexOnlyPose(fingers);
            const currentIndexMiddle = isIndexMiddlePose(fingers);

            if (currentIndexOnly && !wasIndexOnlyLastFrame) {
                chrome.runtime.sendMessage({scrollAmount: FLICK_SCROLL_AMOUNT}); // scroll down
                sendStatusUpdate(true, "Scrolled Down");
            }
            if (!currentIndexMiddle && wasIndexMiddleLastFrame) {
                chrome.runtime.sendMessage({scrollAmount: -FLICK_SCROLL_AMOUNT}); // scroll up
                sendStatusUpdate(true, "Scrolled Up");
            }
            wasIndexOnlyLastFrame = currentIndexOnly;
            wasIndexMiddleLastFrame = currentIndexMiddle;
        }
        else{ //all non scroll actions
            const currentPause = isPauseVideoPose(fingers);
            if (currentPause) {
                pauseHoldCount++; //recording how many frames the pose was held for
                if (pauseHoldCount >= PAUSE_HOLD_FRAMES && !pauseToggleFired) {
                    chrome.runtime.sendMessage({action: "toggleVideo"});
                    sendStatusUpdate(true, "Toggled Video");
                    pauseToggleFired = true;
                    console.log("Video toggled");
                }
            } 
            else {
                pauseHoldCount = 0;
                pauseToggleFired = false;
            }

            const currentFist = isScreenShotPose(fingers);
            if (currentFist) {
                screenShotHoldCount++;
                if (screenShotHoldCount >= SCREENSHOT_HOLD_FRAMES && !screenShotToggleFired) {
                    chrome.runtime.sendMessage({action: "takeScreenshot"});
                    sendStatusUpdate(true, "ScreenShot Taken");
                    screenShotToggleFired = true;
                    console.log("Screenshot taken");
                }
            } 
            else {
                screenShotHoldCount = 0;
                screenShotToggleFired = false;
            }
        }
           
    }
    sendStatusUpdate(true, null);    
    setTimeout(detectHands, 100);
}

async function main(){
    await getCamera();
    await loadHandLandmarker();
    detectHands();
}
main();