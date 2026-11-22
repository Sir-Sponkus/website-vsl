# website-vsl

## Overview
VSLink is a browser-based tool for hearing people who want to learn Vietnamese Sign Language (VSL). It has two modes:

- **Learn**: pick a word from the dictionary, watch its reference video, then record yourself signing it with your webcam. After recording (up to 10 seconds) the sign is classified by a SPOTER-style ONNX model and you see how confident the model is that you signed the selected word, plus a check that your hands stayed visible to the camera.
- **Translate**: sign in front of the camera (or upload a video) and the model lists its top predictions for the recorded gesture.

Body and hand landmarks are extracted in the browser with MediaPipe (pose + hands) and fed to the ONNX model through onnxruntime-web, so no video leaves your device. The interface is available in English and Vietnamese.

## Features
- Recognizes Vietnamese Sign Language via a live camera feed or video file.
- Runs entirely client-side by using GPU acceleration.
- Hotswap any sign language recognition model (.onnx).

## Requirements
- **Software**: 
    - npm 11.17.0 (Any modern version should be fine)
- **Hardware**:
    - Webcam (Used for the webcam feature)
    - GPU (Prefered, if not it will just use software acceleration instead)

## Usage
### 1. Clone the repository
```bash
git clone https://github.com/Sir-Sponkus/website-vsl
cd website-vsl
```
### 2. Install the dependencies
```bash
npm install
```

### 3. Run the website
```bash
npm run dev
```