import type { CapturedFrame, Prediction } from './pipeline';

export const GREEN = 0.65;
export const YELLOW = 0.4;
export const MIN_HAND_RATIO = 0.5;
export const CLOSE_CALL = 0.15;

export type Tier = 'confident' | 'uncertain' | 'reject';

// Missing hands are stored as all-zero points, so "detected" means any non-zero x/y.
export function handRatio(frames: CapturedFrame[]): number {
	if (!frames.length) return 0;
	const seen = (hand: { x: number; y: number }[]) => hand.some((p) => p.x !== 0 || p.y !== 0);
	return frames.filter((f) => seen(f.leftHand) || seen(f.rightHand)).length / frames.length;
}

// The tier depends on p1 and hand ratio only; the margin is informational.
export function evaluate(ranked: Prediction[], ratio: number) {
	const p1 = ranked[0]?.confidence ?? 0;
	const p2 = ranked[1]?.confidence ?? 0;
	const tier: Tier =
		ratio < MIN_HAND_RATIO || p1 < YELLOW ? 'reject' : p1 >= GREEN ? 'confident' : 'uncertain';
	const margin = p1 - p2;
	return {
		tier,
		p1,
		p2,
		top2Label: ranked[1]?.label ?? '',
		margin,
		closeCall: margin < CLOSE_CALL,
		handRatio: ratio
	};
}

// "Cao (người)" -> "Cao"
export const spokenText = (labels: string[]) =>
	labels.map((l) => l.replace(/\s*\(.*?\)/g, '').trim()).join(' ');
