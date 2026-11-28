import { browser } from '$app/environment';

export type Lang = 'en' | 'vi';

const translations = {
	en: {
		// Translate
		autoDetect: 'Auto-detect signing',
		autoWaiting: 'Waiting for you to sign…',
		autoSigning: 'Signing detected…',
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
		cardLearnDesc: 'Browse the sign dictionary and practice with your camera.',
		cardLessonsDesc: 'Follow guided lessons from basic to advanced.',
		cardQuizDesc: 'Test what you know and track your progress.',
		cardTranslateDesc: 'Translate signs into text in real time.',
		featurePracticeTitle: 'Practice words',
		featurePracticeBody:
			'Choose from 400 sign words, watch the reference video, and practice in front of your camera.',
		featureLiveTitle: 'Live recognition',
		featureLiveBody: 'Use your camera to test signs and view model predictions in real time.',
		featureFeedbackTitle: 'Feedback-first',
		featureFeedbackBody:
			'See whether the model recognized your sign and whether your hands stayed visible to the camera.',


		// Translate: draft review
		draftTitle: 'Draft',
		draftEmpty: 'Recognized signs appear here. Review them before using the text.',
		rejectLow: (pct: number) => `Sign not accepted: confidence only ${pct}%. Try again, or add one below.`,
		rejectHands: (pct: number) => `Sign not accepted: hands visible in only ${pct}% of frames. Try again, or add one below.`,
		reasonUncertain: (pct: number) => `Moderate confidence (${pct}%). Please check this sign.`,
		reasonMargin: (pct: number, other: string) => `Margin ${pct}% over the next guess. Easily confused with ${other}.`,
		reasonConfident: (pct: number) => `Margin ${pct}% over the next guess.`,
		pickSign: 'Pick the right sign',
		manualFix: 'Or type a correction',
		draftConfirm: 'Confirm',
		draftDelete: 'Delete',
		speak: 'Speak',
		showLarge: 'Show large',
		copy: 'Copy',
		copied: 'Copied',
		copyFailed: 'Could not copy. Select the text and copy it manually.',
		clearDraft: 'Clear',
		angleLabel: 'Camera angle',
		angles: { Frontal: 'Frontal', 'Left ~30°': 'Left ~30°', 'Right ~30°': 'Right ~30°', 'Far / low light': 'Far / low light' } as Record<string, string>,
		submitWait: (n: number, min: number) => `Submit test results (${n}/${min})`,
		submitReady: (n: number) => `Submit test results (${n} runs)`,
		submitNote:
			'Opens a Google Form pre-filled with these numbers only (no video or images). Nothing is sent until you review it and press Submit in the form. Reloading the page resets the count.',
		latency: (total: number, model: number) =>
			`Latency: ${total} ms from end of sign to prediction (model ${model} ms).`,
		latencyAutoNote: (ms: number) => ` Includes the ${ms} ms pause auto-detect waits for.`,
		closeLabel: 'Close',
		toReview: (n: number) => `${n} sign(s) still to review`,
		noViVoice: 'No Vietnamese voice is installed on this device, so the text cannot be spoken.',
		limitations:
			'Limits: 400 isolated words only, best with a frontal view and good light. Facial expressions are not read, so opposite pairs (Nên / Không nên) can be confused. There is no sentence grammar. Review the draft before using it in medical, legal or administrative settings.',
		// Learn
		learnTitle: 'Learn a sign',
		wordLabel: 'Word',
		searchPlaceholder: 'Search a Vietnamese sign word...',
		noWordsMatch: 'No words match your search.',
		currentWord: 'Current word',
		pickWord: 'Pick a word',
		noReferenceVideo: 'No reference video available yet for this word.',
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
		issueVisibilityTitle: 'Visibility',
		issueVisibilityMessage:
			'The camera could not see your hands clearly. Move into frame and keep your hands visible.',
		loadingModels: 'Loading recognition models...',
		recordingRemaining: (n: number) => `REC ${n}s`,

		// Navigation
		navLessons: 'Lessons',
		navQuiz: 'Quiz',
		navAbout: 'About',
		themeToLight: 'Switch to light mode',
		themeToDark: 'Switch to dark mode',

		// Learn: word card
		englishLabel: 'English',
		notPracticed: 'not practiced yet',
		bestScore: (n: number) => `best ${n}%`,
		similarSigns: 'Similar signs',
		prevWord: 'Previous',
		nextWord: 'Next',
		queuePosition: (i: number, n: number) => `${i} / ${n}`,
		quizSignHidden: 'Sign this word from memory. The reference video appears after your attempt.',
		refVideoLabel: (word: string) => `Reference video: sign for "${word}"`,
		speedLabel: 'Speed',
		loopLabel: 'Loop',
		mirrorLabel: 'Mirror',
		topGuesses: 'Top 3 guesses',
		replayTitle: 'Side-by-side replay',
		replayPlay: 'Replay',
		replayYou: 'You',
		replayRef: 'Reference',
		replayYouLabel: 'Skeleton animation of your attempt',
		replayRefLabel: 'Skeleton animation of the reference video',
		replayNoRef: 'The reference could not be analysed, so there is nothing to compare with.',

		// Learn: geometric feedback
		issueHandCountTitle: 'Number of hands',
		issueFewerHandsMessage: 'The reference uses both hands, but the camera mostly saw one of yours.',
		issueMoreHandsMessage: 'The reference uses one hand. Keep your other hand still and out of the way.',
		issueHeightTitle: 'Hand height',
		issueHandsLowMessage: 'Your hand is lower than in the reference. Raise it relative to your shoulders.',
		issueHandsHighMessage: 'Your hand is higher than in the reference. Lower it relative to your shoulders.',
		issueGapTitle: 'Distance between hands',
		issueHandsApartMessage: 'Your hands are further apart than in the reference.',
		issueHandsTogetherMessage: 'Your hands are closer together than in the reference.',
		issueShapeTitle: 'Hand shape',
		issueHandClosedMessage: 'Your hand looks more closed than in the reference. Open your fingers more.',
		issueHandOpenMessage: 'Your hand looks more open than in the reference. Bring your fingers closer together.',

		// Lessons
		lessonsTitle: 'Lessons',
		lessonsIntro: 'Pick a topic and practice its words one after another.',
		streakLabel: (n: number) => (n === 1 ? '1 day streak' : `${n} day streak`),
		learnedTotal: (n: number, total: number) => `${n} of ${total} words learned`,
		reviewTitle: 'Review',
		reviewDue: (n: number) => (n === 1 ? '1 word is due for review.' : `${n} words are due for review.`),
		reviewNone: 'Nothing is due. Practice some words and they will come back here.',
		reviewStart: 'Start review',
		topicProgress: (learned: number, total: number) => `${learned} / ${total} learned`,
		progressNote:
			'Progress is saved only in this browser. A word counts as learned at a best score of 60% or more.',

		// Quiz
		quizTitle: 'Quiz',
		quizIntro: 'Test yourself in two ways. Results count toward your progress.',
		quizWatchTitle: 'Watch and choose',
		quizWatchBody: 'Watch a sign and pick the matching word. No camera needed.',
		quizSignTitle: 'Read and sign',
		quizSignBody: 'See a word, sign it to the camera, and get scored. 10 random words.',
		quizStart: 'Start',
		quizQuestion: (i: number, n: number) => `Question ${i} of ${n}`,
		quizWatchPrompt: 'Which word is this sign?',
		quizOptionsLabel: 'Answer options',
		quizVideoLabel: 'Reference video of a sign to identify',
		quizCorrect: 'Correct!',
		quizStreak: (n: number) => `${n} correct in a row`,
		quizWrong: (word: string) => `Not quite. The answer is "${word}".`,
		quizNext: 'Next question',
		quizFinish: 'See results',
		quizResult: (score: number, total: number) => `You got ${score} of ${total} right.`,
		quizAgain: 'Play again',
		quizLoading: 'Loading words...',

		// About
		aboutTitle: 'About VSL & Deaf culture',
		aboutItems: [
			{
				h: 'What is Vietnamese Sign Language?',
				p: 'Vietnamese Sign Language (VSL, Ngôn ngữ ký hiệu Việt Nam) is a visual language used by many Deaf people in Vietnam. It has its own vocabulary and grammar. It is not a word-for-word signed version of spoken Vietnamese, and facial expression and movement carry part of the meaning.'
			},
			{
				h: 'Regional variation',
				p: 'Signs can differ from region to region, often described as Northern, Central and Southern varieties. The words in this app come from a single set of reference videos, so some signs may differ from what Deaf people near you use. When in doubt, ask local Deaf signers.'
			},
			{
				h: 'Etiquette for hearing learners',
				p: "To get someone's attention, wave in their line of sight or tap their shoulder lightly. Keep eye contact while they sign instead of looking at your hands or phone. Do not speak for Deaf people or assume what they need; ask them. Be patient, and ask before filming anyone. Whenever you can, learn from Deaf teachers and Deaf community groups, because they are the experts in their own language."
			},
			{
				h: 'About the AI feedback',
				p: 'The feedback in this app comes from a machine-learning model and simple hand-position checks. It is approximate and can be wrong, for example because of lighting, camera angle or clothing. It does not see facial expressions or mouth movements, which are part of the language. Use it as a practice aid, not as a test of whether you sign correctly.'
			}
		],
		aboutTabsLabel: 'About sections',
		aboutTabAbout: 'About',
		aboutTabContrib: 'Contributions',
		contribContributors: 'Contributors',
		contribRoleLead: 'Project lead / developer',
		contribBuiltWith: 'Built with',
		contribBuiltItems: [
			{ n: 'MediaPipe Tasks Vision', d: 'pose and hand landmark detection' },
			{ n: 'ONNX Runtime Web', d: 'runs the sign classifier in your browser' },
			{ n: 'SvelteKit', d: 'the web app framework' }
		],
		contribHow: 'How to contribute',
		contribHowItems: [
			'Report issues or wrong results.',
			'Add or correct sign reference videos.',
			'Improve the English and Vietnamese translations.',
			'Submit code through a pull request.'
		],
	},
	vi: {
		// Translate
		autoDetect: 'Tự động nhận biết khi ký hiệu',
		autoWaiting: 'Đang chờ bạn ra ký hiệu…',
		autoSigning: 'Đã thấy bạn ký hiệu…',
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
		cardLearnDesc: 'Tra cứu từ điển ký hiệu và luyện tập với camera.',
		cardLessonsDesc: 'Học theo từng bài từ cơ bản đến nâng cao.',
		cardQuizDesc: 'Kiểm tra kiến thức và theo dõi tiến độ của bạn.',
		cardTranslateDesc: 'Dịch ký hiệu thành văn bản theo thời gian thực.',
		featurePracticeTitle: 'Luyện tập từ vựng',
		featurePracticeBody:
			'Chọn trong 400 từ ký hiệu, xem video mẫu và luyện tập trước camera.',
		featureLiveTitle: 'Nhận diện trực tiếp',
		featureLiveBody: 'Dùng camera để thử ký hiệu và xem dự đoán của mô hình theo thời gian thực.',
		featureFeedbackTitle: 'Ưu tiên phản hồi',
		featureFeedbackBody:
			'Xem mô hình có nhận ra ký hiệu của bạn không và tay bạn có luôn hiện rõ trước camera không.',

		// Translate: draft review
		draftTitle: 'Bản nháp',
		draftEmpty: 'Các ký hiệu nhận diện sẽ hiện ở đây. Hãy kiểm tra trước khi dùng văn bản.',
		rejectLow: (pct: number) => `Ký hiệu chưa được chấp nhận: độ tin cậy chỉ ${pct}%. Hãy thử lại hoặc thêm một từ bên dưới.`,
		rejectHands: (pct: number) => `Ký hiệu chưa được chấp nhận: tay chỉ xuất hiện trong ${pct}% số khung hình. Hãy thử lại hoặc thêm một từ bên dưới.`,
		reasonUncertain: (pct: number) => `Độ tin cậy trung bình (${pct}%). Vui lòng kiểm tra ký hiệu này.`,
		reasonMargin: (pct: number, other: string) => `Chênh lệch ${pct}% so với dự đoán kế tiếp. Dễ nhầm với ${other}.`,
		reasonConfident: (pct: number) => `Chênh lệch ${pct}% so với dự đoán kế tiếp.`,
		pickSign: 'Chọn ký hiệu đúng',
		manualFix: 'Hoặc nhập từ đúng',
		draftConfirm: 'Xác nhận',
		draftDelete: 'Xóa',
		speak: 'Đọc to',
		showLarge: 'Hiện chữ lớn',
		copy: 'Sao chép',
		copied: 'Đã sao chép',
		copyFailed: 'Không thể sao chép. Hãy chọn văn bản và sao chép thủ công.',
		clearDraft: 'Xóa hết',
		angleLabel: 'Góc camera',
		angles: { Frontal: 'Chính diện', 'Left ~30°': 'Lệch trái ~30°', 'Right ~30°': 'Lệch phải ~30°', 'Far / low light': 'Xa / thiếu sáng' } as Record<string, string>,
		submitWait: (n: number, min: number) => `Gửi kết quả thử nghiệm (${n}/${min})`,
		submitReady: (n: number) => `Gửi kết quả thử nghiệm (${n} lượt)`,
		submitNote:
			'Mở Google Form đã điền sẵn chỉ các số liệu này (không có video hay hình ảnh). Sẽ không có gì được gửi đi cho đến khi bạn xem lại và bấm Gửi trong biểu mẫu. Tải lại trang sẽ đặt lại số lượt.',
		latency: (total: number, model: number) =>
			`Độ trễ: ${total} ms từ lúc kết thúc ký hiệu đến khi có kết quả (mô hình ${model} ms).`,
		latencyAutoNote: (ms: number) => ` Đã gồm ${ms} ms chờ mà chế độ tự phát hiện cần để biết bạn đã dừng.`,
		closeLabel: 'Đóng',
		toReview: (n: number) => `Còn ${n} ký hiệu cần kiểm tra`,
		noViVoice: 'Thiết bị này chưa cài giọng đọc tiếng Việt nên không thể đọc to văn bản.',
		limitations:
			'Giới hạn: chỉ nhận 400 từ đơn lẻ, tốt nhất khi quay chính diện và đủ sáng. Biểu cảm khuôn mặt không được nhận diện nên các cặp đối nghĩa (Nên / Không nên) có thể bị nhầm. Chưa có ngữ pháp câu. Hãy kiểm tra bản nháp trước khi dùng trong y tế, pháp lý hoặc thủ tục hành chính.',
		// Learn
		learnTitle: 'Học một ký hiệu',
		wordLabel: 'Từ',
		searchPlaceholder: 'Tìm một từ ký hiệu tiếng Việt...',
		noWordsMatch: 'Không có từ nào khớp với tìm kiếm của bạn.',
		currentWord: 'Từ hiện tại',
		pickWord: 'Chọn một từ',
		noReferenceVideo: 'Chưa có video mẫu cho từ này.',
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
		issueVisibilityTitle: 'Khả năng nhìn thấy',
		issueVisibilityMessage:
			'Camera không nhìn rõ tay của bạn. Hãy di chuyển vào khung hình và giữ tay luôn hiện rõ.',
		loadingModels: 'Đang tải mô hình nhận diện...',
		recordingRemaining: (n: number) => `GHI ${n}s`,

		// Navigation
		navLessons: 'Bài học',
		navQuiz: 'Đố vui',
		navAbout: 'Giới thiệu',
		themeToLight: 'Chuyển sang giao diện sáng',
		themeToDark: 'Chuyển sang giao diện tối',

		// Learn: word card
		englishLabel: 'Tiếng Anh',
		notPracticed: 'chưa luyện tập',
		bestScore: (n: number) => `cao nhất ${n}%`,
		similarSigns: 'Ký hiệu tương tự',
		prevWord: 'Trước',
		nextWord: 'Tiếp',
		queuePosition: (i: number, n: number) => `${i} / ${n}`,
		quizSignHidden: 'Hãy ký từ này theo trí nhớ. Video mẫu sẽ hiện sau lần thử của bạn.',
		refVideoLabel: (word: string) => `Video mẫu: ký hiệu của từ "${word}"`,
		speedLabel: 'Tốc độ',
		loopLabel: 'Lặp lại',
		mirrorLabel: 'Lật gương',
		topGuesses: '3 dự đoán hàng đầu',
		replayTitle: 'Xem lại song song',
		replayPlay: 'Phát lại',
		replayYou: 'Bạn',
		replayRef: 'Video mẫu',
		replayYouLabel: 'Hoạt cảnh khung xương của lần thử của bạn',
		replayRefLabel: 'Hoạt cảnh khung xương của video mẫu',
		replayNoRef: 'Không thể phân tích video mẫu nên chưa có gì để so sánh.',

		// Learn: geometric feedback
		issueHandCountTitle: 'Số lượng tay',
		issueFewerHandsMessage: 'Video mẫu dùng cả hai tay, nhưng camera chủ yếu chỉ thấy một tay của bạn.',
		issueMoreHandsMessage: 'Video mẫu chỉ dùng một tay. Hãy để tay còn lại đứng yên và tránh ra.',
		issueHeightTitle: 'Độ cao của tay',
		issueHandsLowMessage: 'Tay bạn thấp hơn so với video mẫu. Hãy nâng tay lên so với vai.',
		issueHandsHighMessage: 'Tay bạn cao hơn so với video mẫu. Hãy hạ tay xuống so với vai.',
		issueGapTitle: 'Khoảng cách giữa hai tay',
		issueHandsApartMessage: 'Hai tay bạn cách xa nhau hơn so với video mẫu.',
		issueHandsTogetherMessage: 'Hai tay bạn gần nhau hơn so với video mẫu.',
		issueShapeTitle: 'Hình dạng bàn tay',
		issueHandClosedMessage: 'Bàn tay bạn khép hơn so với video mẫu. Hãy mở các ngón tay rộng hơn.',
		issueHandOpenMessage: 'Bàn tay bạn mở rộng hơn so với video mẫu. Hãy khép các ngón tay lại gần nhau hơn.',

		// Lessons
		lessonsTitle: 'Bài học',
		lessonsIntro: 'Chọn một chủ đề và luyện lần lượt từng từ trong đó.',
		streakLabel: (n: number) => `Chuỗi ${n} ngày liên tiếp`,
		learnedTotal: (n: number, total: number) => `Đã thuộc ${n} / ${total} từ`,
		reviewTitle: 'Ôn tập',
		reviewDue: (n: number) => `Có ${n} từ cần ôn tập hôm nay.`,
		reviewNone: 'Chưa có từ nào cần ôn. Hãy luyện thêm vài từ, chúng sẽ xuất hiện lại ở đây.',
		reviewStart: 'Bắt đầu ôn tập',
		topicProgress: (learned: number, total: number) => `Đã thuộc ${learned} / ${total}`,
		progressNote:
			'Tiến độ chỉ được lưu trong trình duyệt này. Một từ được tính là đã thuộc khi điểm cao nhất từ 60% trở lên.',

		// Quiz
		quizTitle: 'Đố vui',
		quizIntro: 'Tự kiểm tra theo hai cách. Kết quả được tính vào tiến độ của bạn.',
		quizWatchTitle: 'Xem và chọn',
		quizWatchBody: 'Xem một ký hiệu rồi chọn từ đúng. Không cần camera.',
		quizSignTitle: 'Đọc và ký',
		quizSignBody: 'Xem một từ, ký trước camera và nhận điểm. 10 từ ngẫu nhiên.',
		quizStart: 'Bắt đầu',
		quizQuestion: (i: number, n: number) => `Câu ${i} / ${n}`,
		quizWatchPrompt: 'Ký hiệu này là từ nào?',
		quizOptionsLabel: 'Các đáp án',
		quizVideoLabel: 'Video mẫu của ký hiệu cần nhận ra',
		quizCorrect: 'Chính xác!',
		quizStreak: (n: number) => `${n} câu đúng liên tiếp`,
		quizWrong: (word: string) => `Chưa đúng. Đáp án là "${word}".`,
		quizNext: 'Câu tiếp theo',
		quizFinish: 'Xem kết quả',
		quizResult: (score: number, total: number) => `Bạn trả lời đúng ${score} / ${total} câu.`,
		quizAgain: 'Chơi lại',
		quizLoading: 'Đang tải danh sách từ...',

		// About
		aboutTitle: 'Về VSL và văn hóa Người Điếc',
		aboutItems: [
			{
				h: 'Ngôn ngữ ký hiệu Việt Nam là gì?',
				p: 'Ngôn ngữ ký hiệu Việt Nam (VSL) là ngôn ngữ thị giác được nhiều người Điếc ở Việt Nam sử dụng. Ngôn ngữ này có từ vựng và ngữ pháp riêng, không phải là tiếng Việt nói được ký từng từ một. Nét mặt và chuyển động cũng mang một phần ý nghĩa.'
			},
			{
				h: 'Khác biệt vùng miền',
				p: 'Ký hiệu có thể khác nhau giữa các vùng, thường được chia thành các biến thể miền Bắc, miền Trung và miền Nam. Các từ trong ứng dụng này lấy từ một bộ video mẫu duy nhất, nên một số ký hiệu có thể khác với những gì người Điếc quanh bạn dùng. Khi băn khoăn, hãy hỏi người Điếc ở địa phương.'
			},
			{
				h: 'Phép lịch sự dành cho người nghe học ký hiệu',
				p: 'Để gây chú ý, hãy vẫy tay trong tầm nhìn của họ hoặc chạm nhẹ vào vai. Khi họ đang ký, hãy giữ giao tiếp bằng mắt thay vì nhìn tay hay điện thoại của mình. Đừng nói thay người Điếc hay tự cho rằng mình biết họ cần gì, hãy hỏi họ. Hãy kiên nhẫn và xin phép trước khi quay phim bất kỳ ai. Khi có thể, hãy học từ giáo viên Người Điếc và các nhóm cộng đồng Người Điếc, vì họ là người hiểu rõ nhất ngôn ngữ của mình.'
			},
			{
				h: 'Về phản hồi của AI',
				p: 'Phản hồi trong ứng dụng đến từ một mô hình học máy và các kiểm tra đơn giản về vị trí bàn tay. Kết quả chỉ mang tính gần đúng và có thể sai, chẳng hạn do ánh sáng, góc camera hay trang phục. Ứng dụng không nhìn thấy nét mặt hay khẩu hình, vốn là một phần của ngôn ngữ. Hãy dùng nó như một công cụ hỗ trợ luyện tập, không phải bài kiểm tra xem bạn ký có đúng hay không.'
			}
		],
		aboutTabsLabel: 'Các mục giới thiệu',
		aboutTabAbout: 'Giới thiệu',
		aboutTabContrib: 'Đóng góp',
		contribContributors: 'Người đóng góp',
		contribRoleLead: 'Trưởng dự án / lập trình viên',
		contribBuiltWith: 'Được xây dựng với',
		contribBuiltItems: [
			{ n: 'MediaPipe Tasks Vision', d: 'nhận diện điểm mốc cơ thể và bàn tay' },
			{ n: 'ONNX Runtime Web', d: 'chạy bộ phân loại ký hiệu ngay trong trình duyệt' },
			{ n: 'SvelteKit', d: 'khung phát triển ứng dụng web' }
		],
		contribHow: 'Cách đóng góp',
		contribHowItems: [
			'Báo lỗi hoặc kết quả nhận diện sai.',
			'Thêm hoặc sửa video mẫu cho các ký hiệu.',
			'Cải thiện bản dịch tiếng Anh và tiếng Việt.',
			'Gửi mã nguồn qua pull request.'
		],
	},
} as const;

