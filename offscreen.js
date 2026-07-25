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
let HOLD_FRAMES_REQUIRED = 6;
let scrollPauseToggleFired = false; 

//for scrolling up and down
let wasIndexOnlyLastFrame = false;
let wasIndexMiddleLastFrame = false;
let FLICK_SCROLL_AMOUNT = 400; 

//to pause everything
let thumbsUpHoldCount = 0;
let thumbsUpToggleFired = false;
let THUMBS_UP_HOLD_FRAMES = 7;

//to pause/play yt video
let pauseHoldCount = 0;
let PAUSE_HOLD_FRAMES = 6; // ~1.5s
let pauseToggleFired = false;

// two (screenshot) tracking
let screenShotHoldCount = 0;
let SCREENSHOT_HOLD_FRAMES = 6;
let screenShotToggleFired = false;

//for the live feed
let isFeedVisible = false;
let latestHand = null;    
let feedInterval = null;   
const feedCanvas = document.createElement("canvas");
feedCanvas.width = 400;
feedCanvas.height = 225;
const feedCtx = feedCanvas.getContext("2d");

//for the detection rate
let lastFrameTime = performance.now();
let currentDetectionRate = 300;

const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17]
];


//checking if any messages from the panel were received
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "togglePauseFromPanel") {
        isPaused = !isPaused;
        console.log("Paused (from panel):", isPaused);
    }
    if (message.action === "setSensitivity") {
        FLICK_SCROLL_AMOUNT = message.value; // needs to change from const to let
    }
    if (message.action === "setHoldFrames") {
        HOLD_FRAMES_REQUIRED = message.value; // same — was const, needs to be let
        PAUSE_HOLD_FRAMES = message.value;
        SCREENSHOT_HOLD_FRAMES = message.value;
    }
    if (message.action === "setMode") {
        isScrollPaused = message.isScrollPaused;
        console.log("Mode set from panel:", isScrollPaused ? "Action Mode" : "Scroll Mode");
    }
    if (message.action === "setFeedVisible") {
        isFeedVisible = message.value;
        if (isFeedVisible && !feedInterval) {
            feedInterval = setInterval(drawFeedFrame, 100);   // fast, independent redraw
        }
        if (!isFeedVisible && feedInterval) {
            clearInterval(feedInterval);
            feedInterval = null;
        }
    }
});

async function getCamera(){
    console.log("Asking for camera..");
    const videoFeed= await navigator.mediaDevices.getUserMedia({
        video:{
            width:{ideal:1280},
            height:{ideal:720}
        }
    });
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

function drawFeedFrame() {
    feedCtx.drawImage(videoElement, 0, 0, feedCanvas.width, feedCanvas.height);

    if (latestHand) {
        feedCtx.strokeStyle = "#828683";
        feedCtx.beginPath();
        for (let [start, end] of HAND_CONNECTIONS) {
            feedCtx.moveTo(latestHand[start].x * feedCanvas.width, latestHand[start].y * feedCanvas.height);
            feedCtx.lineTo(latestHand[end].x * feedCanvas.width, latestHand[end].y * feedCanvas.height);
        }
        feedCtx.stroke();

        for (let point of latestHand) {
            feedCtx.beginPath();
            feedCtx.arc(point.x * feedCanvas.width, point.y * feedCanvas.height, 2, 0, 2 * Math.PI);
            feedCtx.fillStyle = "#d4d2cb";
            feedCtx.fill();
        }
    }

    chrome.runtime.sendMessage({
        type: "handFeedFrame",
        image: feedCanvas.toDataURL("image/jpeg", 0.6)
    });
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
function isThumbsUpPose(fingers,hand) { //to ensure that it is an actual thumbs UP position and not thumb sideways position
    const thumbPointingUp =  hand[4].y < hand[2].y &&
                             hand[4].y < hand[1].y &&
                             hand[4].y < hand[0].y &&
                             hand[3].y< hand[5].y &&
                             hand[3].y <hand[9].y;
    return thumbPointingUp && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;

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
        lastGesture: lastGestureText,
        detectionRate: currentDetectionRate
    });
}

function detectHands(){
    const now = performance.now();
    currentDetectionRate = Math.round(now - lastFrameTime);
    lastFrameTime = now;

    const result= handLandmarker.detectForVideo(videoElement, performance.now());
    console.log(performance.now());
    if (result.landmarks.length === 0) {
        console.log("NO HAND DETECTED");
        // reset hold counters so a dropped hand doesn't carry over stale progress
        openPalmHoldCount = 0;
        pauseHoldCount = 0;
        screenShotHoldCount = 0;
        thumbsUpHoldCount = 0;
        pauseHoldCount = 0;
        pauseToggleFired = false;
        sendStatusUpdate(false, null);
        latestHand = null;
        setTimeout(detectHands, 100);
        return;
    }

    let hand=result.landmarks[0];
    fingers=getFingerState(hand);
    latestHand = hand;
    //console.log(fingers);


    //CHEKCING IF EVERYTHING NEEDS TO BE PAUSED
    const currentThumbsUp = isThumbsUpPose(fingers,hand);
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