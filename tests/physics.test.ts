import test from 'node:test';
import assert from 'node:assert/strict';
import { motionProfile, progressAtTime } from '../src/game/Physics';
import { PHYSICS } from '../src/game/config';
import { generatePuzzle } from '../src/generation/generatePuzzle';
import { pointAtProgress } from '../src/game/Track';
import type { Point, Track } from '../src/game/types';

function track(path: Point[]): Track {
  const cumulativeLengths = [0];
  for(let i=1;i<path.length;i++) cumulativeLengths.push(cumulativeLengths[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y,(path[i].z??0)-(path[i-1].z??0)));
  return {id:0,color:'#fff',name:'Teste',path,cumulativeLengths,length:cumulativeLengths.at(-1)!,...motionProfile(path,cumulativeLengths)};
}

test('rolamento e resistência reduzem a velocidade em relação à queda ideal', () => {
  const ramp=track([{x:0,y:0,z:180},{x:0,y:300,z:0}]);
  assert.equal(ramp.speeds[0],0);
  assert.ok(Number.isFinite(ramp.travelDuration));
  assert.ok(ramp.speeds.at(-1)! < Math.sqrt(2*PHYSICS.gravity*180/PHYSICS.rollingInertia));
});

test('uma subida sem energia suficiente faz a bola parar e retornar', () => {
  const ramp=track([{x:0,y:0,z:100},{x:0,y:150,z:0},{x:0,y:300,z:120}]);
  assert.equal(ramp.travelDuration,Infinity);
  const reversed=ramp.motion!.findIndex(s=>s.speed < -1);
  assert.ok(reversed>0);
  const peak=Math.max(...ramp.motion!.map(s=>s.distance));
  assert.ok(peak<ramp.length);
  const before=ramp.motion![reversed];
  assert.ok(progressAtTime(ramp,before.time+100)<progressAtTime(ramp,before.time));
});

test('a energia mecânica não cresce ao atravessar vales e subidas', () => {
  const ramp=track([{x:0,y:0,z:100},{x:0,y:150,z:0},{x:0,y:300,z:120}]);
  let previous=Infinity;
  for(const sample of ramp.motion!) {
    const height=pointAtProgress(ramp,sample.distance/ramp.length).z!;
    const energy=PHYSICS.gravity*height+PHYSICS.rollingInertia*sample.speed**2/2;
    assert.ok(energy<=previous+0.001, `energia aumentou: ${previous} -> ${energy}`);
    previous=energy;
  }
});

test('trecho horizontal perde velocidade e não cria impulso', () => {
  const ramp=track([{x:0,y:0,z:100},{x:0,y:100,z:0},{x:0,y:300,z:0}]);
  const horizontal=ramp.motion!.filter(s=>s.distance>Math.hypot(100,100));
  assert.ok(horizontal.length>5);
  assert.ok(horizontal.at(-1)!.speed<horizontal[0].speed);
});

test('o gerador valida as pistas com resistência e preserva subidas reais', () => {
  for(let seed=0;seed<40;seed++) {
    for(const ramp of generatePuzzle(seed).tracks) {
      assert.ok(Number.isFinite(ramp.travelDuration));
      assert.equal(ramp.path[0].z,180);
      assert.equal(ramp.path.at(-1)!.z,0);
      assert.ok(ramp.path.some((p,i)=>i>0 && p.z!>ramp.path[i-1].z!+0.01));
      assert.equal(progressAtTime(ramp,ramp.travelDuration),1);
      assert.ok(ramp.motion!.every(s=>s.speed>=0));
    }
  }
});

test('mesma geometria e regras reproduzem exatamente a trajetória', () => {
  const ramp=generatePuzzle(48291).tracks[4];
  assert.deepEqual(motionProfile(ramp.path,ramp.cumulativeLengths).motion,ramp.motion);
});

test('perdas impedem até uma subida mais baixa que a largada', () => {
  const ramp=track([{x:0,y:0,z:100},{x:0,y:100,z:0},{x:0,y:500,z:0},{x:0,y:650,z:90}]);
  assert.equal(ramp.travelDuration,Infinity);
  assert.ok(ramp.motion!.some(sample=>sample.speed < -1));
  const highestDistance=Math.max(...ramp.motion!.map(sample=>sample.distance));
  assert.ok(highestDistance<ramp.length);
});

test('uma bola em repouso num trecho plano não recebe impulso artificial', () => {
  const ramp=track([{x:0,y:0,z:0},{x:0,y:100,z:0}]);
  assert.equal(ramp.travelDuration,Infinity);
  assert.equal(progressAtTime(ramp,10000),0);
});
