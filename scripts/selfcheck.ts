// Run with: npm run selfcheck (Node 22+ strips the types). Covers the pure logic only.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { baseWord, englishOf, pickOptions, similarTo, TOPICS, topicOf, videoPath, posterPath } from '../src/lib/learning/lessons.ts';
import { dayKey, dueWords, isLearned, recordAttempt, streak } from '../src/lib/learning/progress.ts';
import type { Progress } from '../src/lib/learning/progress.ts';
import { evaluatePracticeAttempt } from '../src/lib/learning/geometricFeedback.ts';
import type { PracticeMetrics } from '../src/lib/learning/geometricFeedback.ts';

const labels: string[] = JSON.parse(readFileSync('static/spoter/labels.json', 'utf8'));
assert.equal(labels.length, 400);

// Topics: every label in exactly one topic, English for every label, no stray entries.
const seen = new Map<string, number>();
for (const t of TOPICS) for (const w of Object.keys(t.words)) seen.set(w, (seen.get(w) ?? 0) + 1);
assert.deepEqual(labels.filter((l) => seen.get(l) !== 1), [], 'labels missing from, or repeated across, topics');
assert.deepEqual([...seen.keys()].filter((w) => !labels.includes(w)), [], 'topic words that are not labels');
assert.deepEqual(labels.filter((l) => !englishOf(l).trim()), [], 'labels without English');
assert.ok(TOPICS.every((t) => t.en && t.vi));

// Video files exist for every label.
labels.forEach((_, i) => {
	assert.ok(existsSync(`static${videoPath(i)}`), videoPath(i));
	assert.ok(existsSync(`static${posterPath(i)}`), posterPath(i));
});

// Similar signs / base words.
assert.equal(baseWord('Cao (người)'), 'Cao');
assert.deepEqual(similarTo('Cao (người)', labels), ['Cao (đồ vật)']);
assert.deepEqual(similarTo('Anh', labels), []);

// Quiz options: 4 unique, contains the answer, distractors from the same topic when it is big enough.
for (const answer of labels) {
	const options = pickOptions(answer, labels);
	assert.equal(new Set(options).size, 4);
	assert.ok(options.includes(answer));
	const others = options.filter((o) => o !== answer);
	assert.ok(others.every((o) => baseWord(o) !== baseWord(answer)));
	const topic = topicOf(answer)!;
	assert.ok(others.every((o) => topicOf(o) === topic), `${answer}: distractors left the topic`);
}

// Progress: Leitner boxes, learned threshold, streak.
const p: Progress = { words: {}, days: [] };
recordAttempt(p, 'Anh', true, 80, '2026-03-01');
assert.deepEqual(p.words['Anh'], { best: 80, box: 1, due: '2026-03-02' });
recordAttempt(p, 'Anh', true, null, '2026-03-02');
assert.deepEqual(p.words['Anh'], { best: 80, box: 2, due: '2026-03-05' });
recordAttempt(p, 'Anh', false, 30, '2026-03-05');
assert.deepEqual(p.words['Anh'], { best: 80, box: 0, due: '2026-03-05' });
assert.ok(isLearned(p, 'Anh') && !isLearned(p, 'Bố'));
recordAttempt(p, 'Bố', false, 20, '2026-03-05');
assert.ok(!isLearned(p, 'Bố'));
assert.deepEqual(dueWords(p, '2026-03-05').sort(), ['Anh', 'Bố']);
assert.deepEqual(dueWords(p, '2026-03-04'), []);
assert.equal(dayKey(new Date(2026, 0, 31), 1), '2026-02-01');
assert.equal(streak(p, '2026-03-05'), 1); // 03-05 alone: 03-04 is missing
assert.equal(streak(p, '2026-03-06'), 1); // not yet practiced today: yesterday keeps it alive
assert.equal(streak(p, '2026-03-07'), 0);
recordAttempt(p, 'Anh', true, 90, '2026-03-04');
assert.equal(streak(p, '2026-03-05'), 2); // 03-04 and 03-05; 03-03 is missing
recordAttempt(p, 'Anh', true, 90, '2026-03-03');
assert.equal(streak(p, '2026-03-05'), 5); // 03-01 .. 03-05

// Reference comparison: same attempt -> no issues; each deviation flags the right thing.
const ref: PracticeMetrics = {
	shoulderWidth: 0.3, leftHandY: -0.05, rightHandY: 0.3, handGap: 0.3,
	leftSpread: 0.15, rightSpread: 0.15, leftOpen: 0.1, rightOpen: 0.1, confidence: 1
};
const ids = (m: Partial<PracticeMetrics>, r = ref) => evaluatePracticeAttempt({ ...ref, ...m }, r).issues.map((i) => i.id);
assert.deepEqual(ids({}), []);
assert.deepEqual(evaluatePracticeAttempt(ref, null).issues, []);
assert.deepEqual(ids({ leftHandY: 0.4 }), ['height']); // active hand 0.45 below ref, > 1 shoulder width
assert.deepEqual(ids({ leftHandY: -0.5 }), ['height']);
assert.deepEqual(ids({ handGap: 0.9 }), ['gap']);
assert.deepEqual(ids({ leftSpread: 0.03 }), ['shape']);
assert.deepEqual(ids({ leftSpread: 0.4 }), ['shape']);
assert.deepEqual(ids({ confidence: 0.5 }), ['hands']);
// Mirrored attempt (hands swapped) is not an error: comparison is by role, not side.
assert.deepEqual(ids({ leftHandY: 0.3, rightHandY: -0.05, leftSpread: 0.15, rightSpread: 0.15 }), []);
// Hidden hands: visibility-only penalty, no reference comparison.
assert.deepEqual(ids({ confidence: 0.1 }), ['visibility']);
assert.equal(evaluatePracticeAttempt({ ...ref, leftHandY: 0.4 }, ref).score, 85);

console.log('selfcheck ok');
