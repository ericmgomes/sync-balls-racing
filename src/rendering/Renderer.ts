import { BARRIER, WORLD } from '../game/config';
import type { Game } from '../game/Game';
import { pointAtProgress } from '../game/Track';
import type { Point, Puzzle, Track } from '../game/types';
import { BALL_LIFT, projectPoint } from './projection';
import { rollingOrientation, rotateSurface, type Vector } from './rolling';
// Fine brushed-metal marks move with the sphere; lighting stays fixed in the scene.
const surfaceMarks: Vector[] = Array.from({ length: 42 }, (_, i) => {
    const z = 1 - 2 * (i + .5) / 42;
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const ring = Math.sqrt(1 - z*z);
    return [Math.cos(angle)*ring, Math.sin(angle)*ring, z];
});
function shade(hex: string, factor: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${[n >> 16, (n >> 8) & 255, n & 255].map(c => Math.round(Math.min(255, c * factor))).join(',')})`;
}
export class Renderer {
    private context: CanvasRenderingContext2D;
    private background = document.createElement('canvas');
    private observer: ResizeObserver;
    private width = 1;
    private height = 1;
    private pixelRatio = 1;
    constructor(private canvas: HTMLCanvasElement, private puzzle: Puzzle) {
        const context = canvas.getContext('2d');
        if (!context)
            throw new Error('O navegador precisa oferecer suporte a Canvas 2D.');
        this.context = context;
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(canvas);
        this.resize();
    }
    setPuzzle(puzzle: Puzzle) { this.puzzle = puzzle; this.drawBackground(); }
    private resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.width = Math.max(1, rect.width);
        this.height = Math.max(1, rect.height);
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        for (const canvas of [this.canvas, this.background]) {
            canvas.width = Math.round(this.width * this.pixelRatio);
            canvas.height = Math.round(this.height * this.pixelRatio);
        }
        this.drawBackground();
    }
    private position(point: Point, lift = 0): Point {
        const p = projectPoint(point, lift);
        return { x: p.x * this.width, y: p.y * this.height };
    }
    private polygon(context: CanvasRenderingContext2D, points: Point[], fill: string) {
        context.beginPath();
        points.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y));
        context.closePath();
        context.fillStyle = fill;
        context.fill();
    }
    private trace(context: CanvasRenderingContext2D, track: Track, offsetY = 0, ground = false) {
        context.beginPath();
        track.path.forEach((p, i) => {
            const q = this.position(ground ? { ...p, z: 0 } : p);
            if (i)
                context.lineTo(q.x, q.y + offsetY);
            else
                context.moveTo(q.x, q.y + offsetY);
        });
    }
    private drawBackground() {
        const c = this.background.getContext('2d')!;
        c.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        c.clearRect(0, 0, this.width, this.height);
        const small = this.width < 600;
        const thick = small ? 7 : 15;
        const rail = Math.max(13, Math.min(33, this.width / this.puzzle.tracks.length * 0.23));
        const corners = [{ x: 85, y: 20 }, { x: 915, y: 20 }, { x: 915, y: 565 }, { x: 85, y: 565 }].map(p => {
            const q = this.position(p);
            return { x: q.x, y: q.y + thick };
        });
        const [a, b, d, e] = corners;
        c.save();
        c.shadowColor = '#00000070';
        c.shadowBlur = small ? 18 : 38;
        c.shadowOffsetY = 20;
        this.polygon(c, corners, '#343e48');
        c.restore();
        this.polygon(c, [e, d, { x: d.x, y: d.y + thick }, { x: e.x, y: e.y + thick }], '#172129');
        this.polygon(c, [b, d, { x: d.x, y: d.y + thick }, { x: b.x, y: b.y + thick }], '#26323b');
        const slab = c.createLinearGradient(a.x, a.y, d.x, d.y);
        slab.addColorStop(0, '#586573');
        slab.addColorStop(1, '#313e49');
        c.beginPath();
        corners.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
        c.closePath();
        c.fillStyle = slab;
        c.fill();
        c.strokeStyle = '#8193a14d';
        c.lineWidth = 1;
        c.stroke();
        for (const p of corners) {
            c.beginPath();
            c.ellipse(p.x + (p.x < this.width / 2 ? 8 : -8), p.y + (p.y < this.height / 2 ? 10 : -8), 3, 2, 0, 0, Math.PI * 2);
            c.fillStyle = '#a0a9ae';
            c.fill();
        }
        c.lineCap = 'round';
        c.lineJoin = 'round';
        for (const track of this.puzzle.tracks) {
            const color = track.color;
            for (const ratio of [0, 0.18, 0.33, 0.5, 0.65, 0.82]) {
                const location = pointAtProgress(track, ratio);
                const p = this.position(location);
                const depth = this.position({ ...location, z: 0 }).y - p.y;
                c.fillStyle = shade(color, 0.48);
                c.fillRect(p.x - rail * 0.2, p.y, rail * 0.4, depth + thick);
                c.fillStyle = shade(color, 0.75);
                c.fillRect(p.x - rail * 0.2, p.y, rail * 0.13, depth + thick);
            }
            c.save();
            c.shadowColor = '#10192370';
            c.shadowBlur = 9;
            c.shadowOffsetX = 3;
            c.shadowOffsetY = 9;
            this.trace(c, track, thick, true);
            c.strokeStyle = '#111a2455';
            c.lineWidth = rail + 5;
            c.stroke();
            c.restore();
            for (let y = thick; y >= 0; y -= 2) {
                this.trace(c, track, y);
                c.strokeStyle = shade(color, 0.6 + 0.4 * (1 - y / thick));
                c.lineWidth = rail + 4;
                c.stroke();
            }
            this.trace(c, track, -1);
            c.strokeStyle = shade(color, 1.28);
            c.lineWidth = rail + 1;
            c.stroke();
            this.trace(c, track);
            c.strokeStyle = shade(color, 0.56);
            c.lineWidth = rail * 0.65;
            c.stroke();
            this.trace(c, track, 2);
            c.strokeStyle = color;
            c.lineWidth = rail * 0.47;
            c.stroke();
            this.trace(c, track, 3);
            c.strokeStyle = shade(color, 1.13);
            c.lineWidth = rail * 0.21;
            c.stroke();
            const start = this.position(track.path[0]);
            c.beginPath();
            c.ellipse(start.x, start.y + 4, rail * .77, rail * .5, 0, 0, Math.PI * 2);
            c.fillStyle = shade(color, .5);
            c.fill();
            c.beginPath();
            c.ellipse(start.x, start.y, rail * .77, rail * .5, 0, 0, Math.PI * 2);
            c.fillStyle = color;
            c.fill();
            c.strokeStyle = shade(color, 1.4);
            c.lineWidth = 2;
            c.stroke();
            c.fillStyle = '#bac9d3';
            c.font = `600 ${small ? 9 : 11}px ui-monospace,monospace`;
            c.textAlign = 'center';
            
            const finish = this.position(track.path[track.path.length - 1]);
            c.beginPath();
            c.ellipse(finish.x, finish.y + 4, rail * .67, rail * .35, 0, 0, Math.PI * 2);
            c.fillStyle = '#15222e';
            c.fill();
            c.strokeStyle = shade(color, .85);
            c.lineWidth = 2;
            c.stroke();
        }
        const left = this.position({ x: 30, y: WORLD.finishY + 27 });
        const right = this.position({ x: 970, y: WORLD.finishY + 27 });
        c.strokeStyle = '#a6b8c266';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(left.x, left.y);
        c.lineTo(right.x, right.y);
        c.stroke();
        c.font = `600 ${small ? 7 : 9}px ui-monospace,monospace`;
        c.textAlign = 'center';
        c.fillStyle = '#b3c2cd';
        c.fillText('CHEGADA  /  SYNC BALLS RACING', this.width * .5, this.height * .89);
    }
    private barrier(game: Game) {
        const c = this.context;
        const closed = game.firstArrivalAt !== null && game.result?.outcome !== 'success';
        const lift = closed ? 7 : -11;
        const a = this.position({ x: 95, y: BARRIER.topY }, lift);
        const b = this.position({ x: 905, y: BARRIER.topY }, lift);
        const h = closed ? (this.width < 600 ? 8 : 14) : 4;
        c.save();
        c.lineCap = 'round';
        for (const p of [a, b]) {
            c.fillStyle = '#17212a';
            c.fillRect(p.x - 5, p.y - 8, 10, 23);
            c.fillStyle = '#8795a0';
            c.fillRect(p.x - 5, p.y - 8, 3, 23);
            c.beginPath();
            c.arc(p.x, p.y - 3, 2, 0, Math.PI * 2);
            c.fillStyle = closed ? '#ff9c68' : '#7cf2b4';
            c.fill();
        }
        c.shadowColor = '#00000088';
        c.shadowBlur = 5;
        c.shadowOffsetY = 4;
        this.polygon(c, [a, b, { x: b.x, y: b.y + h }, { x: a.x, y: a.y + h }], closed ? '#d49a4b' : '#73838a');
        c.shadowColor = 'transparent';
        c.save();
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.lineTo(b.x, b.y + h);
        c.lineTo(a.x, a.y + h);
        c.closePath();
        c.clip();
        if (closed) {
            c.strokeStyle = '#26313b';
            c.lineWidth = this.width < 600 ? 5 : 9;
            for (let x = a.x - 20; x < b.x + 20; x += this.width < 600 ? 14 : 26) {
                c.beginPath();
                c.moveTo(x, a.y + 30);
                c.lineTo(x + 30, a.y - 15);
                c.stroke();
            }
        }
        c.restore();
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.strokeStyle = closed ? '#ffe0a0' : '#acbdc6';
        c.lineWidth = 1.5;
        c.stroke();
        c.restore();
    }
    draw(game: Game, _now: number) {
        const c = this.context;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        c.drawImage(this.background, 0, 0);
        c.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        const small = this.width < 600;
        const r = small ? 9 : 14;
        this.barrier(game);
        for (const ball of [...game.balls].sort((a, b) => pointAtProgress(this.puzzle.tracks[a.trackId], a.progress).y - pointAtProgress(this.puzzle.tracks[b.trackId], b.progress).y)) {
            const track = this.puzzle.tracks[ball.trackId];
            const p = this.position(pointAtProgress(track, ball.progress), BALL_LIFT);
            c.save();
            c.beginPath();
            c.ellipse(p.x + 3, p.y + r * .85, r * 1.05, r * .43, 0, 0, Math.PI * 2);
            c.fillStyle = '#0d172477';
            c.shadowColor = '#00000055';
            c.shadowBlur = 5;
            c.fill();
            c.restore();
            const g = c.createRadialGradient(p.x - r * .4, p.y - r * .5, 1, p.x, p.y, r * 1.15);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(.18, '#f3f7fb');
            g.addColorStop(.38, '#b9c8d2');
            g.addColorStop(.52, '#637986');
            g.addColorStop(.65, '#e0e8eb');
            g.addColorStop(.83, '#77929e');
            g.addColorStop(1, '#253845');
            c.beginPath();
            c.arc(p.x, p.y, r, 0, Math.PI * 2);
            c.fillStyle = g;
            c.fill();
            c.strokeStyle = '#dbeaf466';
            c.lineWidth = 1;
            c.stroke();
            const orientation = rollingOrientation(track, ball.progress);
            for (const mark of surfaceMarks) {
                const [x, y, z] = rotateSurface(orientation, mark);
                const facing = .62*y + .785*z;
                if (facing <= .08) continue;
                const screenY = .785*y - .62*z;
                c.beginPath();
                c.ellipse(p.x+x*r*.95, p.y+screenY*r*.95, Math.max(.35,r*.045), Math.max(.2,r*.022), -.4, 0, Math.PI*2);
                c.fillStyle = `rgba(38,54,65,${.38*facing})`;
                c.fill();
            }
            c.beginPath();
            c.arc(p.x, p.y, r * .8, .2, 2.8);
            c.strokeStyle = '#c9d6de';
            c.lineWidth = 2;
            c.stroke();
            c.textAlign = 'center';
            c.textBaseline = 'alphabetic';
            if (game.result) {
                const end = this.position(track.path[track.path.length - 1]);
                const arrival = game.result.arrivals.find(item => item.trackId === track.id);
                const label = arrival ? (arrival.offset === 0 ? 'primeira' : `+${Math.round(arrival.offset)} ms`) : ball.state === 'running' ? '↓ faixa' : 'retida';
                c.fillStyle = arrival ? '#bcebd1' : '#edbc95';
                c.font = `500 ${small ? 8 : 10}px ui-monospace,monospace`;
                c.fillText(label, end.x, end.y + 24);
            }
        }
    }
    destroy() { this.observer.disconnect(); }
}


