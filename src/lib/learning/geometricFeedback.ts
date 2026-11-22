import type { MsgKey } from '$lib/i18n/i18n.svelte';
import type { CapturedFrame } from '$lib/sign-recognition/pipeline';

export type PracticeMetrics = {
	shoulderWidth: number;
	leftHandY: number;
	rightHandY: number;
	handGap: number;
	leftSpread: number;
	rightSpread: number;
	leftOpen: number;
	rightOpen: number;
	confidence: number;
};

export type PracticeIssue = {
	id: string;
	titleKey: MsgKey;
	messageKey: MsgKey;
	severity: 'low' | 'medium' | 'high';
};

export type PracticeResult = {
	score: number;
	confidence: number;
	issues: PracticeIssue[];
};

// Fraction of frames in which hands were detected below which we ask the user to adjust.
// One-handed signs legitimately score 0.5.
const VISIBILITY_THRESHOLD = 0.35;

type LandmarkPoint = { x: number; y: number; z?: number };

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function distance(a: LandmarkPoint, b: LandmarkPoint) {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function mean(values: number[]) {
	return values.length ? values.reduce((sum, entry) => sum + entry, 0) / values.length : 0;
}

export function buildMetricsFromLandmarks(
	pose: LandmarkPoint[] | null | undefined,
	leftHand: LandmarkPoint[] | null | undefined,
	rightHand: LandmarkPoint[] | null | undefined
): PracticeMetrics | null {
	if (!pose || pose.length < 33) return null;

	const leftShoulder = pose[11] ?? pose[0];
	const rightShoulder = pose[12] ?? pose[0];
	const shoulderCenter = {
		x: (leftShoulder.x + rightShoulder.x) / 2,
		y: (leftShoulder.y + rightShoulder.y) / 2
	};
	const shoulderWidth = distance(leftShoulder, rightShoulder) || 1;

	const leftWrist = leftHand && leftHand[0] ? leftHand[0] : pose[15] ?? pose[0];
	const rightWrist = rightHand && rightHand[0] ? rightHand[0] : pose[16] ?? pose[0];
	const leftHandY = leftWrist.y - shoulderCenter.y;
	const rightHandY = rightWrist.y - shoulderCenter.y;
	const handGap = distance(leftWrist, rightWrist);

	const extractSpread = (hand: LandmarkPoint[] | null | undefined) => {
		if (!hand || hand.length < 5) return 0;
		const xs = hand.map((p) => p.x);
		const ys = hand.map((p) => p.y);
		return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
	};

	const leftSpread = extractSpread(leftHand);
	const rightSpread = extractSpread(rightHand);

	const leftOpen =
		leftHand && leftHand.length > 8
			? mean([
					distance(leftHand[0], leftHand[5]),
					distance(leftHand[0], leftHand[9]),
					distance(leftHand[0], leftHand[13]),
					distance(leftHand[0], leftHand[17])
			  ])
			: 0.1;

	const rightOpen =
		rightHand && rightHand.length > 8
			? mean([
					distance(rightHand[0], rightHand[5]),
					distance(rightHand[0], rightHand[9]),
					distance(rightHand[0], rightHand[13]),
					distance(rightHand[0], rightHand[17])
			  ])
			: 0.1;

	// Missing detections arrive as arrays of all-zero points, so check for real coordinates.
	const present = (points: LandmarkPoint[] | null | undefined) =>
		!!points && points.some((p) => p.x !== 0 || p.y !== 0);
	const visibility = present(pose)
		? (present(leftHand) ? 0.5 : 0) + (present(rightHand) ? 0.5 : 0)
		: 0;

	return {
		shoulderWidth,
		leftHandY,
		rightHandY,
		handGap,
		leftSpread,
		rightSpread,
		leftOpen,
		rightOpen,
		confidence: clamp(visibility, 0.1, 1)
	};
}

/**
 * Averages per-frame metrics. `aspect` (width / height of the source video) puts x and y in the
 * same units, so the learner's 4:3 camera and the square reference videos are comparable.
 */
export function averageMetrics(frames: CapturedFrame[], aspect = 1): PracticeMetrics | null {
	const squared = (points: LandmarkPoint[]) => points.map((p) => ({ x: p.x * aspect, y: p.y }));
	const metrics = frames
		// Frames without a detected body arrive as all-zero points and would skew the average.
		.filter((frame) => frame.pose.some((p) => p.x !== 0 || p.y !== 0))
		.map((frame) =>
			buildMetricsFromLandmarks(squared(frame.pose), squared(frame.leftHand), squared(frame.rightHand))
		)
		.filter((value): value is PracticeMetrics => value !== null);

	if (metrics.length === 0) return null;

	const average = (key: keyof PracticeMetrics) =>
		metrics.reduce((sum, value) => sum + value[key], 0) / metrics.length;

	return {
		shoulderWidth: average('shoulderWidth'),
		leftHandY: average('leftHandY'),
		rightHandY: average('rightHandY'),
		handGap: average('handGap'),
		leftSpread: average('leftSpread'),
		rightSpread: average('rightSpread'),
		leftOpen: average('leftOpen'),
		rightOpen: average('rightOpen'),
		confidence: average('confidence')
	};
}

// Hands are compared by role, not by side: the "active" hand is the one held higher. This is
// independent of camera mirroring, MediaPipe's handedness labels and left-handed signers, none
// of which should count as an error. shortcut: assumes the higher hand is the signing hand.
function describe(m: PracticeMetrics) {
	const leftIsActive = m.leftHandY <= m.rightHandY;
	const w = m.shoulderWidth || 1;
	return {
		height: (leftIsActive ? m.leftHandY : m.rightHandY) / w,
		spread: (leftIsActive ? m.leftSpread : m.rightSpread) / w,
		gap: m.handGap / w,
		hands: m.confidence
	};
}

const TWO_HANDS = 0.7;

const issue = (
	id: string,
	titleKey: MsgKey,
	messageKey: MsgKey,
	severity: PracticeIssue['severity'] = 'medium'
): PracticeIssue => ({ id, titleKey, messageKey, severity });

/**
 * Checks visibility, then (when the word's reference video was analysed) compares the learner's
 * averaged metrics with it. Tolerances grow with the reference value, so they are relative to it.
 * Without a reference only visibility is checked.
 */
export function evaluatePracticeAttempt(
	metrics: PracticeMetrics,
	reference?: PracticeMetrics | null
): PracticeResult {
	const issues: PracticeIssue[] = [];

	if (metrics.confidence < VISIBILITY_THRESHOLD) {
		issues.push(issue('visibility', 'issueVisibilityTitle', 'issueVisibilityMessage', 'high'));
	} else if (reference) {
		const you = describe(metrics);
		const ref = describe(reference);

		if (you.hands < ref.hands - 0.3) {
			issues.push(issue('hands', 'issueHandCountTitle', 'issueFewerHandsMessage'));
		} else if (you.hands > ref.hands + 0.3) {
			issues.push(issue('hands', 'issueHandCountTitle', 'issueMoreHandsMessage'));
		}

		// Positive = lower than the reference (y grows downwards), in shoulder widths.
		const heightTol = 0.3 + 0.3 * Math.abs(ref.height);
		if (you.height - ref.height > heightTol) {
			issues.push(issue('height', 'issueHeightTitle', 'issueHandsLowMessage'));
		} else if (ref.height - you.height > heightTol) {
			issues.push(issue('height', 'issueHeightTitle', 'issueHandsHighMessage'));
		}

		if (you.hands >= TWO_HANDS && ref.hands >= TWO_HANDS) {
			const gapTol = 0.3 + 0.3 * ref.gap;
			if (you.gap - ref.gap > gapTol) {
				issues.push(issue('gap', 'issueGapTitle', 'issueHandsApartMessage'));
			} else if (ref.gap - you.gap > gapTol) {
				issues.push(issue('gap', 'issueGapTitle', 'issueHandsTogetherMessage'));
			}
		}

		if (ref.spread > 0.05 && you.spread > 0) {
			const ratio = you.spread / ref.spread;
			if (ratio < 0.6) issues.push(issue('shape', 'issueShapeTitle', 'issueHandClosedMessage'));
			else if (ratio > 1.6) issues.push(issue('shape', 'issueShapeTitle', 'issueHandOpenMessage'));
		}
	}

	const penalty = issues.reduce((sum, i) => sum + (i.severity === 'high' ? 30 : 15), 0);

	return {
		score: Math.round(clamp(100 - penalty, 0, 100)),
		confidence: clamp(metrics.confidence, 0, 1),
		issues
	};
}
