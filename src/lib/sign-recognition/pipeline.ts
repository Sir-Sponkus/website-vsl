export const TARGET_FRAMES = 60;
export const POSE_JOINTS = 33;
export const HAND_JOINTS = 21;
export const TOTAL_JOINTS = 75;
export const CHANNELS = 6;

export type Point = {
	x: number;
	y: number;
	z?: number;
};

export type CapturedFrame = {
	pose: Point[];
	leftHand: Point[];
	rightHand: Point[];
};

export type Prediction = {
	label: string;
	confidence: number;
	index: number;
};

const EMPTY_HAND = (): Point[] =>
	Array.from({ length: HAND_JOINTS }, () => ({ x: 0, y: 0, z: 0 }));

const EMPTY_POSE = (): Point[] =>
	Array.from({ length: POSE_JOINTS }, () => ({ x: 0, y: 0, z: 0 }));

export const EMPTY_FRAME = (): CapturedFrame => ({
	pose: EMPTY_POSE(),
	leftHand: EMPTY_HAND(),
	rightHand: EMPTY_HAND()
});

const PARENT_INDEX: number[] = (() => {
	const parents = Array.from({ length: TOTAL_JOINTS }, (_, index) => index);

	const poseParents: Record<number, number> = {
		11: 11,
		12: 11,
		0: 11,
		13: 11,
		15: 13,
		17: 15,
		19: 15,
		21: 15,
		14: 12,
		16: 14,
		18: 16,
		20: 16,
		22: 16,
		23: 11,
		24: 12,
		25: 23,
		26: 24,
		27: 25,
		28: 26,
		29: 27,
		30: 28,
		31: 29,
		32: 30,
		1: 0,
		2: 1,
		3: 2,
		4: 0,
		5: 4,
		6: 5,
		7: 3,
		8: 6,
		9: 0,
		10: 0
	};

	for (const [child, parent] of Object.entries(poseParents)) {
		parents[Number(child)] = parent;
	}

	const handParents = [0, 0, 1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 0, 17, 18, 19];

	for (let index = 0; index < HAND_JOINTS; index += 1) {
		parents[33 + index] = index === 0 ? 15 : 33 + handParents[index];
		parents[54 + index] = index === 0 ? 16 : 54 + handParents[index];
	}

	return parents;
})();

function clean(value: number | undefined): number {
	return Number.isFinite(value) ? Number(value) : 0;
}

function pointXY(point: Point | undefined): [number, number] {
	return [clean(point?.x), clean(point?.y)];
}

function normalizeFrame(frame: CapturedFrame): number[][] {
	const pose = frame.pose.length >= POSE_JOINTS ? frame.pose : EMPTY_POSE();
	const leftHand = frame.leftHand.length >= HAND_JOINTS ? frame.leftHand : EMPTY_HAND();
	const rightHand = frame.rightHand.length >= HAND_JOINTS ? frame.rightHand : EMPTY_HAND();

	const leftShoulder = pointXY(pose[11]);
	const rightShoulder = pointXY(pose[12]);

	const centerX = (leftShoulder[0] + rightShoulder[0]) / 2;
	const centerY = (leftShoulder[1] + rightShoulder[1]) / 2;

	const shoulderWidth = Math.max(
		Math.hypot(leftShoulder[0] - rightShoulder[0], leftShoulder[1] - rightShoulder[1]),
		0.00001
	);

	const joints = [
		...pose.slice(0, POSE_JOINTS),
		...leftHand.slice(0, HAND_JOINTS),
		...rightHand.slice(0, HAND_JOINTS)
	];

	return joints.map((point) => {
		const [x, y] = pointXY(point);
		return [(x - centerX) / shoulderWidth, (y - centerY) / shoulderWidth];
	});
}

export function resampleFrames(
	frames: CapturedFrame[],
	targetLength = TARGET_FRAMES
): CapturedFrame[] {
	if (frames.length === 0) {
		return Array.from({ length: targetLength }, () => EMPTY_FRAME());
	}

	if (frames.length === targetLength) {
		return frames;
	}

	return Array.from({ length: targetLength }, (_, index) => {
		const sourceIndex = Math.min(
			frames.length - 1,
			Math.floor((index * (frames.length - 1)) / Math.max(targetLength - 1, 1))
		);

		return frames[sourceIndex];
	});
}

export function buildTensorData(frames: CapturedFrame[]): Float32Array {
	const sequence = resampleFrames(frames);
	const normalized = sequence.map(normalizeFrame);
	const tensor = new Float32Array(TARGET_FRAMES * TOTAL_JOINTS * CHANNELS);

	let offset = 0;

	for (let time = 0; time < TARGET_FRAMES; time += 1) {
		for (let joint = 0; joint < TOTAL_JOINTS; joint += 1) {
			const x = normalized[time][joint][0];
			const y = normalized[time][joint][1];

			const parent = PARENT_INDEX[joint];
			const parentX = normalized[time][parent][0];
			const parentY = normalized[time][parent][1];

			const next = normalized[Math.min(time + 1, TARGET_FRAMES - 1)];
			const nextX = next[joint][0];
			const nextY = next[joint][1];

			tensor[offset++] = x;
			tensor[offset++] = y;
			tensor[offset++] = x - parentX;
			tensor[offset++] = y - parentY;
			tensor[offset++] = nextX - x;
			tensor[offset++] = nextY - y;
		}
	}

	return tensor;
}

function softmax(logits: Float32Array): number[] {
	let maximum = -Infinity;

	for (const value of logits) {
		maximum = Math.max(maximum, value);
	}

	const probabilities = logits.map((value) => Math.exp(value - maximum));
	const total = probabilities.reduce((sum, value) => sum + value, 0);

	return Array.from(probabilities, (value) => value / total);
}

export async function classifyFrames(
	session: import('onnxruntime-web').InferenceSession,
	frames: CapturedFrame[],
	labels: string[]
): Promise<Prediction[]> {
	const inputName = session.inputNames[0] ?? 'input';
	const outputName = session.outputNames[0] ?? 'output';

	const tensor = buildTensorData(frames);
	const input = new (await import('onnxruntime-web')).Tensor(
		'float32',
		tensor,
		[1, TARGET_FRAMES, TOTAL_JOINTS, CHANNELS]
	);

	const outputs = await session.run({
		[inputName]: input
	});

	const logits = outputs[outputName].data as Float32Array;
	const probabilities = softmax(logits);

	return probabilities
		.map((confidence, index) => ({
			index,
			label: labels[index] ?? `Class ${index}`,
			confidence
		}))
		.sort((left, right) => right.confidence - left.confidence)
		.slice(0, 5);
}