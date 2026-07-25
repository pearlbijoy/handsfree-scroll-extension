import { HandLandmarker, FilesetResolver } from "./vision_bundle.mjs";

//detecting hand
let videoElement;
let handLandmarker;
let fingers;

//pause states
let isPaused = false;
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

//screenshot tracking
let screenShotHoldCount = 0;
let SCREENSHOT_HOLD_FRAMES = 6;
let screenShotToggleFired = false;

//for the detection rate
let lastFrameTime = performance.now();
let currentDetectionRate = 300;

//for the live feed view
let isFeedVisible = false;
let latestHand = null;    
let feedInterval = null;   
const feedCanvas = document.createElement("canvas");
feedCanvas.width = 400;
feedCanvas.height = 225;
const feedCtx = feedCanvas.getContext("2d");
const HAND_CONNECTIONS = [  //for the lines that connect all the landmarker points on the hand
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17]];

//checking if any messages from the panel were received
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "togglePauseFromPanel") {
        isPaused = !isPaused;
        console.log("Paused (from panel):", isPaused);
    }
    if (message.action === "setSensitivity") {
        FLICK_SCROLL_AMOUNT = message.value; 
    }
    if (message.action === "setHoldFrames") {
        HOLD_FRAMES_REQUIRED = message.value; 
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
            feedInterval = setInterval(drawFeedFrame, 100);   
        }
        if (!isFeedVisible && feedInterval) {
            clearInterval(feedInterval);
            feedInterval = null;
        }
    }
});


//Getting feed and loading model
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
    {baseOptions: {modelAssetPath: "./hand_landmarker.task"},runningMode: "VIDEO",numHands: 1} //Only detecting one hand.
    );
    if(handLandmarker){
        console.log("Landmarker object was created successfully.");
    }
    const handLandmarkerReady=true;
}


//Drawing the points over the live feed that is displayed via the panel
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


//For checking finger states(extended/curled)
function getDistance(hand,indexA,indexB){
    let dx=hand[indexA].x-hand[indexB].x;
    let dy=hand[indexA].y-hand[indexB].y;
    return Math.sqrt(dx*dx+dy*dy);
}

function isFingerExtendedByDistance(hand,tipIndex,knuckleIndex){
    const tipDist = getDistance(hand, tipIndex, 0);
    const knuckleDist = getDistance(hand, knuckleIndex, 0);
    return tipDist > knuckleDist * 1.3; 
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

//Updating the panel
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

//Main detection loop: runs on every camera frame, checks all gesture poses
function detectHands(){
    //For the detection rate
    const now = performance.now();
    currentDetectionRate = Math.round(now - lastFrameTime);
    lastFrameTime = now;

    const result= handLandmarker.detectForVideo(videoElement, performance.now());

    //For no hand in frame case
    if (result.landmarks.length === 0) { 
        //resetting hold counters so a dropped hand doesn't carry over previous variable
        openPalmHoldCount = 0;
        pauseHoldCount = 0;
        screenShotHoldCount = 0;
        thumbsUpHoldCount = 0;
        pauseHoldCount = 0;
        pauseToggleFired = false;
        latestHand = null;
        sendStatusUpdate(false, null);
        setTimeout(detectHands, 100);
        return;
    }

    //For hand in frame case:
    let hand=result.landmarks[0];
    fingers=getFingerState(hand);
    latestHand = hand;
    
    //For pausing tracking
    const currentThumbsUp = isThumbsUpPose(fingers,hand);
    if (currentThumbsUp) {
        thumbsUpHoldCount++;
        if (thumbsUpHoldCount >= THUMBS_UP_HOLD_FRAMES && !thumbsUpToggleFired) {
            isPaused = !isPaused;
            thumbsUpToggleFired = true;
            console.log("Paused:", isPaused);
        }
    } 
    else {
        thumbsUpHoldCount = 0;
        thumbsUpToggleFired = false;
    }

    //If tracking was not paused
    if(!isPaused){
        //Toggle Mode (scroll/action)
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
            scrollPauseToggleFired = false; // reset once palm pose is released
        }

        //SCROLL MODE
        if (!isScrollPaused) {
            const currentIndexOnly = isIndexOnlyPose(fingers);
            const currentIndexMiddle = isIndexMiddlePose(fingers);

            // scroll down
            if (currentIndexOnly && !wasIndexOnlyLastFrame) {
                chrome.runtime.sendMessage({scrollAmount: FLICK_SCROLL_AMOUNT}); 
                sendStatusUpdate(true, "Scrolled Down");
            }

            // scroll up
            if (!currentIndexMiddle && wasIndexMiddleLastFrame) {
                chrome.runtime.sendMessage({scrollAmount: -FLICK_SCROLL_AMOUNT}); 
                sendStatusUpdate(true, "Scrolled Up");
            }
            wasIndexOnlyLastFrame = currentIndexOnly;
            wasIndexMiddleLastFrame = currentIndexMiddle;
        }

        //ACTION MODE
        else{ 
            //Toggle video
            const currentPause = isPauseVideoPose(fingers);
            if (currentPause) {
                pauseHoldCount++; //counting how many frames the pose was held for
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

            //Screenshot
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
    setTimeout(detectHands, 100); //LOOPING THIS FUNCTION CONTINUOSLY
}

//To run all in order
async function main(){
    await getCamera();
    await loadHandLandmarker();
    detectHands();
}
main();