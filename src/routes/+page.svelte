<script lang="ts">
	import "7.css/dist/7.css";

	const features = [
		{
			icon: "??",
			title: "AI Thoi Gian Thuc",
			desc: "Nhan dien ngon ngu ky hieu tuc thi qua webcam voi mo hinh Transformer da goc nhin."
		},
		{
			icon: "???",
			title: "75 Diem Khung Xuong",
			desc: "Theo doi 33 diem co the + 21 diem tay trai + 21 diem tay phai nho MediaPipe."
		},
		{
			icon: "??",
			title: "Camera & Video",
			desc: "Ho tro nhap lieu tu webcam truc tiep hoac tai video len de phan tich."
		},
		{
			icon: "??",
			title: "400 Tu Vung VSL",
			desc: "Nhan dien 400 tu/cum tu trong ngon ngu ky hieu Viet Nam voi do chinh xac ~90%."
		}
	];
</script>

<svelte:head>
	<title>VSL - Nhan Dien Ngon Ngu Ky Hieu Viet Nam</title>
</svelte:head>

<div class="page">
	<section class="hero">
		<div class="hero-content">
			<div class="badge">???? Ngon Ngu Ky Hieu Viet Nam</div>
			<h1 class="hero-title">
				Nhan Dien<br />
				<span class="gradient-text">Ngon Ngu Ky Hieu</span><br />
				Thoi Gian Thuc
			</h1>
			<p class="hero-subtitle">
				Cong nghe AI ket noi cong dong nguoi khiem thinh. Chuyen doi ngon ngu ky hieu VSL
				thanh van ban tuc thi qua camera, ngay tren trinh duyet cua ban.
			</p>
			<div class="hero-cta">
				<a href="/app" class="btn btn-primary">?? Vao Ung Dung</a>
				<a href="#features" class="btn btn-secondary">Tim hieu them ?</a>
			</div>
			<div class="stats">
				<div class="stat">
					<span class="stat-num">400</span>
					<span class="stat-label">Tu vung VSL</span>
				</div>
				<div class="stat-divider"></div>
				<div class="stat">
					<span class="stat-num">90%</span>
					<span class="stat-label">Do chinh xac</span>
				</div>
				<div class="stat-divider"></div>
				<div class="stat">
					<span class="stat-num">60fps</span>
					<span class="stat-label">Xu ly thoi gian thuc</span>
				</div>
			</div>
		</div>
		<div class="hero-visual">
			<div class="window active hero-window">
				<div class="title-bar">
					<div class="title-bar-text">?? Camera � Nhan Dien Ky Hieu</div>
					<div class="title-bar-controls">
						<button aria-label="Minimize"></button>
						<button aria-label="Maximize"></button>
						<button aria-label="Close"></button>
					</div>
				</div>
				<div class="window-body has-space demo-body">
					<div class="demo-camera">
						<div class="demo-skeleton">
							<div class="demo-figure">
								<div class="demo-head"></div>
								<div class="demo-torso"></div>
								<div class="demo-arm left-arm"></div>
								<div class="demo-arm right-arm">
									<div class="demo-hand"></div>
								</div>
							</div>
							<div class="scan-line"></div>
						</div>
					</div>
					<div class="demo-result">
						<span class="demo-label">Dang nhan dien:</span>
						<strong class="demo-prediction typing-effect">Xin chao</strong>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section id="features" class="features-section">
		<h2 class="section-title">Tinh Nang Noi Bat</h2>
		<p class="section-subtitle">Duoc xay dung voi cong nghe hien dai nhat</p>
		<div class="features-grid">
			{#each features as f (f.title)}
				<div class="window feature-card">
					<div class="title-bar">
						<div class="title-bar-text">{f.icon} {f.title}</div>
					</div>
					<div class="window-body has-space">
						<p>{f.desc}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="cta-section">
		<div class="window cta-window">
			<div class="title-bar">
				<div class="title-bar-text">San sang bat dau?</div>
				<div class="title-bar-controls">
					<button aria-label="Minimize"></button>
					<button aria-label="Maximize"></button>
					<button aria-label="Close"></button>
				</div>
			</div>
			<div class="window-body has-space cta-body">
				<h2>Bat Dau Ngay Bay Gio</h2>
				<p>Khong can cai dat. Khong can tai khoan. Chi can trinh duyet va webcam.</p>
				<a href="/app" class="btn btn-primary btn-large">??? Mo Ung Dung Nhan Dien</a>
			</div>
		</div>
	</section>

	<footer class="footer">
		<p>VSL Sign Language Recognition &copy; 2026</p>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #0d1117;
		color: #e6edf3;
		min-height: 100vh;
		font-family: 'Segoe UI', system-ui, sans-serif;
	}
	.page { min-height: 100vh; }

	/* HERO */
	.hero {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 48px;
		align-items: center;
		max-width: 1200px;
		margin: 0 auto;
		padding: 80px 32px;
		min-height: 90vh;
	}
	.hero-content { display: flex; flex-direction: column; gap: 24px; }
	.badge {
		display: inline-block;
		width: fit-content;
		background: rgba(88,166,255,0.1);
		border: 1px solid rgba(88,166,255,0.3);
		color: #58a6ff;
		padding: 6px 16px;
		border-radius: 20px;
		font-size: 0.85em;
		font-weight: 600;
	}
	.hero-title {
		font-size: clamp(2rem, 4vw, 3.2rem);
		font-weight: 800;
		line-height: 1.15;
		margin: 0;
		color: #f0f6fc;
	}
	.gradient-text {
		background: linear-gradient(135deg, #58a6ff 0%, #a78bfa 50%, #34d399 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
	.hero-subtitle { font-size: 1.05rem; color: #8b949e; line-height: 1.7; margin: 0; max-width: 500px; }
	.hero-cta { display: flex; gap: 16px; flex-wrap: wrap; }

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 14px 28px;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s ease;
		border: none;
		cursor: pointer;
	}
	.btn-primary {
		background: linear-gradient(135deg, #58a6ff, #a78bfa);
		color: #0d1117;
		box-shadow: 0 4px 20px rgba(88,166,255,0.3);
	}
	.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(88,166,255,0.45); }
	.btn-secondary { background: transparent; color: #8b949e; border: 1px solid rgba(139,148,158,0.3); }
	.btn-secondary:hover { color: #e6edf3; border-color: rgba(139,148,158,0.6); }
	.btn-large { font-size: 1.1rem; padding: 18px 40px; }

	.stats { display: flex; align-items: center; gap: 24px; padding: 20px 0; border-top: 1px solid rgba(139,148,158,0.15); }
	.stat { display: flex; flex-direction: column; gap: 2px; }
	.stat-num { font-size: 1.5rem; font-weight: 700; color: #58a6ff; }
	.stat-label { font-size: 0.75rem; color: #8b949e; }
	.stat-divider { width: 1px; height: 36px; background: rgba(139,148,158,0.2); }

	/* HERO WINDOW */
	.hero-visual { display: flex; justify-content: center; }
	.hero-window {
		width: 100%;
		max-width: 420px;
		background: #161b22 !important;
		border-color: rgba(88,166,255,0.3) !important;
		box-shadow: 0 0 40px rgba(88,166,255,0.1), 0 20px 60px rgba(0,0,0,0.5);
	}
	.demo-body { padding: 16px !important; display: flex; flex-direction: column; gap: 12px; }
	.demo-camera {
		background: #0d1117;
		border-radius: 8px;
		height: 220px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		border: 1px solid rgba(88,166,255,0.15);
	}
	.demo-skeleton { position: relative; width: 100%; height: 100%; }
	.demo-figure { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
	.demo-head { width: 36px; height: 36px; border-radius: 50%; border: 2px solid #58a6ff; margin: 0 auto 4px; box-shadow: 0 0 10px rgba(88,166,255,0.4); }
	.demo-torso { width: 2px; height: 60px; background: #58a6ff; margin: 0 auto; box-shadow: 0 0 8px rgba(88,166,255,0.5); }
	.demo-arm { position: absolute; width: 50px; height: 2px; background: #58a6ff; top: 56px; box-shadow: 0 0 8px rgba(88,166,255,0.5); }
	.left-arm { left: -50px; transform: rotate(20deg); transform-origin: right center; }
	.right-arm { right: -50px; transform: rotate(-30deg); transform-origin: left center; }
	.demo-hand { position: absolute; right: -22px; top: -8px; width: 22px; height: 22px; border: 2px solid #34d399; border-radius: 4px; box-shadow: 0 0 12px rgba(52,211,153,0.6); animation: pulse-hand 2s ease-in-out infinite; }
	@keyframes pulse-hand {
		0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(52,211,153,0.6); }
		50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(52,211,153,0.9); }
	}
	.scan-line { position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #58a6ff, transparent); animation: scan 3s ease-in-out infinite; }
	@keyframes scan {
		0% { top: 10%; opacity: 0; }
		10% { opacity: 1; }
		90% { opacity: 1; }
		100% { top: 90%; opacity: 0; }
	}
	.demo-result { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(88,166,255,0.08); border: 1px solid rgba(88,166,255,0.2); border-radius: 8px; }
	.demo-label { font-size: 0.8rem; color: #8b949e; flex-shrink: 0; }
	.demo-prediction { font-size: 1.1rem; color: #34d399; }
	.typing-effect { overflow: hidden; border-right: 2px solid #34d399; white-space: nowrap; animation: typing 3s steps(8) infinite, blink 0.75s step-end infinite; }
	@keyframes typing { 0%, 100% { width: 0; } 40%, 60% { width: 6.5ch; } }
	@keyframes blink { 0%, 100% { border-color: #34d399; } 50% { border-color: transparent; } }

	/* FEATURES */
	.features-section { max-width: 1200px; margin: 0 auto; padding: 80px 32px; text-align: center; }
	.section-title { font-size: 2rem; font-weight: 800; margin: 0 0 8px; color: #f0f6fc; }
	.section-subtitle { color: #8b949e; margin: 0 0 48px; font-size: 1rem; }
	.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; text-align: left; }
	.feature-card { background: #161b22 !important; border-color: rgba(139,148,158,0.2) !important; transition: border-color 0.2s, box-shadow 0.2s; }
	.feature-card:hover { border-color: rgba(88,166,255,0.4) !important; box-shadow: 0 0 20px rgba(88,166,255,0.07); }
	.feature-card :global(.window-body p) { color: #8b949e; line-height: 1.65; margin: 0; }

	/* CTA */
	.cta-section { max-width: 760px; margin: 0 auto; padding: 0 32px 80px; }
	.cta-window { background: #161b22 !important; border-color: rgba(88,166,255,0.3) !important; box-shadow: 0 0 40px rgba(88,166,255,0.08); }
	.cta-body { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; }
	.cta-body h2 { font-size: 1.8rem; font-weight: 800; margin: 0; color: #f0f6fc; }
	.cta-body p { color: #8b949e; margin: 0; }

	/* FOOTER */
	.footer { text-align: center; padding: 24px 32px; color: #484f58; font-size: 0.85rem; border-top: 1px solid rgba(139,148,158,0.1); }

	/* RESPONSIVE */
	@media (max-width: 860px) {
		.hero { grid-template-columns: 1fr; padding: 48px 24px; min-height: auto; text-align: center; }
		.badge, .hero-subtitle { margin-left: auto; margin-right: auto; }
		.hero-cta { justify-content: center; }
		.hero-visual { order: -1; }
		.hero-window { max-width: 100%; }
		.stats { justify-content: center; }
	}
</style>
