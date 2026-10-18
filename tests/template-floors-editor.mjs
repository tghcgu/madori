import assert from 'node:assert/strict';
import { floorPolygon, pointInPolygon } from '../src/floor-outline.ts';
import { isStair } from '../src/stairs.ts';
import { TEMPLATE_GROUPS } from '../src/templates.ts';

export async function verifyTemplateFloors({page,choose,output,pixels}) {
  const keys=await page.locator('[data-template]').evaluateAll(items=>items.map(item=>item.dataset.template));
  assert.equal(keys.length,TEMPLATE_GROUPS.flatMap(group=>group.templates).length);
  for(const key of keys) {
    const plan=await page.evaluate(key=>window.__editorTest.templateSnapshot(key),key);
    assert.ok(plan.floors.length,`${key} normalizes successfully`);
    for(let i=1;i<plan.floors.length;i++)for(const stair of plan.floors[i-1].entities.filter(isStair)) {
      const x=stair.x+stair.w/2,y=stair.y+stair.h/2;
      assert.ok(!plan.floors[i].entities.filter(e=>e.type==='room').some(r=>pointInPolygon(x,y,floorPolygon(r))),`${key} has an opening above its stairs`);
    }
  }
  const accept=dialog=>dialog.accept();
  page.on('dialog',accept);
  try {
    for(const key of ['wizardTower','castle','threeStory']) {
      await choose(`[data-template="${key}"]`);
      await page.locator('button[data-view-mode="split"]').click();
      await page.locator('#floorTabs .floor-tab-list button').filter({hasText:/^2F$/}).click();
      const roof=page.locator('#floorVisibility button').filter({hasText:'屋根'});
      if(await roof.getAttribute('aria-pressed')==='true')await roof.click();
      const third=page.locator('#floorVisibility button').filter({hasText:/^3F$/});
      if(await third.count() && await third.getAttribute('aria-pressed')==='true')await third.click();
      if(await page.locator('#roofToggle2d').getAttribute('aria-pressed')==='true')await page.locator('#roofToggle2d').click();
      const plan=await page.evaluate(()=>window.__editorTest.snapshot());
      assert.equal(await page.locator('#recoveryNotice').isVisible(),false);
      for(const stair of plan.floors[0].entities.filter(isStair)) {
        for(const floor of plan.floors[1].entities.filter(e=>e.type==='room'))assert.equal(await page.evaluate(([id,x,y])=>window.__editorTest.floorAt(id,x,y),[floor.id,stair.x+stair.w/2,stair.y+stair.h/2]),false,`${key} has a real opening in its 3D slab`);
      }
      assert.ok((await pixels()).colors>20,`${key} renders in 3D`);
      await page.screenshot({path:`${output}/template-${key}.png`});
      const before=JSON.stringify(plan.floors);
      await page.reload({waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>Boolean(window.__editorTest));
      assert.equal(JSON.stringify((await page.evaluate(()=>window.__editorTest.snapshot())).floors),before,'floor openings survive reload');
    }
  } finally {page.off('dialog',accept);}
  await page.setViewportSize({width:390,height:844});
  if(await page.locator('#panelToggle').getAttribute('aria-pressed')==='false')await page.locator('#panelToggle').click();
  await page.locator('button[data-view-mode="plan"]').click();
  await page.locator('#floorTabs .floor-tab-list button').filter({hasText:/^3F$/}).click();
  assert.equal((await page.evaluate(()=>window.__editorTest.snapshot())).activeFloor,2,'floor tabs remain clickable on mobile');
  await page.locator('#fitButton').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`${output}/template-mobile-plan.png`});
  await page.locator('button[data-view-mode="three"]').click();
  assert.ok((await pixels()).colors>20);
  await page.screenshot({path:`${output}/template-mobile-three.png`});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#panelToggle').click();
  await page.locator('button[data-view-mode="split"]').click();
  console.log(`PASS: all ${keys.length} templates normalize, upper slabs have stairwell openings, circular towers render and reload`);
}
