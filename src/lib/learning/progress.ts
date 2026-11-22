// Progress lives only in localStorage; every access is guarded so the app works without it.
export type WordProgress = { best: number; box: number; due: string };
export type Progress = { words: Record<string, WordProgress>; days: string[] };

export const LEARNED_SCORE = 60;
// Leitner boxes: a pass moves a word up one box, a fail sends it back to box 0 (due today).
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
const KEY = 'vslink:progress:v1';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD; `offset` shifts by whole days. */
export function dayKey(date = new Date(), offset = 0): string {
	const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const shiftKey = (key: string, offset: number) => {
	const [y, m, d] = key.split('-').map(Number);
	return dayKey(new Date(y, m - 1, d), offset);
};

/** Records one attempt. `score` is omitted for quiz answers, which only affect review scheduling. */
export function recordAttempt(
	p: Progress,
	label: string,
	passed: boolean,
	score: number | null,
	today = dayKey()
): void {
	const prev = p.words[label] ?? { best: 0, box: 0, due: today };
	const box = passed ? Math.min(prev.box + 1, INTERVAL_DAYS.length - 1) : 0;
	p.words[label] = {
		best: score === null ? prev.best : Math.max(prev.best, Math.round(score)),
		box,
		due: shiftKey(today, INTERVAL_DAYS[box])
	};
	if (!p.days.includes(today)) p.days = [...p.days, today].slice(-400);
}

export const isLearned = (p: Progress, label: string) => (p.words[label]?.best ?? 0) >= LEARNED_SCORE;

export const dueWords = (p: Progress, today = dayKey()): string[] =>
	Object.keys(p.words).filter((label) => p.words[label].due <= today);

/** Consecutive practice days ending today (or yesterday, so the streak survives until tonight). */
export function streak(p: Progress, today = dayKey()): number {
	let day = p.days.includes(today) ? today : shiftKey(today, -1);
	let count = 0;
	while (p.days.includes(day)) {
		count += 1;
		day = shiftKey(day, -1);
	}
	return count;
}

const empty = (): Progress => ({ words: {}, days: [] });

export function loadProgress(): Progress {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		if (raw && typeof raw.words === 'object' && Array.isArray(raw.days)) return raw;
	} catch {
		// unavailable or corrupt storage: start fresh
	}
	return empty();
}

export function saveProgress(p: Progress): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(p));
	} catch {
		// private mode / quota: progress just won't persist
	}
}

/** Load, record, save. Returns the updated progress. */
export function track(label: string, passed: boolean, score: number | null): Progress {
	const p = loadProgress();
	recordAttempt(p, label, passed, score);
	saveProgress(p);
	return p;
}
