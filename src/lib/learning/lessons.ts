// Single source for topics and English meanings. Every label in static/spoter/labels.json must
// appear in exactly one topic (checked by scripts/selfcheck.ts). Entries are "Label=English".
export type Topic = { id: string; en: string; vi: string; words: Record<string, string> };

const topic = (id: string, en: string, vi: string, entries: string): Topic => ({
	id,
	en,
	vi,
	words: Object.fromEntries(entries.split(';').map((entry) => entry.trim().split('=')))
});

export const TOPICS: Topic[] = [
	topic(
		'family',
		'Family',
		'Gia đình',
		`Anh=older brother; Chị=older sister; Em=younger sibling; Bố=father; Mẹ=mother;
		Ông nội=paternal grandfather; Bà nội=paternal grandmother; Ông ngoại=maternal grandfather;
		Bà ngoại=maternal grandmother; Bác=uncle or aunt (parent's elder sibling); Chú=uncle (father's younger brother);
		Cô=aunt (father's sister); Cậu=uncle (mother's brother); Dì=aunt (mother's sister);
		Cháu=grandchild, niece or nephew; Con trai=son; Con gái=daughter; Chồng=husband; Vợ=wife; Họ hàng=relatives`
	),
	topic(
		'animals',
		'Animals',
		'Động vật',
		`Con bò=cow; Con chó=dog; Con dê=goat; Con gà=chicken; Con heo=pig; Con mèo=cat;
		Con rùa=turtle; Con thỏ=rabbit; Con trâu=buffalo; Con vịt=duck`
	),
	topic(
		'food',
		'Food & drink',
		'Đồ ăn & thức uống',
		`Bánh bao=steamed bun; Bánh chưng=square sticky rice cake; Bánh tét=cylindrical sticky rice cake;
		Bánh xèo=sizzling pancake; Bún=rice vermicelli; Phở=pho noodle soup; Mì gói=instant noodles;
		Xôi=sticky rice; Gạo=uncooked rice; Thịt=meat; Trứng=egg; Kẹo=candy; Kem=ice cream; Bia=beer;
		Rượu=alcohol; Cà phê=coffee; Trà=tea; Sữa=milk; Nước=water; Quả bơ=avocado; Quả cam=orange;
		Quả chuối=banana; Quả dâu=strawberry; Quả dứa=pineapple; Quả dừa=coconut; Quả mận=plum;
		Quả xoài=mango; Quả đu đủ=papaya; Quả đào=peach`
	),
	topic(
		'taste',
		'Taste & cooking',
		'Vị giác & nấu ăn',
		`Cay=spicy; Chua=sour; Mặn=salty; Ngọt=sweet; Nhạt=bland; Đắng=bitter; Thơm=fragrant; Hôi=smelly;
		Ngon miệng=tasty; Ăn=eat; Uống=drink; Nấu=cook; Nướng=grill or roast; Nếm=taste; Ngửi=smell (verb);
		Thèm=crave; Tham ăn=greedy for food; Cái chảo=frying pan; Cái nồi=cooking pot; Nồi cơm điện=rice cooker`
	),
	topic(
		'sports',
		'Sports & hobbies',
		'Thể thao & sở thích',
		`Bóng bàn=table tennis; Bóng chuyền=volleyball; Bóng rổ=basketball; Bóng đá=football (soccer);
		Bơi lội=swimming; Cầu lông=badminton; Chơi cờ=play chess; Chạy=run; Cắm trại=camping;
		Chụp hình=take photos; Hát=sing; Múa=dance; Nhảy cao=high jump; Nhảy dây=jump rope;
		Thể dục (thể thao)=physical education, sports; Điền kinh=track and field; Đá cầu=shuttlecock kicking; Võ=martial arts`
	),
	topic(
		'time',
		'Time',
		'Thời gian',
		`Bây giờ=now; Bình minh=sunrise; Hoàng hôn=sunset; Buổi sáng=morning; Buổi trưa=noon;
		Buổi chiều=afternoon; Buổi tối=evening; Giây=second; Phút=minute; Giờ=hour, o'clock; Ngày=day;
		Tháng=month; Năm=year; Thời gian=time; Sớm=early; Trễ=late`
	),
	topic(
		'calendar',
		'Days & months',
		'Thứ & tháng',
		`Thứ hai=Monday; Thứ ba=Tuesday; Thứ tư=Wednesday; Thứ năm=Thursday; Thứ sáu=Friday;
		Thứ bảy=Saturday; Chủ nhật=Sunday; Tháng một=January; Tháng hai=February; Tháng ba=March;
		Tháng tư=April; Tháng năm=May; Tháng sáu=June; Tháng bảy=July; Tháng tám=August;
		Tháng chín=September; Tháng mười=October; Tháng mười một=November; Tháng mười hai=December`
	),
	topic(
		'holidays',
		'Holidays, seasons & weather',
		'Lễ, mùa & thời tiết',
		`Giáng sinh=Christmas; Tết Âm lịch=Lunar New Year (Tet); Trung thu=Mid-Autumn Festival;
		Ngày Nhà giáo Việt Nam=Vietnamese Teachers' Day; Ngày Quốc tế Lao động=International Workers' Day;
		Ngày Quốc tế Phụ nữ=International Women's Day; Ngày Quốc tế Thiếu nhi=International Children's Day;
		Mùa xuân=spring; Mùa hè=summer; Mùa thu=autumn; Mùa đông=winter; Mùa khô=dry season;
		Mùa mưa=rainy season; Gió=wind; Mưa=rain; Nắng=sunny; Thời tiết=weather`
	),
	topic(
		'jobs',
		'Jobs & work',
		'Nghề nghiệp & công việc',
		`Nghề nghiệp=occupation; Bác sĩ=doctor; Y tá=nurse; Bảo vệ=security guard; Ca sĩ=singer;
		Diễn viên=actor or actress; Chủ tịch=chairperson; Giám đốc=director, manager; Kế toán=accountant;
		Luật sư=lawyer; Lễ tân=receptionist; Nhân viên phục vụ=waiter or waitress; Nhân viên văn phòng=office worker;
		Nông dân=farmer; Thư ký=secretary; Đầu bếp=chef; Làm việc=work; Mua bán=buy and sell; Báo cáo=report`
	),
	topic(
		'school',
		'School',
		'Trường học',
		`Trường học=school; Trường Cao đẳng=college; Trường Đại học=university; Học sinh=pupil;
		Sinh viên=university student; Hiệu trưởng=principal; Học=study; Làm bài tập=do homework; Đọc=read;
		Viết=write; Sách=book; Vở=notebook; Bút bi=ballpoint pen; Bút chì=pencil; Cục tẩy=eraser;
		Thước kẻ=ruler; Viên phấn=chalk; Bảng=board; Giấy nháp=scrap paper; Ba lô=backpack;
		Dụng cụ học tập=school supplies; Kính lúp=magnifying glass; Máy chiếu=projector;
		Máy tính cầm tay=calculator; Quả địa cầu=globe; Nhà sách=bookstore`
	),
	topic(
		'places',
		'Places, countries & transport',
		'Địa điểm, quốc gia & phương tiện',
		`Nhà=house or home; Nhà trọ=boarding house; Bệnh viện=hospital; Chợ=market; Siêu thị=supermarket;
		Nhà hàng=restaurant; Quán cà phê=cafe; Ngân hàng=bank; Công ty=company; Công viên=park;
		Rạp chiếu phim=cinema; Thành phố=city; Tỉnh=province; Việt Nam=Vietnam; Mỹ=United States;
		Trung Quốc=China; Nhật Bản=Japan; Hàn Quốc=South Korea; Thái Lan=Thailand; Máy bay=airplane;
		Trực thăng=helicopter; Taxi=taxi; Thuyền=boat; Tàu hỏa=train; Xe buýt=bus; Xe máy=motorbike;
		Xe tải=truck; Xe đạp=bicycle; Ô tô=car`
	),
	topic(
		'home',
		'Around the home',
		'Đồ vật trong nhà',
		`Cái bàn=table; Cái ghế=chair; Giường=bed; Gối (đầu)=pillow; Mền=blanket; Cái cửa=door;
		Cửa sổ=window; Tường=wall; Cái đèn=lamp; Quạt (đứng)=standing fan; Máy điều hòa=air conditioner;
		Tủ lạnh=refrigerator; Máy giặt=washing machine; Tivi=television; Điện thoại=phone; Laptop=laptop;
		Bàn phím=keyboard; Chìa khóa=key; Cái kéo=scissors; Đồ dùng=household items`
	),
	topic(
		'clothes',
		'Clothes & colors',
		'Quần áo & màu sắc',
		`Cái áo=shirt; Áo sơ mi=dress shirt; Áo thun=T-shirt; Áo đầm=dress; Cái quần=pants;
		Quần thun=stretch pants; Quần tây=trousers; Quần đùi=shorts; Mũ=hat; Mũ bảo hiểm=helmet;
		Giày=shoes; Dép=sandals; Khăn quàng cổ=scarf; Túi xách=handbag; Dây chuyền=necklace;
		Vòng tay=bracelet; Kẹp tóc=hair clip; Đồ buộc tóc=hair tie; Đồng hồ đeo tay=wristwatch;
		Màu cam=orange (color); Màu hồng=pink; Màu nâu=brown; Màu trắng=white; Màu tím=purple;
		Màu vàng=yellow; Màu xanh da trời=blue; Màu xanh lá cây=green; Màu đen=black; Màu đỏ=red`
	),
	topic(
		'daily',
		'Daily life & actions',
		'Sinh hoạt & hành động',
		`Thức dậy=wake up; Ngủ=sleep; Nghỉ ngơi=rest; Tắm rửa=bathe; Gội đầu=wash hair;
		Rửa mặt=wash face; Rửa tay=wash hands; Rửa chén=wash dishes; Giặt đồ=do laundry;
		Phơi đồ=hang clothes to dry; Đi=go; Khám bệnh=see a doctor; Bắt chước=imitate; Chú ý=pay attention;
		Cung cấp=provide; Dừng lại=stop; Giúp đỡ=help; Quan sát=observe; Tiếp tục=continue;
		Thay đổi=change; Thử=try; Tìm=look for; Xem=watch or look; Có=have`
	),
	topic(
		'feelings',
		'Feelings & health',
		'Cảm xúc & sức khỏe',
		`Cảm thấy=feel; Thích=like; Yêu thương=love; Ghét=hate; Muốn=want; Hy vọng=hope; Dỗi=sulk;
		Cười=laugh or smile; Khóc=cry; Mệt=tired; Ốm=sick; Đau=pain or hurt; Khỏe=healthy or well;
		Bận=busy; Chết=die`
	),
	topic(
		'communication',
		'Communication & manners',
		'Giao tiếp & quy tắc',
		`Cảm ơn=thank you; Xin lỗi=sorry; Xin=ask for or please; Gọi=call; Giới thiệu=introduce;
		Hứa=promise; Khoe khoang=boast; Mách=tell on someone; Nghe=listen or hear; Nói=say or speak;
		Nói chuyện=talk or chat; Đồng ý=agree; Từ chối=refuse; Đúng=correct; Sai=wrong;
		Nhầm lẫn=mistake or mix up; Cho=give or allow; Không cho=not allow; Cần=need; Không cần=not need;
		Nên=should; Không nên=should not; Bắt buộc=compulsory; Vâng lời=obedient;
		Không nghe lời=disobedient; Quen=familiar; Không quen=unfamiliar`
	),
	topic(
		'people',
		'Personality & appearance',
		'Tính cách & ngoại hình',
		`Chăm chỉ=hardworking; Lười biếng=lazy; Dũng cảm=brave; Dữ=fierce; Hiền=gentle; Hài hước=funny;
		Hư=naughty; Ngoan=well-behaved; Ngu ngốc=stupid; Sáng tạo=creative; Tham lam=greedy;
		Thông minh=smart; Tốt bụng=kind; Giỏi=skilled or excellent; Già=old (person); Trẻ=young;
		Giàu=rich; Nghèo=poor; Mập=plump; Cao (người)=tall (person); Lùn=short (person);
		Đẹp (người)=beautiful (person); Xấu (người)=ugly (person); Mạnh=strong; Yếu=weak`
	),
	topic(
		'physical',
		'State & size',
		'Trạng thái & kích thước',
		`Cao (đồ vật)=tall or high (object); Thấp (đồ vật)=low (object); Dài=long; Ngắn=short;
		Rộng=wide or loose; Hẹp=narrow; Chật=tight or cramped; Cứng=hard; Mềm=soft; Nặng=heavy; Nhẹ=light;
		Gần=near; Xa=far; Cũ=old (thing); Mới=new; Dơ=dirty; Sạch sẽ=clean; Khô=dry; Ướt=wet; Nóng=hot;
		Lạnh=cold; Ấm=warm; Mát mẻ=cool or fresh`
	),
	topic(
		'quality',
		'Quality & degree',
		'Đánh giá & mức độ',
		`Nhanh=fast; Chậm chạp=slow; Dễ=easy; Khó=difficult; Dở=bad or poor; Hay (khen)=good or great;
		Thú vị=interesting; Yên tĩnh=quiet; Ồn ào=noisy; Rẻ=cheap; Đắt=expensive; Đậm=dark or strong;
		Đẹp (vật)=beautiful (thing); Xấu (vật)=ugly or bad (thing)`
	)
];

