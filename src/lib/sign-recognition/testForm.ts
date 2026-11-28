// Pre-filled Google Form link for anonymized test metrics. Pure: no DOM, nothing is sent from here.
const FORM_URL =
	'https://docs.google.com/forms/d/e/1FAIpQLSeD_LGAkP0V1UHdUYLl6Yyq9xJ1UpOXvJRtD2NGiQPSmv2CIA/viewform';
const MAX_URL = 8000;
export const MIN_RUNS = 3;

export type Row = {
	angle: string;
	mode: string;
	predicted: string;
	final: string; // '' when rejected and never added to the draft
	p1: number;
	margin: number;
	tier: string;
	ms: number;
	totalMs: number;
	target: string;
};

function median(xs: number[]) {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

const pct = (x: number) => `${Math.floor(x * 100)}%`; // floor like the page, so 64.8% never reads as the 65% threshold

function line(r: Row, i: number) {
	let s = `#${i + 1} ${r.angle} ${r.mode} "${r.predicted}" p1 ${pct(r.p1)} Δ ${pct(r.margin)} ${r.tier} lat ${Math.round(r.totalMs)}ms model ${Math.round(r.ms)}ms`;
	if (r.target) s += ` target "${r.target}"`;
	if (r.final && r.final !== r.predicted) s += ` -> ${r.final}`;
	else if (!r.final && r.tier === 'reject') s += ' (rejected)';
	return s;
}

export function formUrl(session: string, rows: Row[]) {
	const judged = rows.filter((r) => r.final);
	const right = judged.filter((r) => r.final === r.predicted).length;
	const summary =
		`${rows.length} runs, top-1 ${judged.length ? pct(right / judged.length) : 'n/a'}, ` +
		`corrected ${judged.length - right}, yellow ${rows.filter((r) => r.tier === 'uncertain').length}, ` +
		`red ${rows.filter((r) => r.tier === 'reject').length}, ` +
		`median latency ${median(rows.map((r) => r.totalMs))}ms, median model ${median(rows.map((r) => r.ms))}ms`;
	const lines = rows.map(line);
	const build = (skip: number) => {
		const details = (skip ? [`(first ${skip} runs omitted)`] : []).concat(lines.slice(skip)).join('\n');
		const q = new URLSearchParams({
			'entry.1079617999': session,
			'entry.755250454': summary,
			'entry.1440675633': details,
			usp: 'pp_url'
		});
		return `${FORM_URL}?${q}`;
	};
	let skip = 0;
	while (skip < lines.length && build(skip).length > MAX_URL) skip++;
	return build(skip);
}
