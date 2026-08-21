# HoverNav

A Manifest V3 Chrome extension that lets you scroll, take screenshots, and control video playback using hand gestures : no mouse, no keyboard. Built with MediaPipe's HandLandmarker running entirely in-browser, with a live landmark-tracking view so you can see exactly how your hand is being read.

*Full demo GIF coming soon*

## Why this exists

Most "gesture control" browser extensions are static-pose demos: hold up a peace sign, something happens. This one is a stateful system with three operating modes (Scroll, Action, Nav), a visual mode-selection palette you navigate entirely by hand tilt, a debouncing layer that filters out the noise real webcam hand-tracking produces frame to frame, and a live feed panel that visualizes the actual tracking data driving it.


## The scroll redesign: continuous vs. discrete

The first version of scroll mapped hand motion directly to `scrollBy` deltas, continuously, frame by frame; move your hand down, the page scrolls down, proportional to how far you moved. It looked good on paper and felt terrible in practice: MediaPipe's landmark coordinates jitter slightly even when your hand is still, and that jitter reads as motion. Worse, the natural motion of closing your hand into a fist (to switch gestures) got misread as a scroll gesture mid-transition, causing scroll to fire when you didn't intend it to.

The fix was to stop tracking *motion* and start tracking *state transitions*. Instead of asking "how far did the hand move this frame," the extension now asks "did the finger pose just change from curled to extended (or vice versa)." A scroll-down only fires on the rising edge of the index-only pose; scroll-up only fires on the falling edge of the index-middle pose. This is:

- **Speed-independent** - a fast flick and a slow one produce the same single scroll event
- **Self-correcting per frame** - a jittery landmark reading in one frame doesn't compound, because each frame is only compared to the last, not accumulated
- **Immune to transition noise** - closing a fist doesn't fire a phantom scroll, because it's not a valid pose-to-pose edge for that gesture

This is the same core pattern (hold-frame counting + a fired/reset lock, so a pose has to be *held*, not just glimpsed, before it triggers) used for every other gesture in the extension: thumbs-up pause, palm-hold mode switch, fist-hold video toggle, and the screenshot gesture.

## Modes

HoverNav has three modes, switched via a visual mode palette (hold an open palm, tilt to preview a neighboring mode, hold a fist to confirm):

- **Scroll Mode** — scroll the page up/down with finger gestures
- **Action Mode** — screenshot, play/pause video, reload, zoom in/out
- **Nav Mode** — switch between browser tabs

A couple of gestures (pause/resume detection, opening the mode palette) work globally regardless of mode.

For the full gesture-by-gesture breakdown, open `guide.html` from the extension panel — it's the source of truth and stays in sync with the current gesture set as it evolves.

Scroll sensitivity is adjustable live from the on-page status panel.

## Live feed panel

A separate, draggable panel shows your webcam feed with the detected hand skeleton drawn on top in real time: useful both for the user ("watch it actually track my hand") and as a debugging tool while tuning gesture thresholds.

## Detection rate

The status panel shows a live, measured detection rate (`performance.now()` delta between successive detection cycles). In practice this typically runs somewhere in the 150-300ms range and fluctuates frame to frame since it reflects real MediaPipe inference time plus normal JS event-loop scheduling.

## Architecture

```
manifest.json       — MV3 config, permissions, CSP for MediaPipe WASM
popup.html/js         — camera on/off toggle
offscreen.html/js     — camera stream + MediaPipe detection loop + all gesture logic + live feed rendering
background.js        — message relay between offscreen, content scripts, and tabs; opens guide.html as a tab
content.js           — injects the status panel, executes page-facing actions (scroll, video, tabs, zoom)
panel.html/css       — floating status panel, live feed panel, and mode-selection palette
guide.html           — standalone gesture reference page, opened in a new tab
```

## Limitations

- **Video toggle targets `document.querySelector("video")`**, so it works reliably on plain HTML5 video and YouTube, but may not pick the right element on pages with multiple videos or custom players.

## Setup

1. Clone this repo (`git clone https://github.com/pearlbijoy/HoverNav.git`)
2. Go to `chrome://extensions`, enable Developer Mode
3. "Load unpacked" → select the repo folder
4. Click the extension icon → Enable Camera
5. Grant camera permission when prompted

No build step or package manager required — this runs as plain JS/HTML/CSS loaded directly by Chrome.

## Tech stack

- MediaPipe Tasks Vision (`HandLandmarker`) 
- Vanilla JS, Manifest V3 Chrome Extensions API

## Future features

- Multi-video toggle handling (disambiguate when a page has more than one `<video>`)
- Gesture-controlled cursor (absolute position mapping)
- Gesture-triggered quicklinks (Gmail, Gemini, etc.)
- Voice command mode (explored, deferred — larger scope than a typical gesture feature)

## License

MIT