const topicByLabel = new Map(TOPICS.flatMap((t) => Object.keys(t.words).map((w) => [w, t] as const)));

export const topicOf = (label: string): Topic | undefined => topicByLabel.get(label);

export const englishOf = (label: string): string => topicByLabel.get(label)?.words[label] ?? '';

/** "Cao (người)" -> "Cao": labels sharing a base word are listed as similar signs. */
export const baseWord = (label: string): string => label.replace(/\s*\(.*\)$/, '');

export const similarTo = (label: string, labels: string[]): string[] =>
	labels.filter((other) => other !== label && baseWord(other) === baseWord(label));

// Videos are named by the label's 1-based position in labels.json: w001.mp4 ... w400.mp4.
const stem = (index: number) => `/videos/w${String(index + 1).padStart(3, '0')}`;
export const videoPath = (index: number) => `${stem(index)}.mp4`;
export const posterPath = (index: number) => `${stem(index)}.jpg`;

/** Fisher-Yates shuffle (copy). */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Quiz options: the answer plus 3 distractors, same-topic first, never a same-base-word label. */
export function pickOptions(answer: string, labels: string[], rng: () => number = Math.random): string[] {
	const ok = (w: string) => w !== answer && baseWord(w) !== baseWord(answer);
	const sameTopic = Object.keys(topicOf(answer)?.words ?? {}).filter(ok);
	const others = labels.filter((w) => ok(w) && !sameTopic.includes(w));
	const distractors = [...shuffle(sameTopic, rng), ...shuffle(others, rng)].slice(0, 3);
	return shuffle([answer, ...distractors], rng);
}
