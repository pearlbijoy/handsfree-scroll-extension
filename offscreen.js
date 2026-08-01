import { HandLandmarker, FilesetResolver } from "./vision_bundle.mjs";

//detecting hand
let videoElement;
let handLandmarker;
let fingers;

//for switching modes
let openPalmHoldCount = 0;
let currentMode = "scroll"; // "scroll" | "action" | "nav"
let HOLD_FRAMES_REQUIRED = 6;
let scrollPauseToggleFired = false; 
const MODE_ORDER = ["scroll", "action", "nav"];

//mode palette state
let isPaletteOpen = false;
let selectedModeInPalette = null;
let paletteFistHoldCount = 0;
let PALETTE_FIST_HOLD_FRAMES = 4;
let paletteFistToggleFired = false;
let TILT_ANGLE_THRESHOLD = 12; // degrees, tune by testing

//Nav Mode: tab switching sub-state
let isTabSwitchSubState = false;
let lastTabDirection = null; // "next" | "prev" | null
let rockPoseHoldCount = 0;
let ROCK_POSE_HOLD_FRAMES = 5;
let rockPoseToggleFired = false;
let hasReturnedToCenter = true;
let TAB_TILT_THRESHOLD = 7; // degrees, tune by testing

//Back/forward via hand swipe
let wasGunCenterLastFrame = false;


//for scrolling up and down
let wasIndexOnlyLastFrame = false;
let wasIndexMiddleLastFrame = false;
let FLICK_SCROLL_AMOUNT = 400; 

//to pause everything
let isPaused = false;
let thumbsUpHoldCount = 0;
let thumbsUpToggleFired = false;
let THUMBS_UP_HOLD_FRAMES = 8;

//to pause/play yt video
let pauseHoldCount = 0;
let PAUSE_HOLD_FRAMES = 6; // ~1.5s
let pauseToggleFired = false;

//screenshot tracking
let screenShotHoldCount = 0;
let SCREENSHOT_HOLD_FRAMES = 6;
let screenShotToggleFired = false;

//Reload related
let reloadHoldCount = 0;
let RELOAD_HOLD_FRAMES = 8; 
let reloadToggleFired = false;

//Zoom related
let PINCH_THRESHOLD = 0.06;
let wasZoomInStart = false;
let wasZoomOutStart = false;

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
        currentMode = message.mode;
        console.log("Mode set from panel:", currentMode);
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

function getNeighborMode(mode, direction) {
    const currentIndex = MODE_ORDER.indexOf(mode);
    const offset = direction === "right" ? 1 : -1;
    const newIndex = (currentIndex + offset + MODE_ORDER.length) % MODE_ORDER.length;
    return MODE_ORDER[newIndex];
}

function getPalmTiltAngle(hand) {
    const wrist = hand[0];
    const middleKnuckle = hand[9];
    const dx = middleKnuckle.x - wrist.x;
    const dy = middleKnuckle.y - wrist.y;
    const radians = Math.atan2(dx, -dy);
    return -(radians * (180 / Math.PI)); //flipped as the model does not mirror the actions on its own.
}

//defining the gestures
//COMMON
function isThumbsUpPose(fingers,hand) { //to ensure that it is an actual thumbs UP position and not thumb sideways position
    const thumbPointingUp =  hand[4].y < hand[2].y &&
                             hand[4].y < hand[1].y &&
                             hand[4].y < hand[0].y &&
                             hand[2].y< hand[9].y &&
                             hand[3].y <hand[5].y;
    const verticalDistance = Math.abs(hand[4].y - hand[2].y);
    const horizontalDrift = Math.abs(hand[4].x - hand[2].x);
    const isMostlyVertical = horizontalDrift < verticalDistance * 0.4

    return thumbPointingUp && isMostlyVertical && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;

}

function isOpenPalmPose(fingers) {
    return fingers.thumb && fingers.index && fingers.middle && fingers.ring && fingers.pinky;
}

//ACTION MODE
function isScreenShotPose(fingers) {
    return !fingers.thumb && fingers.index && fingers.middle && !fingers.ring && !fingers.pinky;
}

function isPauseVideoPose(fingers) {
    return !fingers.thumb && !fingers.index && !fingers.pinky && !fingers.middle && !fingers.ring;
}

function isReloadPose(fingers){
    return fingers.index && fingers.middle && fingers.ring && fingers.pinky &&!fingers.thumb 
}

