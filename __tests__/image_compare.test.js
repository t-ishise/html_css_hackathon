const assert = require("node:assert/strict");
const { test, describe, after, before } = require("node:test");
const { calculateLayoutScore, takeScreenshot } = require("./screenshotHelper");
const { spawn } = require("child_process");
let server;
describe("tests", () => {
	before(async function () {
		// `http-server`を起動するディレクトリを指定
		const serverDir = "./docs";
		// http-serverを子プロセスとして起動
		server = spawn("npm", ["run", "server", "--", serverDir, "-p", "9900"], {
			shell: true,
			detached: true,
		});

		await new Promise((resolve) => {
			server.stdout.on('data', (data) => {
				const output = data.toString();
				if (output.includes('Available on:')) {
						// http-serverが起動したことを示すメッセージ
						console.log('Server started');
						resolve(); // サーバーが起動したのでPromiseを解決
				}
			});
		});
	});
	after(async function () {
		process.kill(-server.pid);
		console.log("Server stopped");
	});
	test("Screenshots are similar enough", async () => {
		const sections = [
			"#home", "#languages", "#features", "#pricing", "#students",
			"#message-section", "#columns", "#contact", "#footer"
		];

		let layoutScore = 0

		for (const section of sections) {
			const currentPath = `__tests__/${section.substring(1)}_layout_current.png`;
			const expectPath = `__tests__/${section.substring(1)}_layout_expect.png`;
			const diffPath = `__tests__/${section.substring(1)}_layout_diff.png`;

			await takeScreenshot(
				async (page) => {
					const element = await page.$(section);
					await element.screenshot({ path: currentPath });
				},
				{ width: 1200, height: 2000 },
			);

			const { score } = await calculateLayoutScore(
				currentPath,
				expectPath,
				diffPath,
			);
			console.log(`${section} のスコア: ${score}`)
			layoutScore += score
		}
		// セクションの数で割る
		layoutScore = layoutScore / sections.length
		console.log(`レイアウトのスコア: ${layoutScore}`)

		// uvp detail button clicked for first view
		const currentPath2 = "__tests__/uvp_element_current.png";
		const expectPath2 = "__tests__/uvp_element_expect.png";
		const diffPath2 = "__tests__/uvp_element_diff.png";
		await takeScreenshot(
			async (page) => {
				await page.click("#read-more");
				await page.waitForTimeout(1000); // JSのアニメーションを1秒待つ

				// 特定の要素のスクリーンショットを撮る。セレクタは実際の要素に合わせてください。
				const element = await page.$(".top-detail");
				await element.screenshot({ path: currentPath2 });
			},
			{ width: 1200, height: 1000 },
		);
		const { score: score2 } = await calculateLayoutScore(
			currentPath2,
			expectPath2,
			diffPath2,
		);

		// apply plan modal button clicked for choice courses
		const currentPath3 = "__tests__/choice_courses_element_current.png";
		const expectPath3 = "__tests__/choice_courses_element_expect.png";
		const diffPath3 = "__tests__/choice_courses_element_diff.png";
		let hasImplemented = false;
		await takeScreenshot(
			async (page) => {
				await page.click("#middle");
				await page.waitForTimeout(1000); // JSのアニメーションを1秒待つ

				const element = await page.$("#apply-modal");
				if (element === null) {
					return;
				}
				// 要素が画面上に表示されているか確認
				const isVisible = await page.evaluate((el) => {
					const rect = el.getBoundingClientRect();
					return (
						rect.width > 0 &&
						rect.height > 0 &&
						getComputedStyle(el).visibility !== "hidden"
					);
				}, element);
				if (isVisible) {
					hasImplemented = true;
					await element.screenshot({ path: currentPath3 });
				}
			},
			{ width: 1200, height: 1000 },
		);
		const { score: score3 } = await calculateLayoutScore(
			hasImplemented ? currentPath3 : "__tests__/mock.png",
			expectPath3,
			diffPath3,
		);

		const currentPath4 = "__tests__/contact_form_element_current.png";
		const expectPath4 = "__tests__/contact_form_element_expect.png";
		const diffPath4 = "__tests__/contact_form_element_diff.png";
		await takeScreenshot(
			async (page) => {
				// フォームに入力するデータを設定（必要に応じて）
				await page.type("#email-input", "example@test.com");
				await page.type("#subject-input", "subjectA");
				await page.type("#message-input", "xxxxxxxx");
				await page.click(".btn-contact");

				await page.waitForTimeout(500); // JSのアニメーションを1秒待つ

				// 特定の要素のスクリーンショットを撮る。セレクタは実際の要素に合わせてください。
				const element = await page.$(".contact-form");
				await element.screenshot({ path: currentPath4 });
			},
			{ width: 1200, height: 1000 },
		);
		const { score: score4 } = await calculateLayoutScore(
			currentPath4,
			expectPath4,
			diffPath4,
		);

		// ANSWER score: 100.00 + 100.00 + 100.00 _ 100.00 = 400.00
		const threshold = 130; // CSSさえ合っていれば十分
		const scoreMessage = `あなたのスコア: ${
				layoutScore + score2 + score3 + score4
			} (layout: ${layoutScore}), (uvp: ${score2}), (choice courses: ${score3}), (contact form: ${score4})`
		console.log(scoreMessage)
		assert(
			layoutScore + score2 + score3 + score4 >= threshold,
			`スクリーンショットのスコアが${threshold}未満です。${scoreMessage}`,
		);
	});
});
