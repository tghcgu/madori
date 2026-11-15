import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// Google の検索結果に出るサイト名（ドメインの所）の手がかり。*.pages.dev は名前が決まらないと「Cloudflare」と出ることがあるので、
// WebSite の構造化データ・title・og:site_name・見出しをそろえ、決まらないときの控えにサブドメインを小文字で入れておく
// （https://developers.google.com/search/docs/appearance/site-names の「What to do if your preferred site name isn't selected」）
const html = await readFile('index.html', 'utf8');
const NAME = '間取りクイック3D';
const HOME = 'https://madori-5yu.pages.dev/';

const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));

test('the home page names the site in one WebSite node, with the subdomain as a lowercase fallback', () => {
  const sites = blocks.filter(block => block['@type'] === 'WebSite');
  assert.equal(sites.length, 1, 'only one WebSite node');
  const [site] = sites;
  assert.equal(site.name, NAME);
  assert.equal(site.url, HOME, 'url is the canonical home page');
  assert.ok(site.alternateName.includes('madori-5yu.pages.dev'), 'the subdomain is an alternate name');
  assert.ok(site.alternateName.every(name => name !== NAME), 'alternate names differ from the name');
});

test('the title, site name, heading and canonical agree with the structured data', () => {
  assert.equal(html.match(/<title>([^<]*)<\/title>/)?.[1], NAME);
  assert.equal(html.match(/property="og:site_name" content="([^"]*)"/)?.[1], NAME);
  assert.equal(html.match(/name="application-name" content="([^"]*)"/)?.[1], NAME);
  assert.equal(html.match(/<h1>([^<]*)<\/h1>/)?.[1], NAME);
  assert.equal(html.match(/<link rel="canonical" href="([^"]*)"/)?.[1], HOME);
  assert.equal(html.match(/property="og:url" content="([^"]*)"/)?.[1], HOME);
  assert.match(html, /<meta name="robots" content="index, follow/, 'the home page can be indexed');
});
