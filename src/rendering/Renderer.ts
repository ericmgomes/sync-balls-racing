import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BARRIER, PHYSICS, WORLD } from '../game/config';
import type { Game } from '../game/Game';
import { pointAtProgress } from '../game/Track';
import type { Point, Puzzle, Track } from '../game/types';
import { rollingOrientation } from './rolling';

const DECK = 24;
const toWorld = (p: Point, lift = 0) => new THREE.Vector3(p.x-WORLD.width/2, (p.z ?? 0)+DECK+lift, p.y-(WORLD.startY+WORLD.finishY)/2);

function printTexture() {
    const canvas = document.createElement('canvas');
    canvas.width=256; canvas.height=256;
    const context=canvas.getContext('2d')!;
    const image=context.createImageData(256,256);
    for (let y=0;y<256;y++) for (let x=0;x<256;x++) {
        const value=180+Math.sin(y*Math.PI/2)*16+((x*13+y*37)%17)-8;
        const i=(y*256+x)*4;
        image.data[i]=image.data[i+1]=image.data[i+2]=value; image.data[i+3]=255;
    }
    context.putImageData(image,0,0);
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    return texture;
}

// Sweep a closed, bevelled U section. Its centre is the physical running surface.
function channelGeometry(track: Track) {
    const section=[[-24,-5],[-24,14],[-22,17],[-19,17],[-17,14],[-15,3],[-11,0],[11,0],[15,3],[17,14],[19,17],[22,17],[24,14],[24,-5]];
    const vertices:number[]=[]; const indices:number[]=[]; const uvs:number[]=[];
    for (let edge=0;edge<section.length;edge++) {
        const base=vertices.length/3;
        for (let i=0;i<track.path.length;i++) {
            const p=track.path[i];
            const a=track.path[Math.max(0,i-1)]; const b=track.path[Math.min(track.path.length-1,i+1)];
            const length=Math.hypot(b.x-a.x,b.y-a.y)||1;
            const nx=-(b.y-a.y)/length; const nz=(b.x-a.x)/length;
            for (const j of [edge,(edge+1)%section.length]) {
                const [offset,height]=section[j];
                const position=toWorld(p,height);
                vertices.push(position.x+nx*offset,position.y,position.z+nz*offset);
                uvs.push(offset/48,track.cumulativeLengths[i]/32);
            }
            if (i>0) { const n=base+i*2; indices.push(n-2,n-1,n,n-1,n+1,n); }
        }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}

export class Renderer {
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.OrthographicCamera(-600,600,600,-600,1,5000);
    private controls: OrbitControls;
    private observer: ResizeObserver;
    private assembly = new THREE.Group();
    private balls: THREE.Mesh[]=[];
    private gate = new THREE.Group();
    private texture=printTexture();
    private environment: THREE.WebGLRenderTarget;
    private reflection = new THREE.WebGLCubeRenderTarget(128,{generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
    private chrome = new THREE.MeshStandardMaterial({color:0xffffff,metalness:1,roughness:.095});
    private width=1;
    private height=1;
    constructor(private canvas: HTMLCanvasElement, private puzzle: Puzzle) {
        this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
        this.renderer.setClearColor(0xf5f4ef,0);
        this.renderer.shadowMap.enabled=true;
        this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure=.88;
        const studio=new RoomEnvironment();
        const pmrem=new THREE.PMREMGenerator(this.renderer);
        this.environment=pmrem.fromScene(studio,.04);
        this.scene.environment=this.environment.texture;
        this.scene.environmentIntensity=.45;
        studio.dispose(); pmrem.dispose();
        this.scene.add(new THREE.HemisphereLight(0xffffff,0x7c7a86,.65));
        const key=new THREE.DirectionalLight(0xfff7ed,2.2);
        key.position.set(-450,1100,400); key.castShadow=true;
        key.shadow.mapSize.set(2048,2048);
        Object.assign(key.shadow.camera,{left:-750,right:750,top:800,bottom:-800,near:1,far:2200});
        key.shadow.bias=-.0003; key.shadow.normalBias=1.2;
        this.scene.add(key);
        const fill=new THREE.DirectionalLight(0xc9deff,.65); fill.position.set(650,500,-450); this.scene.add(fill);
        this.scene.add(this.assembly);
        this.controls=new OrbitControls(this.camera,canvas);
        this.controls.enablePan=false; this.controls.enableDamping=false;
        this.controls.minPolarAngle=.25; this.controls.maxPolarAngle=1.3;
        this.controls.minZoom=.65; this.controls.maxZoom=2;
        this.controls.target.set(0,65,0);
        this.controls.addEventListener('change',()=>this.fitCamera());
        this.resetView();
        this.setPuzzle(puzzle);
        this.observer=new ResizeObserver(()=>this.resize()); this.observer.observe(canvas);
        this.resize();
    }
    resetView() {
        this.camera.position.set(250,1050,1350);
        this.camera.zoom=1;
        this.camera.lookAt(0,65,0);
        this.controls?.target.set(0,65,0); this.controls?.update();
        this.resize();
    }
    private resize() {
        const rect=this.canvas.getBoundingClientRect();
        this.width=Math.max(1,rect.width); this.height=Math.max(1,rect.height);
        this.fitCamera();
        this.renderer.setSize(this.width,this.height,false);
    }
    private fitCamera() {
        const aspect=this.width/this.height;
        this.camera.updateMatrixWorld();
        let extentX=0; let extentY=0;
        for(const x of [-(WORLD.width-100)/2,(WORLD.width-100)/2]) {
            for(const y of [-15,DECK+200]) for(const z of [-(WORLD.finishY-WORLD.startY+110)/2,(WORLD.finishY-WORLD.startY+110)/2]) {
                const corner=new THREE.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse);
                extentX=Math.max(extentX,Math.abs(corner.x)); extentY=Math.max(extentY,Math.abs(corner.y));
            }
        }
        const halfHeight=Math.max(extentY+22,(extentX+22)/aspect);
        this.camera.left=-halfHeight*aspect; this.camera.right=halfHeight*aspect;
        this.camera.top=halfHeight; this.camera.bottom=-halfHeight;
        this.camera.updateProjectionMatrix();
    }
    projectPoint(point: Point, lift=PHYSICS.ballRadius) {
        const position=toWorld(point,lift).project(this.camera);
        return {x:(position.x+1)/2,y:(1-position.y)/2};
    }
    private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position?: THREE.Vector3) {
        const mesh=new THREE.Mesh(geometry,material);
        if(position) mesh.position.copy(position);
        mesh.castShadow=true; mesh.receiveShadow=true; this.assembly.add(mesh); return mesh;
    }
    private strut(a: THREE.Vector3,b: THREE.Vector3,radius: number,material: THREE.Material) {
        const direction=b.clone().sub(a);
        const mesh=this.mesh(new THREE.CylinderGeometry(radius,radius,direction.length(),10),material,a.clone().add(b).multiplyScalar(.5));
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    }
    private clearAssembly() {
        const geometries=new Set<THREE.BufferGeometry>(); const materials=new Set<THREE.Material>();
        this.assembly.traverse(object=>{ if(object instanceof THREE.Mesh) {
            geometries.add(object.geometry);
            const list=Array.isArray(object.material)?object.material:[object.material];
            list.forEach(material=>{if(material!==this.chrome) materials.add(material);});
        }});
        geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
        this.assembly.clear(); this.balls=[];
    }
    private batchStaticMeshes() {
        const groups=new Map<THREE.Material,THREE.Mesh[]>();
        for(const object of this.assembly.children) {
            if(!(object instanceof THREE.Mesh) || this.balls.includes(object) || Array.isArray(object.material)) continue;
            const meshes=groups.get(object.material) ?? [];
            meshes.push(object); groups.set(object.material,meshes);
        }
        for(const [material,meshes] of groups) {
            if(meshes.length<2) continue;
            const geometries=meshes.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});
            const merged=mergeGeometries(geometries);
            geometries.forEach(geometry=>geometry.dispose());
            if(!merged) continue;
            meshes.forEach(mesh=>{this.assembly.remove(mesh);mesh.geometry.dispose();});
            this.mesh(merged,material);
        }
    }
    setPuzzle(puzzle: Puzzle) {
        this.puzzle=puzzle; this.clearAssembly();
        const base=new THREE.MeshStandardMaterial({color:0xbbb9c2,metalness:.25,roughness:.44,bumpMap:this.texture,bumpScale:.22});
        const depth=WORLD.finishY-WORLD.startY+100;
        const width=WORLD.width-110;
        this.mesh(new THREE.BoxGeometry(width,14,depth),base,new THREE.Vector3(0,0,0));
        for(const x of [-width/2,width/2]) this.mesh(new THREE.BoxGeometry(8,22,depth),base,new THREE.Vector3(x,10,0));
        for(const z of [-depth/2,depth/2]) this.mesh(new THREE.BoxGeometry(width,22,8),base,new THREE.Vector3(0,10,z));
        const table=new THREE.ShadowMaterial({color:0x343443,opacity:.18});
        this.mesh(new THREE.BoxGeometry(10000,8,10000),table,new THREE.Vector3(0,-22,0));
        const sphere=new THREE.SphereGeometry(PHYSICS.ballRadius,40,28);
        for(const track of puzzle.tracks) {
            const plastic=new THREE.MeshPhysicalMaterial({color:track.color,roughness:.34,metalness:0,clearcoat:.22,clearcoatRoughness:.3,bumpMap:this.texture,bumpScale:.14,side:THREE.DoubleSide});
            this.mesh(channelGeometry(track),plastic);
            for(const progress of [0,.14,.29,.44,.59,.74,.89]) {
                const point=pointAtProgress(track,progress); const top=toWorld(point,-6);
                if(top.y<32) continue;
                for(const sign of [-1,1]) {
                    const foot=new THREE.Vector3(top.x+sign*15,9,top.z);
                    this.strut(foot,new THREE.Vector3(top.x+sign*15,top.y,top.z),4.5,plastic);
                    this.mesh(new THREE.CylinderGeometry(9,11,4,16),plastic,new THREE.Vector3(foot.x,9,foot.z));
                }
                this.strut(new THREE.Vector3(top.x-15,12,top.z),new THREE.Vector3(top.x+15,top.y-3,top.z),3,plastic);
                this.strut(new THREE.Vector3(top.x+15,12,top.z),new THREE.Vector3(top.x-15,top.y-3,top.z),3,plastic);
            }
            const ball=this.mesh(sphere,this.chrome,toWorld(track.path[0],PHYSICS.ballRadius));
            this.balls.push(ball);
        }
        this.gate=new THREE.Group();
        const barMaterial=new THREE.MeshStandardMaterial({color:0x626672,metalness:.72,roughness:.28});
        const barWidth=WORLD.width-174;
        const bar=new THREE.Mesh(new THREE.BoxGeometry(barWidth,17,5),barMaterial); bar.castShadow=true;
        this.gate.add(bar);
        this.gate.position.set(0,DECK-15,BARRIER.topY-(WORLD.startY+WORLD.finishY)/2);
        this.assembly.add(this.gate);
        for(const x of [-barWidth/2,barWidth/2]) this.mesh(new THREE.BoxGeometry(12,40,18),base,new THREE.Vector3(x,20,this.gate.position.z));
        this.batchStaticMeshes();
        this.balls.forEach(ball=>ball.visible=false);
        const softboxes=new THREE.Group();
        const lightPanel=new THREE.MeshBasicMaterial({color:0xffffff});
        const panelGeometry=new THREE.PlaneGeometry(520,800);
        for(const position of [new THREE.Vector3(-650,700,150),new THREE.Vector3(450,900,-350)]) {
            const panel=new THREE.Mesh(panelGeometry,lightPanel); panel.position.copy(position); panel.lookAt(0,100,0); softboxes.add(panel);
        }
        this.scene.add(softboxes);
        this.scene.background=new THREE.Color(0x55555c);
        const cube=new THREE.CubeCamera(1,3000,this.reflection); cube.position.set(0,170,50);
        cube.update(this.renderer,this.scene);
        this.scene.background=null; this.scene.remove(softboxes); panelGeometry.dispose(); lightPanel.dispose();
        this.chrome.envMap=this.reflection.texture; this.chrome.envMapIntensity=1.25; this.chrome.needsUpdate=true;
        this.balls.forEach(ball=>ball.visible=true);
    }
    draw(game: Game, _now: number) {
        game.balls.forEach((ball,i)=>{
            const mesh=this.balls[i];
            mesh.position.copy(toWorld(pointAtProgress(this.puzzle.tracks[i],ball.progress),PHYSICS.ballRadius));
            const [x,y,z,w]=rollingOrientation(this.puzzle.tracks[i],ball.progress);
            mesh.quaternion.set(-x,-z,-y,w);
        });
        this.gate.position.y=game.firstArrivalAt!==null && game.result?.outcome!=='success' ? DECK+18 : DECK-15;
        this.renderer.render(this.scene,this.camera);
    }
    destroy() {
        this.observer.disconnect(); this.controls.dispose(); this.clearAssembly();
        this.texture.dispose(); this.chrome.dispose(); this.environment.dispose(); this.reflection.dispose(); this.renderer.dispose();
    }
}
