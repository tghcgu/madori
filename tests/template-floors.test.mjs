import assert from 'node:assert/strict';
import test from 'node:test';
import { openTemplateStairwells, stairFootprint } from '../src/template-floors.ts';
import { floorPolygon, pointInPolygon, signedArea } from '../src/floor-outline.ts';

const stair = { id:'stairs', type:'furniture', kind:'stairs', x:100,y:100,w:100,h:280,rotation:0 };
const room = { id:'floor',type:'room',name:'Hall',x:0,y:0,w:600,h:600,color:'#ffffff' };

test('template stairwells preserve room properties and are idempotent without mutating stairs', () => {
  const floors = [{entities:[stair]},{entities:[room]}];
  openTemplateStairwells(floors,()=> 'extra');
  const cut = floors[1].entities[0];
  assert.equal(cut.id,room.id);
  assert.equal(cut.name,room.name);
  assert.equal(cut.color,room.color);
  assert.equal(pointInPolygon(150,150,floorPolygon(cut)),false);
  assert.equal(pointInPolygon(300,300,floorPolygon(cut)),true);
  const once=JSON.stringify(floors);
  openTemplateStairwells(floors,()=> 'extra');
  assert.equal(JSON.stringify(floors),once);
  assert.equal(floors[0].entities[0],stair);
  assert.equal(room.holes,undefined);
});

test('stairs cutting an edge or separating a floor create editable outlines with unique ids', () => {
  const floors=[{entities:[{...stair,x:0,y:200,w:600,h:100}]},{entities:[room]}];
  openTemplateStairwells(floors,()=> 'split');
  const pieces=floors[1].entities;
  assert.equal(pieces.length,2);
  assert.deepEqual(pieces.map(r=>r.id),['floor','split']);
  assert.deepEqual(pieces.map(r=>r.name),['Hall','']);
  assert.ok(!pieces.some(r=>pointInPolygon(250,250,floorPolygon(r))));
});

test('rotated stairs and spiral stairs have matching openings', () => {
  const rotated=stairFootprint({...stair,rotation:90});
  assert.ok(Math.abs(signedArea(rotated)-28000)<1e-5);
  const spiral=stairFootprint({...stair,kind:'stairsSpiral',w:140,h:140,rotation:45});
  assert.equal(spiral.length,48);
  assert.ok(Math.abs(Math.abs(signedArea(spiral))-Math.PI*70**2)<50);
});
