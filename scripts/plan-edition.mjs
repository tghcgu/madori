// 間取り専用版（3Dなし）は、本体と同じ画面を /plan/ で開く。
// 画面の部品や読み込むファイルは同じなので、ビルドした index.html を plan/ にもそのまま置く
// （index.html の先頭で場所を見て、間取り専用版として動く）
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/plan', { recursive: true });
await copyFile('dist/index.html', 'dist/plan/index.html');
console.log('plan edition: dist/plan/index.html');
