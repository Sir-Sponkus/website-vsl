import { browser } from '$app/environment';

export type Lang = 'en' | 'vi';

const translations = {
	en: {
		// Translate
		camera: 'Camera',
		videoFile: 'Video file',
		uploadLabel: 'Upload Video File (.mp4, .webm):',
		videoStatus: 'Video Status:',
		detectedSign: 'Detected Sign:',
		startDetection: 'Start Detection',
		stopDetection: 'Stop Detection',
		topPredictions: 'Top predictions',
		waitingFrames: 'Waiting for frames...',
		ranking: 'Ranking',
		label: 'Label',
		confidence: 'Confidence',
		noVideoSelected: 'No video selected',
		noModelLoaded: 'No model loaded',
		dash: '—',
		startingIn: (n: number) => `Starting in ${n}...`,
		recordingGesture: 'Recording gesture...',
		analyzingSign: 'Analyzing sign...',
		sequenceTooShort: 'Sequence too short',
		errorAnalyzing: 'Error analyzing sign',
		unknown: 'Unknown',
		invalidFormatAlert: 'Invalid format! The JSON file must be an array of strings, e.g. ["hello", "world"]',
		failedParseAlert: 'Failed to parse JSON file. Please check for valid JSON syntax.',
		failedModelAlert: (msg: string) => `Failed to load ONNX model: ${msg}`,

		// Home
		heroTagline: {
			before: 'An AI-powered tool that helps you ',
			learn: 'learn',
			and: ' and ',
			translate: 'translate',
			mid: ' Vietnamese Sign Language in ',
			realtime: 'real-time',
			after: '.'
		},
		learnButton: 'Learn',
		translateButton: 'Translate',
		featurePracticeTitle: 'Practice words',
		featurePracticeBody:
			'Choose from a dictionary of sign words and get feedback on hand placement and motion.',
		featureLiveTitle: 'Live recognition',
		featureLiveBody: 'Use your camera to test signs and view model predictions in real time.',
		featureFeedbackTitle: 'Feedback-first',
		featureFeedbackBody:
			'See where to improve: hand height, spacing, finger spread, motion, and openness.',


		// Learn
		learnTitle: 'Learn a sign',
		wordLabel: 'Word',
		searchPlaceholder: 'Search a Vietnamese sign word...',
		noWordsMatch: 'No words match your search.',
		currentWord: 'Current word',
		pickWord: 'Pick a word',
		noReferenceVideo: 'No reference video available yet for this word.',
		noReferenceVideoHint:
			'This repo includes the word list but not every video asset. The learning flow still works with live camera feedback.',
		startPractice: 'Start practice',
		recordingEllipsis: 'Recording...',
		stopAndCheck: 'Stop and check',
		reset: 'Reset',
		startingInCountdown: (n: number) => `Starting in ${n}`,
		confidenceLabel: (pct: number) => `Confidence: ${pct}%`,
		defaultFeedback: 'Select a word, start the camera, and try the sign.',
		recordingFeedback: 'Recording your attempt...',
		wordListLoadError: 'The full word list could not be loaded.',
		modelLoadedButOnnxFailed: 'Landmarkers are ready, but the ONNX model could not be loaded.',
		recognitionSetupFailed: 'Recognition setup failed. Check model assets and use a supported browser.',
		cameraPermissionError: 'Camera permission was denied or is unavailable.',
		recordLongerError: 'Record a little longer with both hands visible before checking.',
		runningModel: 'Running the sign recognition model...',
		geometricOnlySummary: 'Geometric feedback only — the recognition model is unavailable.',
		geometricOnlyFeedback:
			'The model could not be loaded, so this result is only an approximate geometry check.',
		correctSignSummary: 'Correct sign detected.',
		closeSignSummary: 'Close to the selected sign.',
		needsImprovementSummary: 'Needs improvement.',
		recognizedFeedback: (word: string) => `The model recognized "${word}". `,
		closeFeedback: (predicted: string) => `The model was close, but it predicted "${predicted}". `,
		notRecognizedFeedback: (word: string) => `The model did not confidently recognize "${word}". `,
		anotherSign: 'another sign',
		analysisFailed:
			'The sign could not be analyzed. Try recording again with your full upper body and both hands visible.',

		// Feedback
		issueHeightTitle: 'Hand height',
		issueHeightMessage:
			'Your hands are slightly too high or too low. Bring them closer to the shoulder line.',
		issueSpacingTitle: 'Hand spacing',
		issueSpacingMessage:
			'Move your hands closer together or farther apart to better match the target pose.',
		issueSpreadTitle: 'Finger spread',
		issueSpreadMessage:
			'Spread your fingers a little more or relax them so the hand shape is cleaner.',
		issueOpenTitle: 'Palm opening',
		issueOpenMessage:
			'The hand opening is off. Try making the palm clearer and spreading the fingers more evenly.',
		issueVisibilityTitle: 'Visibility',
		issueVisibilityMessage:
			'The model cannot see both hands clearly enough. Move into frame and keep your hands visible.',
		practicingWord: (word: string) => `You are practicing "${word}".`,
		feedbackCorrect: 'Nice work — the sign is close to the target form.',
		feedbackClose:
			'You are close. Minor adjustments to hand placement and spacing will make the sign cleaner.',
		feedbackNeedsImprovement:
			'The sign needs more correction. Focus on hand placement, finger spacing, and palm openness before retrying.',
		summaryCorrect: 'Good sign shape.',
		summaryClose: 'Close but still needs fine-tuning.',
		summaryNeedsImprovement: 'Not quite there yet.'
	},
	vi: {
		// Translate
		camera: 'Máy quay',
		videoFile: 'Tệp video',
		uploadLabel: 'Tải lên tệp video (.mp4, .webm):',
		videoStatus: 'Trạng thái video:',
		detectedSign: 'Ký hiệu nhận diện:',
		startDetection: 'Bắt đầu nhận diện',
		stopDetection: 'Dừng nhận diện',
		topPredictions: 'Dự đoán hàng đầu',
		waitingFrames: 'Đang chờ khung hình...',
		ranking: 'Hạng',
		label: 'Nhãn',
		confidence: 'Độ tin cậy',
		noVideoSelected: 'Chưa chọn video',
		noModelLoaded: 'Chưa tải mô hình',
		dash: '—',
		startingIn: (n: number) => `Bắt đầu sau ${n}...`,
		recordingGesture: 'Đang ghi cử chỉ...',
		analyzingSign: 'Đang phân tích ký hiệu...',
		sequenceTooShort: 'Chuỗi quá ngắn',
		errorAnalyzing: 'Lỗi khi phân tích ký hiệu',
		unknown: 'Không xác định',
		invalidFormatAlert: 'Định dạng không hợp lệ! Tệp JSON phải là một mảng chuỗi, ví dụ: ["hello", "world"]',
		failedParseAlert: 'Không thể phân tích tệp JSON. Vui lòng kiểm tra cú pháp JSON hợp lệ.',
		failedModelAlert: (msg: string) => `Không thể tải mô hình ONNX: ${msg}`,

		//Home
		heroTagline: {
			before: 'Một công cụ AI giúp bạn ',
			learn: 'học',
			and: ' và ',
			translate: 'dịch',
			mid: ' Ngôn ngữ Ký hiệu Việt Nam trong ',
			realtime: 'thời gian thực',
			after: '.'
		},
		learnButton: 'Học',
		translateButton: 'Dịch',
		featurePracticeTitle: 'Luyện tập từ vựng',
		featurePracticeBody:
			'Chọn từ danh sách các từ ký hiệu và nhận phản hồi về vị trí và chuyển động của tay.',
		featureLiveTitle: 'Nhận diện trực tiếp',
		featureLiveBody: 'Dùng camera để thử ký hiệu và xem dự đoán của mô hình theo thời gian thực.',
		featureFeedbackTitle: 'Ưu tiên phản hồi',
		featureFeedbackBody:
			'Xem những gì cần cải thiện: độ cao tay, khoảng cách, độ xòe ngón tay, chuyển động và độ mở.',

		// Learn
		learnTitle: 'Học một ký hiệu',
		wordLabel: 'Từ',
		searchPlaceholder: 'Tìm một từ ký hiệu tiếng Việt...',
		noWordsMatch: 'Không có từ nào khớp với tìm kiếm của bạn.',
		currentWord: 'Từ hiện tại',
		pickWord: 'Chọn một từ',
		noReferenceVideo: 'Chưa có video mẫu cho từ này.',
		noReferenceVideoHint:
			'Kho này bao gồm danh sách từ nhưng không phải video nào cũng có sẵn. Luồng học vẫn hoạt động với phản hồi camera trực tiếp.',
		startPractice: 'Bắt đầu luyện tập',
		recordingEllipsis: 'Đang ghi...',
		stopAndCheck: 'Dừng và kiểm tra',
		reset: 'Đặt lại',
		startingInCountdown: (n: number) => `Bắt đầu sau ${n}`,
		confidenceLabel: (pct: number) => `Độ tin cậy: ${pct}%`,
		defaultFeedback: 'Chọn một từ, bật camera và thử ký hiệu.',
		recordingFeedback: 'Đang ghi lại lần thử của bạn...',
		wordListLoadError: 'Không thể tải đầy đủ danh sách từ.',
		modelLoadedButOnnxFailed: 'Bộ phát hiện điểm mốc đã sẵn sàng, nhưng không thể tải mô hình ONNX.',
		recognitionSetupFailed:
			'Thiết lập nhận diện thất bại. Hãy kiểm tra tài nguyên mô hình và sử dụng trình duyệt được hỗ trợ.',
		cameraPermissionError: 'Quyền truy cập camera bị từ chối hoặc không khả dụng.',
		recordLongerError: 'Hãy ghi lâu hơn một chút với cả hai tay hiện rõ trước khi kiểm tra.',
		runningModel: 'Đang chạy mô hình nhận diện ký hiệu...',
		geometricOnlySummary: 'Chỉ có phản hồi hình học — mô hình nhận diện không khả dụng.',
		geometricOnlyFeedback:
			'Không thể tải mô hình, vì vậy kết quả này chỉ là một kiểm tra hình học gần đúng.',
		correctSignSummary: 'Đã nhận diện đúng ký hiệu.',
		closeSignSummary: 'Gần đúng với ký hiệu đã chọn.',
		needsImprovementSummary: 'Cần cải thiện.',
		recognizedFeedback: (word: string) => `Mô hình đã nhận diện "${word}". `,
		closeFeedback: (predicted: string) => `Mô hình gần đúng, nhưng dự đoán là "${predicted}". `,
		notRecognizedFeedback: (word: string) => `Mô hình không nhận diện chắc chắn "${word}". `,
		anotherSign: 'ký hiệu khác',
		analysisFailed:
			'Không thể phân tích ký hiệu. Hãy thử ghi lại với toàn bộ phần trên cơ thể và cả hai tay hiện rõ.',

		// Feedback
		issueHeightTitle: 'Độ cao tay',
		issueHeightMessage: 'Tay bạn hơi cao hoặc hơi thấp. Hãy đưa tay gần với đường vai hơn.',
		issueSpacingTitle: 'Khoảng cách tay',
		issueSpacingMessage:
			'Di chuyển hai tay lại gần nhau hơn hoặc xa nhau hơn để khớp với tư thế mục tiêu.',
		issueSpreadTitle: 'Độ xòe ngón tay',
		issueSpreadMessage:
			'Xòe ngón tay ra thêm một chút hoặc thả lỏng để hình dạng bàn tay rõ ràng hơn.',
		issueOpenTitle: 'Độ mở lòng bàn tay',
		issueOpenMessage:
			'Độ mở bàn tay chưa đúng. Hãy làm cho lòng bàn tay rõ hơn và xòe ngón tay đều hơn.',
		issueVisibilityTitle: 'Khả năng nhìn thấy',
		issueVisibilityMessage:
			'Mô hình không thể nhìn rõ cả hai tay. Hãy di chuyển vào khung hình và giữ tay luôn hiện rõ.',
		practicingWord: (word: string) => `Bạn đang luyện tập "${word}".`,
		feedbackCorrect: 'Làm tốt lắm — ký hiệu gần với hình mẫu mục tiêu.',
		feedbackClose:
			'Bạn đã gần đúng. Điều chỉnh nhỏ về vị trí và khoảng cách tay sẽ giúp ký hiệu rõ ràng hơn.',
		feedbackNeedsImprovement:
			'Ký hiệu cần được chỉnh sửa nhiều hơn. Hãy tập trung vào vị trí tay, khoảng cách ngón tay và độ mở lòng bàn tay trước khi thử lại.',
		summaryCorrect: 'Hình dạng ký hiệu tốt.',
		summaryClose: 'Gần đúng nhưng vẫn cần tinh chỉnh.',
		summaryNeedsImprovement: 'Chưa đạt được.'
	},
} as const;

const STORAGE_KEY = 'lang';

function readStoredLang(): Lang {
	if (!browser) return 'en';
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === 'en' || stored === 'vi' ? stored : 'en';
}

class I18nStore {
	lang = $state<Lang>(readStoredLang());

	get t() {
		return translations[this.lang];
	}

	setLang(next: Lang) {
		this.lang = next;
		if (browser) localStorage.setItem(STORAGE_KEY, next);
	}
}

export const i18n = new I18nStore();
