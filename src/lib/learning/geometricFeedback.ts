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

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function distance(a: LandmarkPoint, b: LandmarkPoint): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function mean(values: number[]): number {
	return values.length ? values.reduce((sum, entry) => sum + entry, 0) / values.length : 0;
}

export function buildMetricsFromLandmarks(
	pose: LandmarkPoint[] | null | undefined,
	leftHand: LandmarkPoint[] | null | undefined,
	rightHand: LandmarkPoint[] | null | undefined
): PracticeMetrics | null {
	if (!pose || pose.length < 33) {
		return null;
	}

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

	const extractSpread = (hand: LandmarkPoint[] | null | undefined): number => {
		if (!hand || hand.length < 5) {
			return 0;
		}
		const xs = hand.map((point) => point.x);
		const ys = hand.map((point) => point.y);
		return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
	};

	const leftSpread = extractSpread(leftHand);
	const rightSpread = extractSpread(rightHand);
	const leftOpen = leftHand && leftHand.length > 8 ? mean([distance(leftHand[0], leftHand[5]), distance(leftHand[0], leftHand[9]), distance(leftHand[0], leftHand[13]), distance(leftHand[0], leftHand[17])]) : 0.1;
	const rightOpen = rightHand && rightHand.length > 8 ? mean([distance(rightHand[0], rightHand[5]), distance(rightHand[0], rightHand[9]), distance(rightHand[0], rightHand[13]), distance(rightHand[0], rightHand[17])]) : 0.1;
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

	const issues: PracticeIssue[] = [];
	let score = 100;

	const leftHeightDelta = Math.abs(metrics.leftHandY - targetHeight);
	const rightHeightDelta = Math.abs(metrics.rightHandY - targetHeight);
	if (leftHeightDelta > 0.12 || rightHeightDelta > 0.12) {
		issues.push({
			id: 'height',
			title: 'Hand height',
			message: 'Your hands are sitting a little too high or too low. Bring them closer to the shoulder line.',
			severity: 'medium'
		});
		score -= Math.max(8, (leftHeightDelta + rightHeightDelta) * 100);
	}

	const gapDelta = Math.abs(metrics.handGap - targetGap * metrics.shoulderWidth);
	if (gapDelta > 0.12 * metrics.shoulderWidth) {
		issues.push({
			id: 'spacing',
			title: 'Hand spacing',
			message: 'Move your hands slightly closer together or farther apart to match the target shape.',
			severity: 'medium'
		});
		score -= 12;
	}

	const leftSpreadDelta = Math.abs(metrics.leftSpread - targetSpread);
	const rightSpreadDelta = Math.abs(metrics.rightSpread - targetSpread);
	if (leftSpreadDelta > 0.15 || rightSpreadDelta > 0.15) {
		issues.push({
			id: 'spread',
			title: 'Finger spread',
			message: 'Your fingers need to be a little more open or more relaxed. Check the distance between fingertips.',
			severity: 'high'
		});
		score -= Math.max(10, (leftSpreadDelta + rightSpreadDelta) * 80);
	}

	const leftOpenDelta = Math.abs(metrics.leftOpen - targetOpen);
	const rightOpenDelta = Math.abs(metrics.rightOpen - targetOpen);
	if (leftOpenDelta > 0.12 || rightOpenDelta > 0.12) {
		issues.push({
			id: 'open',
			title: 'Palm opening',
			message: 'The hand opening is slightly off. Try forming a clearer palm and spreading the fingers.',
			severity: 'medium'
		});
		score -= Math.max(8, (leftOpenDelta + rightOpenDelta) * 70);
	}

	if (metrics.confidence < 0.5) {
		issues.push({
			id: 'visibility',
			title: 'Visibility',
			message: 'The model can not see both hands clearly enough. Move into frame and keep your hands visible.',
			severity: 'high'
		});
		score -= 15;
	}

	score = clamp(score, 0, 100);

	let status: PracticeResult['status'] = 'correct';
	if (score < 60) {
		status = 'needs-improvement';
	} else if (score < 82) {
		status = 'close';
	}

	const feedback = [
		`You are practicing “${selectedWord}”.`,
		status === 'correct'
			? 'Nice work — the sign is close to the target form.'
			: status === 'close'
				? 'You are close. Minor adjustments to position and spacing will make the sign clearer.'
				: 'The sign needs more correction. Focus on hand placement, finger spacing, and openness before retrying.'
	];

	const summary =
		status === 'correct'
			? 'Good sign shape.'
			: status === 'close'
				? 'Close but still needs fine-tuning.'
				: 'Not quite there yet.';

	return {
		status,
		score: Math.round(score),
		summary,
		confidence: clamp(metrics.confidence, 0, 1),
		issues: issues.slice(0, 3),
		feedback
	};
}
