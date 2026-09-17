export type WordCatalogEntry = {
	id: string;
	label: string;
	videoUrl?: string;
	difficulty?: 'easy' | 'medium' | 'hard';
};

export const WORD_CATALOG: WordCatalogEntry[] = [
	{ id: '1', label: 'Anh', difficulty: 'easy' },
	{ id: '2', label: 'Ba lô', difficulty: 'easy' },
	{ id: '3', label: 'Bia', difficulty: 'easy' },
	{ id: '4', label: 'Bác', difficulty: 'easy' },
	{ id: '5', label: 'Bố', difficulty: 'easy' },
	{ id: '6', label: 'Chạy', difficulty: 'easy' },
	{ id: '7', label: 'Đi', difficulty: 'easy' },
	{ id: '8', label: 'Em', difficulty: 'easy' },
	{ id: '9', label: 'Giỏi', difficulty: 'medium' },
	{ id: '10', label: 'Học', difficulty: 'easy' },
	{ id: '11', label: 'Mẹ', difficulty: 'easy' },
	{ id: '12', label: 'Nói', difficulty: 'medium' },
	{ id: '13', label: 'Thích', difficulty: 'easy' },
	{ id: '14', label: 'Uống', difficulty: 'easy' },
	{ id: '15', label: 'Yêu thương', difficulty: 'medium' },
	{ id: '16', label: 'Ăn', difficulty: 'easy' },
	{ id: '17', label: 'Đọc', difficulty: 'easy' },
	{ id: '18', label: 'Viết', difficulty: 'easy' },
	{ id: '19', label: 'Ngủ', difficulty: 'easy' },
	{ id: '20', label: 'Mưa', difficulty: 'easy' }
];

export function getWordsFromLabels(labels: string[]): WordCatalogEntry[] {
	return labels.map((label, index) => ({
		id: String(index + 1),
		label,
		difficulty: index % 5 === 0 ? 'hard' : index % 3 === 0 ? 'medium' : 'easy'
	}));
}