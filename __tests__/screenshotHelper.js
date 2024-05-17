const puppeteer = require("puppeteer");
const PNG = require("pngjs").PNG;
const pixelmatch = require("pixelmatch");
const fs = require("fs");
const sharp = require("sharp");

async function takeScreenshot(fn, viewport = { width: 1200, height: 2000 }) {
	const browser = await puppeteer.launch({ headless: "new"});
	try {
		const page = await browser.newPage({ context: "incognito" });
		await page.setViewport(viewport);
		await page.goto("http://localhost:9900/");

		await fn(page);
	} finally {
		await browser.close();
	}
}

async function calculateLayoutScore(currentPath, expectPath, outputPath) {
	// 画像を同じサイズにリサイズ
	const [resizedPath1, resizedPath2] = await resizeImageToMatch(
		currentPath,
		expectPath,
		outputPath.split("/").pop(),
	);

	const img1 = PNG.sync.read(fs.readFileSync(resizedPath1));
	const img2 = PNG.sync.read(fs.readFileSync(resizedPath2));
	const { width, height } = img1;
	const diff = new PNG({ width, height });

	const numDiffPixels = pixelmatch(
		img1.data,
		img2.data,
		diff.data,
		width,
		height,
		{ threshold: 0.1 },
	);

	// 最大許容差分ピクセル数を画像の全ピクセル数として計算
	const maxDiffPixels = width * height;
	const score = (1 - numDiffPixels / maxDiffPixels) * 100;
	fs.writeFileSync(outputPath, PNG.sync.write(diff));
	return { score, numDiffPixels, maxDiffPixels };
}

async function resizeImageToMatch(currentPath, expectPath, outputFileName) {
	const resultPath = [currentPath, expectPath];
	// 画像を読み込む
	const image1 = sharp(resultPath[0]);
	const image2 = sharp(resultPath[1]);

	// 画像のメタデータを取得
	const metadata1 = await image1.metadata();
	const metadata2 = await image2.metadata();

	// 小さいサイズに合わせる
	const targetWidth = Math.min(metadata1.width, metadata2.width);
	const targetHeight = Math.min(metadata1.height, metadata2.height);

	// リサイズ（必要に応じて）
	if (metadata1.width !== targetWidth || metadata1.height !== targetHeight) {
		await image1
			.resize(targetWidth, targetHeight)
			.toFile(`__tests__/resized-current-${outputFileName}`);
		resultPath[0] = `__tests__/resized-current-${outputFileName}`;
	}

	if (metadata2.width !== targetWidth || metadata2.height !== targetHeight) {
		await image2
			.resize(targetWidth, targetHeight)
			.toFile(`__tests__/resized-expect-${outputFileName}`);
		resultPath[1] = `__tests__/resized-expect-${outputFileName}`;
	}

	return resultPath;
}

module.exports = { calculateLayoutScore, takeScreenshot };