const STORAGE_KEY = 'lang';

function readStoredLang(): Lang {
	if (!browser) return 'en';
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === 'en' || stored === 'vi' ? stored : 'en';
}

type Translations = (typeof translations)[Lang];
export type MsgKey = keyof Translations;
/** A message stored as a key (plus params) so it can be re-rendered when the language changes. */
export type Msg = { key: MsgKey; args?: unknown[] };

export function msg(key: MsgKey, ...args: unknown[]): Msg {
	return args.length ? { key, args } : { key };
}

function isMsg(value: unknown): value is Msg {
	return typeof value === 'object' && value !== null && 'key' in value && typeof (value as Msg).key === 'string';
}

class I18nStore {
	lang = $state<Lang>(readStoredLang());

	get t() {
		return translations[this.lang];
	}

	/** Resolve a stored message in the current language. Plain strings pass through unchanged. */
	render(message: Msg | string | null | undefined): string {
		if (message == null) return '';
		if (typeof message === 'string') return message;
		const entry = this.t[message.key] as unknown;
		if (typeof entry === 'function') {
			const args = (message.args ?? []).map((arg) => (isMsg(arg) ? this.render(arg) : arg));
			return String((entry as (...a: unknown[]) => unknown)(...args));
		}
		return String(entry);
	}

	setLang(next: Lang) {
		this.lang = next;
		if (browser) localStorage.setItem(STORAGE_KEY, next);
	}
}

export const i18n = new I18nStore();
