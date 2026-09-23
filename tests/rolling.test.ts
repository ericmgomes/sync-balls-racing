import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS } from '../src/game/config';
import type { Track } from '../src/game/types';
import { generatePuzzle } from '../src/generation/generatePuzzle';
import { rollingOrientation, rotateSurface } from '../src/rendering/rolling';

test('a esfera dá uma volta por circunferência percorrida, sem depender de frames', () => {
  const length = 2*Math.PI*PHYSICS.ballRadius;
  const track: Track = {id:0,name:'Teste',color:'#fff',path:[{x:0,y:0,z:0},{x:0,y:length,z:0}],
    cumulativeLengths:[0,length],length,travelDuration:1000,cumulativeTimes:[],speeds:[]};
  const quarter = rotateSurface(rollingOrientation(track,.25),[0,0,1]);
  assert.ok(Math.abs(quarter[0])<1e-10 && Math.abs(quarter[1]-1)<1e-10 && Math.abs(quarter[2])<1e-10);
  const full = rotateSurface(rollingOrientation(track,1),[0,0,1]);
  assert.ok(Math.abs(full[2]-1)<1e-10);
  rollingOrientation(track,.8);
  assert.deepEqual(rotateSurface(rollingOrientation(track,.25),[0,0,1]),quarter);
});

test('curvas preservam a superfície da esfera e o reinício restaura sua orientação', () => {
  for (const track of generatePuzzle(2792489626).tracks) {
    for (const progress of [.1,.5,.9,1]) {
      const point = rotateSurface(rollingOrientation(track,progress),[0,0,1]);
      assert.ok(Math.abs(Math.hypot(...point)-1)<1e-10);
    }
    assert.deepEqual(rollingOrientation(track,0),[0,0,0,1]);
  }
});