//SCROLL MODE
function isIndexOnlyPose(fingers) {
    return fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;
}

function isIndexMiddlePose(fingers) {
    return fingers.index && fingers.middle && !fingers.ring && !fingers.pinky;
}

function isStartZoomInPose(fingers, hand) {
    return getDistance(hand, 4, 8) < PINCH_THRESHOLD
        && !fingers.middle && !fingers.ring && !fingers.pinky;
}

function isFinishZoomInPose(fingers) {
    return fingers.thumb && fingers.index
        && !fingers.middle && !fingers.ring && !fingers.pinky;
}

function isStartZoomOutPose(fingers) {
    return fingers.thumb && fingers.index && fingers.middle
        && !fingers.ring && !fingers.pinky;
}

function isFinishZoomOutPose(fingers, hand) {
    return getDistance(hand, 4, 8) < PINCH_THRESHOLD
        && getDistance(hand, 4, 12) < PINCH_THRESHOLD
        && !fingers.ring && !fingers.pinky;
}

//NAV MODE
function isRockPose(fingers) {
    return !fingers.thumb && fingers.index && !fingers.middle && !fingers.ring && fingers.pinky;
}

function isRockPoseThumbOut(fingers) {
    return fingers.thumb && fingers.index && !fingers.middle && !fingers.ring && fingers.pinky;
}

function getIndexTiltAngle(hand) {
    const knuckle = hand[5];
    const tip = hand[8];
    const dx = tip.x - knuckle.x;
    const dy = tip.y - knuckle.y;
    const radians = Math.atan2(dx, -dy);
    return -(radians * (180 / Math.PI)); // flipped to match user's own left/right, same as getPalmTiltAngle
}

function isFingerGunPose(fingers) {
    return fingers.thumb && fingers.index && fingers.middle && !fingers.ring && !fingers.pinky;
}

function classifyGunDirection(hand) {
    const angle = getIndexTiltAngle(hand); // reuse existing function
    if (angle > 10) return "right";
    if (angle < -10) return "left";
    return "center";
}

