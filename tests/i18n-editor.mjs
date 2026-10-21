import assert from 'node:assert/strict';

// 言語: 上のバーの「言語」で英語・韓国語・繁体字中国語にすると、画面の文字がその言語になり（訳し残しがない）、
// ブラウザに覚え、日本語に戻せる。テンプレートの部屋の名前はその言語で作り、利用者が書いた名前は変えない
export async function verifyLanguages({ open, plan }) {
  const room = { id: 'living', type: 'room', name: 'リビング', x: 0, y: 0, w: 600, h: 400, color: '#ffffff', surface: 'wood' };
  const page = await open(JSON.stringify(plan([room])));
  try {
    const toolLabel = () => page.locator('.tool-button[data-tool="select"] span').textContent();
    const choose = async (language) => {
      await page.locator('#languageSelect').selectOption(language);
      await page.waitForFunction((language) => document.documentElement.lang === language && !('i18nPending' in document.documentElement.dataset), language);
    };
    // 画面に残った日本語（訳していない所は飛ばす。アプリの日本語の名前を含むクレジットの文は除く）
    const leftovers = () => page.evaluate(() => {
      const JA = /[぀-ヿ㐀-鿿]/;
      const found = new Set();
      const skipped = (element) => element.closest('script, style, textarea, [data-i18n-skip]');
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement && !skipped(node.parentElement) && JA.test(node.data)) found.add(node.data.trim());
      }
      for (const element of document.querySelectorAll('[title], [aria-label], [placeholder], [alt]')) {
        if (skipped(element)) continue;
        for (const name of ['title', 'aria-label', 'placeholder', 'alt']) {
          const value = element.getAttribute(name);
          if (value && JA.test(value)) found.add(`${name}: ${value}`);
        }
      }
      return [...found].filter((text) => !text.includes('間取りクイック3D'));
    });

    assert.equal(await toolLabel(), '選択');
    await choose('en');
    assert.equal(await toolLabel(), 'Select');
    assert.equal(await page.title(), 'Madori Quick 3D');
    // 一覧を全部開き、部屋を選んで欄を出しても、日本語が残らない
    await page.evaluate(() => document.querySelectorAll('details').forEach((details) => { details.open = true; }));
    const at = await page.evaluate(() => window.__editorTest.planPoint(300, 200));
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(300);
    assert.deepEqual(await leftovers(), [], 'every text on screen is in English');
    assert.equal(await page.locator('#roomNameInput').inputValue(), 'リビング', 'a name the user wrote stays as written');
    // 英語の名前でも探せる
    await page.locator('#paletteSearch').fill('refrigerator');
    assert.equal(await page.locator('button[data-furniture="fridge"]').first().isVisible(), true, 'search finds furniture by its English name');
    await page.locator('#paletteSearch').fill('');
    // テンプレートの部屋の名前は英語で作る
    const names = await page.evaluate(() => window.__editorTest.templateSnapshot('oneLdk').floors.flatMap((floor) => floor.entities).filter((item) => item.type === 'room' && item.name).map((item) => item.name));
    assert.ok(names.length > 0 && names.every((name) => !/[぀-ヿ㐀-鿿]/.test(name)), `template rooms are named in English: ${names.join(', ')}`);
    // 確かめの窓も英語
    let message = '';
    page.once('dialog', (dialog) => { message = dialog.message(); dialog.dismiss(); });
    await page.locator('#resetButton').click();
    await page.waitForTimeout(200);
    assert.equal(message, 'Clear the current plan and start a new one?');
    // 開き直しても英語のまま
    await page.reload();
    await page.waitForFunction(() => document.documentElement.lang === 'en' && !('i18nPending' in document.documentElement.dataset) && Boolean(window.__editorTest));
    assert.equal(await toolLabel(), 'Select', 'the language is remembered');
    // 韓国語・繁体字中国語
    await choose('ko');
    assert.equal(await toolLabel(), '선택');
    await choose('zh-Hant');
    assert.equal(await toolLabel(), '選取');
    // URL の ?lang= でも開ける
    await page.goto(new URL('?lang=ko', page.url()).href);
    await page.waitForFunction(() => document.documentElement.lang === 'ko' && !('i18nPending' in document.documentElement.dataset) && Boolean(window.__editorTest));
    assert.equal(await toolLabel(), '선택', '?lang=ko opens in Korean');
    // 日本語に戻すと元の文に戻り、間取りのデータは変わらない
    await choose('ja');
    assert.equal(await toolLabel(), '選択');
    assert.equal(await page.locator('#paletteSearch').getAttribute('placeholder'), 'パーツを検索（例: いす、窓、屋根）');
    const saved = await page.evaluate(() => window.__editorTest.snapshot());
    assert.equal(saved.floors[0].entities.find((item) => item.id === 'living').name, 'リビング', 'switching languages never changes the plan');
    console.log('PASS: languages: English, Korean and Traditional Chinese for every text on screen, search by translated names, templates named in the language, translated dialogs, remembered after a reload, ?lang= links, and back to Japanese');
  } finally {
    await page.context().close();
  }
}
