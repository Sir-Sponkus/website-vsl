import type { HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { CapturedFrame, Point } from './pipeline';

function toPoint(point: { x: number; y: number; z?: number }): Point {
	return {
		x: point.x,
		y: point.y,
		z: point.z
	};
}

function emptyPoints(count: number): Point[] {
	return Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0 }));
}

export function detectFrame(
	video: HTMLVideoElement,
	poseLandmarker: PoseLandmarker,
	handLandmarker: HandLandmarker,
	timestamp: number
): CapturedFrame {
	const poseResult = poseLandmarker.detectForVideo(video, timestamp);
	const handResult = handLandmarker.detectForVideo(video, timestamp);

	const pose =
		poseResult.landmarks?.[0]?.slice(0, 33).map(toPoint) ?? emptyPoints(33);

	let leftHand = emptyPoints(21);
	let rightHand = emptyPoints(21);

	for (let index = 0; index < (handResult.landmarks?.length ?? 0); index += 1) {
		const handedness = handResult.handedness?.[index]?.[0]?.categoryName;
		const landmarks = handResult.landmarks?.[index]?.slice(0, 21).map(toPoint);

		if (!landmarks || landmarks.length !== 21) {
			continue;
		}

		if (handedness === 'Left') {
			leftHand = landmarks;
		} else if (handedness === 'Right') {
			rightHand = landmarks;
		}
	}

	return {
		pose,
		leftHand,
		rightHand
	};
}