//Updating the panel
function sendStatusUpdate(handDetected, lastGestureText) {
    chrome.runtime.sendMessage({
        type: "statusUpdate",
        handDetected: handDetected,
        isPaused: isPaused,
        currentMode: currentMode,
        isTabSwitchSubState: isTabSwitchSubState, 
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
        reloadHoldCount = 0;
        paletteFistHoldCount = 0; 
        rockPoseHoldCount = 0;
        rockPoseToggleFired = false;
        paletteFistToggleFired = false;
        wasZoomInStart = false; 
        wasZoomOutStart = false;
        pauseToggleFired = false;
        screenShotToggleFired =false;
        latestHand = null;
        lastTabDirection = null;
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
        //Open palm: opens mode palette
        const currentOpenPalm = isOpenPalmPose(fingers);
        if (currentOpenPalm) {
            openPalmHoldCount++;
            if (openPalmHoldCount >= HOLD_FRAMES_REQUIRED && !scrollPauseToggleFired) {
                isPaletteOpen = true;
                selectedModeInPalette = currentMode;
                scrollPauseToggleFired = true;
                chrome.runtime.sendMessage({action: "openModePalette", currentMode});
                console.log("Palette opened, current mode:", currentMode);
            }
        } 
        else {
            openPalmHoldCount = 0;
            scrollPauseToggleFired = false;
        }

        //While palette is open: track tilt, confirm after a held beat
        if (isPaletteOpen) {
            const isFist = !fingers.thumb && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky;

            if (isFist) {
                paletteFistHoldCount++;
                if (paletteFistHoldCount >= PALETTE_FIST_HOLD_FRAMES && !paletteFistToggleFired) {
                    currentMode = selectedModeInPalette;
                    paletteFistToggleFired = true;
                    isPaletteOpen = false;
                    chrome.runtime.sendMessage({action: "closeModePalette"});
                    chrome.runtime.sendMessage({action: "modeChanged", mode: currentMode});
                    console.log("Mode confirmed:", currentMode);
                }
            } else {
                paletteFistHoldCount = 0;
                paletteFistToggleFired = false;

                const tiltAngle = getPalmTiltAngle(hand);
                let candidateMode;
                if (tiltAngle > TILT_ANGLE_THRESHOLD) candidateMode = getNeighborMode(currentMode, "right");
                else if (tiltAngle < -TILT_ANGLE_THRESHOLD) candidateMode = getNeighborMode(currentMode, "left");
                else candidateMode = currentMode;

                if (candidateMode !== selectedModeInPalette) {
                    selectedModeInPalette = candidateMode;
                    chrome.runtime.sendMessage({action: "highlightMode", mode: candidateMode});
                }
            }
        }
        
        if (!isPaletteOpen) {
            //SCROLL MODE
            if (currentMode === "scroll") {
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
            else if(currentMode === "action"){ 
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

                //Reload
                const currentReload = isReloadPose(fingers);
                if (currentReload) {
                    reloadHoldCount++;
                    if (reloadHoldCount >= RELOAD_HOLD_FRAMES && !reloadToggleFired) {
                        chrome.runtime.sendMessage({action: "reload"});
                        sendStatusUpdate(true, "Reloaded Page");
                        reloadToggleFired = true;
                        console.log("Reloaded Page");
                    }
                } 
                else {
                    reloadHoldCount = 0;
                    reloadToggleFired = false;
                }

                const startZoomIn = isStartZoomInPose(fingers, hand);
                const finishZoomIn = isFinishZoomInPose(fingers);

                if (finishZoomIn && wasZoomInStart) {
                    chrome.runtime.sendMessage({action: "zoomIn"});
                }
                wasZoomInStart = startZoomIn || (wasZoomInStart && !finishZoomIn);

                const startZoomOut = isStartZoomOutPose(fingers);
                const finishZoomOut = isFinishZoomOutPose(fingers, hand);

                if (finishZoomOut && wasZoomOutStart) {
                    chrome.runtime.sendMessage({action: "zoomOut"});
                    sendStatusUpdate(true, "Zoomed Out");
                }
                wasZoomOutStart = startZoomOut || (wasZoomOutStart && !finishZoomOut);

            }

            //NAV MODE
            else if (currentMode === "nav") {
                const currentRockPose = isRockPoseThumbOut(fingers);
                if (currentRockPose) {
                    rockPoseHoldCount++;
                    if (rockPoseHoldCount >= ROCK_POSE_HOLD_FRAMES && !rockPoseToggleFired) {
                        isTabSwitchSubState = !isTabSwitchSubState;
                        rockPoseToggleFired = true;
                        console.log("Tab-switch sub-state:", isTabSwitchSubState);
                    }
                } 
                else {
                    rockPoseHoldCount = 0;
                    rockPoseToggleFired = false;
                }

                if (isTabSwitchSubState) {
                    const isLShape = isRockPose(fingers);
                    if (isLShape) {
                        const angle = getIndexTiltAngle(hand);

                        if (angle > TAB_TILT_THRESHOLD && (hasReturnedToCenter || lastTabDirection !== "next")) {
                            chrome.runtime.sendMessage({action: "nextTab"});
                            sendStatusUpdate(true, "Next Tab");
                            hasReturnedToCenter = false;
                            lastTabDirection = "next";
                        } 
                        else if (angle < -TAB_TILT_THRESHOLD && (hasReturnedToCenter || lastTabDirection !== "prev")) {
                            chrome.runtime.sendMessage({action: "prevTab"});
                            sendStatusUpdate(true, "Previous Tab");
                            hasReturnedToCenter = false;
                            lastTabDirection = "prev";
                        } 
                        else if (Math.abs(angle) < TAB_TILT_THRESHOLD / 2) {
                            hasReturnedToCenter = true;
                        }
                    }
                }

                //Backward: index-only, swipe from user's left to user's right
                const currentFingerGun = isFingerGunPose(fingers);
                if (currentFingerGun) {
                    console.log("finger gun")
                    const direction = classifyGunDirection(hand);
                    console.log(`${direction}`)
                    if (direction === "left" && wasGunCenterLastFrame) {
                        console.log("FIRING go");
                        chrome.runtime.sendMessage({action: "goBack"});
                        sendStatusUpdate(true, "Back");
                    } else if (direction === "right" && wasGunCenterLastFrame) {
                        console.log("FIRING goForward");
                        chrome.runtime.sendMessage({action: "goForward"});
                        sendStatusUpdate(true, "Forward");
                    }

                    wasGunCenterLastFrame = (direction === "center");
                } else {
                    wasGunCenterLastFrame = false;
                }
                
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