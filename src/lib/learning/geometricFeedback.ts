import { i18n } from '$lib/i18n/i18n.svelte';

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
	title: string;
	message: string;
	severity: 'low' | 'medium' | 'high';
};

export type PracticeResult = {
	status: 'correct' | 'close' | 'needs-improvement';
	score: number;
	summary: string;
	confidence: number;
	issues: PracticeIssue[];
	feedback: string[];
};

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

	const visibility = (leftHand ? 0.5 : 0) + (rightHand ? 0.5 : 0) + (pose.length > 0 ? 0.1 : 0);

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

export function evaluatePracticeAttempt(
	metrics: PracticeMetrics,
	selectedWord: string
): PracticeResult {
	const targetHeight = 0.15;
	const targetGap = 0.8;
	const targetSpread = 0.4;
	const targetOpen = 0.28;

	let score = 100;
	const issues: PracticeIssue[] = [];

	const leftHeightDelta = Math.abs(metrics.leftHandY - targetHeight);
	const rightHeightDelta = Math.abs(metrics.rightHandY - targetHeight);

	if (leftHeightDelta > 0.12 || rightHeightDelta > 0.12) {
		issues.push({
			id: 'height',
			title: i18n.t.issueHeightTitle,
			message: i18n.t.issueHeightMessage,
			severity: 'medium'
		});
		score -= Math.max(8, (leftHeightDelta + rightHeightDelta) * 100);
	}

	const gapDelta = Math.abs(metrics.handGap - targetGap * metrics.shoulderWidth);
	if (gapDelta > 0.12 * metrics.shoulderWidth) {
		issues.push({
			id: 'spacing',
			title: i18n.t.issueSpacingTitle,
			message: i18n.t.issueSpacingMessage,
			severity: 'medium'
		});
		score -= 12;
	}

	const leftSpreadDelta = Math.abs(metrics.leftSpread - targetSpread);
	const rightSpreadDelta = Math.abs(metrics.rightSpread - targetSpread);
	if (leftSpreadDelta > 0.15 || rightSpreadDelta > 0.15) {
		issues.push({
			id: 'spread',
			title: i18n.t.issueSpreadTitle,
			message: i18n.t.issueSpreadMessage,
			severity: 'high'
		});
		score -= Math.max(10, (leftSpreadDelta + rightSpreadDelta) * 80);
	}

	const leftOpenDelta = Math.abs(metrics.leftOpen - targetOpen);
	const rightOpenDelta = Math.abs(metrics.rightOpen - targetOpen);
	if (leftOpenDelta > 0.12 || rightOpenDelta > 0.12) {
		issues.push({
			id: 'open',
			title: i18n.t.issueOpenTitle,
			message: i18n.t.issueOpenMessage,
			severity: 'medium'
		});
		score -= Math.max(8, (leftOpenDelta + rightOpenDelta) * 70);
	}

	if (metrics.confidence < 0.5) {
		issues.push({
			id: 'visibility',
			title: i18n.t.issueVisibilityTitle,
			message: i18n.t.issueVisibilityMessage,
			severity: 'high'
		});
		score -= 15;
	}

	score = clamp(score, 0, 100);

	let status: PracticeResult['status'] = 'correct';
	if (score < 60) status = 'needs-improvement';
	else if (score < 82) status = 'close';

	const feedback = [
		i18n.t.practicingWord(selectedWord),
		status === 'correct'
			? i18n.t.feedbackCorrect
			: status === 'close'
				? i18n.t.feedbackClose
				: i18n.t.feedbackNeedsImprovement
	];

	const summary =
		status === 'correct'
			? i18n.t.summaryCorrect
			: status === 'close'
				? i18n.t.summaryClose
				: i18n.t.summaryNeedsImprovement;

	return {
		status,
		score: Math.round(score),
		summary,
		confidence: clamp(metrics.confidence, 0, 1),
		issues: issues.slice(0, 3),
		feedback
	};
}