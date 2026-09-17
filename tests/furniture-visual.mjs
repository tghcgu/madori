import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const output = '.codex/furniture-quality';
await mkdir(output, { recursive: true });
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#edf0f1;font:14px system-ui}canvas{display:block}#labels{position:absolute;inset:0;pointer-events:none}label{position:absolute;padding:8px 14px;color:#35444a;background:#ffffffdd;font-weight:600}
</style></head><body><canvas id="gallery"></canvas><div id="labels"></div><script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import {buildFurnitureModel} from '/src/furniture-models.ts';
import {FURNITURE_DEFS} from '/src/furniture-catalog.ts';
import {buildOpeningModel} from '/src/opening-models.ts';
const entries=[...Object.entries(FURNITURE_DEFS),
  ['door',{label:'Door',type:'door',length:0.9}],
  ['sliding-door',{label:'Sliding door',type:'door',doorStyle:'sliding',length:1.6}],
  ['window',{label:'Window',type:'window',length:1.2}],
  ['double-window',{label:'Double window',type:'window',mullion:true,length:1.6}]
], columns=4, width=320, height=290;
const canvas=document.querySelector('canvas'), renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(columns*width,Math.ceil(entries.length/columns)*height); renderer.setScissorTest(true);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
const stats=[];
for(const [index,[kind,def]] of entries.entries()) {
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xf0f3f4);
  const model=def.type?buildOpeningModel(def):buildFurnitureModel({kind,...def});scene.add(model);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const span=Math.max(size.x,size.y,size.z), distance=span*2.1;
  const camera=new THREE.PerspectiveCamera(35,width/height,0.01,100);
  camera.position.set(center.x+distance*0.77,center.y+distance*0.6,center.z+distance);camera.lookAt(center);
  scene.add(new THREE.HemisphereLight(0xf8fbff,0x939b96,2.4));
  const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-span,span*2,span*1.5);sun.castShadow=true;
  sun.shadow.mapSize.set(512,512);sun.shadow.camera.left=-span;sun.shadow.camera.right=span;sun.shadow.camera.top=span*2;sun.shadow.camera.bottom=-span;
  sun.shadow.bias=-0.001;scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(span*8,span*8),new THREE.MeshStandardMaterial({color:0xe7ecec,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-0.008;ground.receiveShadow=true;scene.add(ground);
  const row=Math.floor(index/columns),col=index%columns,y=canvas.height-(row+1)*height;
  renderer.setViewport(col*width,y,width,height);renderer.setScissor(col*width,y,width,height);renderer.render(scene,camera);
  const label=document.createElement('label');label.textContent=def.label;label.style.left=col*width+'px';label.style.top=row*height+'px';document.querySelector('#labels').append(label);
  stats.push({kind,draws:model.children.length,triangles:renderer.info.render.triangles});
  scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
}
window.galleryStats=stats;
</script></body></html>`;
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'furniture-gallery',
  configureServer(server) { server.middlewares.use('/__furniture-gallery', async (_, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(await server.transformIndexHtml('/__furniture-gallery', html));
  }); },
}] });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 2900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/__furniture-gallery', server.resolvedUrls.local[0]).href);
  await page.waitForFunction(() => window.galleryStats?.length === 38);
  assert.deepEqual(errors, []);
  const stats = await page.evaluate(() => {
    const canvas = document.querySelector('canvas'), copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
    const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);
    return window.galleryStats.map((entry,index)=>{
      const {data}=ctx.getImageData(index%4*320,Math.floor(index/4)*290,320,290),colors=new Set();
      for(let i=0;i<data.length;i+=64)colors.add(data[i]+','+data[i+1]+','+data[i+2]);
      return {...entry,colors:colors.size};
    });
  });
  for (const entry of stats) assert.ok(entry.colors > 40, `${entry.kind}: blank canvas`);
  for (let part = 0; part < 4; part += 1) await page.screenshot({ path: `${output}/catalog-${part + 1}.png`, clip: { x: 0, y: part * 870, width: 1280, height: Math.min(870, 2900-part*870) } });
  console.log(JSON.stringify(stats));
} finally {
  await browser?.close();
  await server.close();
}
