import React, { useEffect, useRef } from 'react';
import {
  ActionPreview,
  CombatState,
  GRID_SIZE,
  Lang,
  Pos,
} from '../game/types';
import { manhattan } from '../game/engine/combat';

interface ArenaCanvasProps {
  combat: CombatState;
  validTargets: Pos[];
  hoveredTile: Pos | null;
  preview: ActionPreview | null;
  lang: Lang;
  onHoverTile: (pos: Pos | null) => void;
  onClickTile: (pos: Pos) => void;
}

const CANVAS_PX = 470;
const PAD = 15;
const CELL = (CANVAS_PX - PAD * 2) / GRID_SIZE;

function tileCenter(p: Pos): { cx: number; cy: number } {
  return {
    cx: PAD + p.x * CELL + CELL / 2,
    cy: PAD + p.y * CELL + CELL / 2,
  };
}

function drawJaggedLightning(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  jitter: number,
  seed: number
): void {
  const segments = 6;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const mx = x1 + (x2 - x1) * t;
    const my = y1 + (y2 - y1) * t;
    const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    const wave = Math.sin(seed * 7 + i * 3.7) * jitter;
    ctx.lineTo(mx + Math.cos(angle) * wave, my + Math.sin(angle) * wave);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Bright core white line
  ctx.strokeStyle = '#ecfeff';
  ctx.lineWidth = Math.max(1, width * 0.4);
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.restore();
}

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({
  combat,
  validTargets,
  hoveredTile,
  preview,
  lang,
  onHoverTile,
  onClickTile,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_PX * dpr;
    canvas.height = CANVAS_PX * dpr;

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const now = Date.now();
      const t = now * 0.004;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Subtle screen shake if recent slam/explosion VFX
      const recentImpact = combat.vfx.some(
        (v) => (v.kind === 'slam' || v.kind === 'explosion') && now - v.createdAt < 220
      );
      if (recentImpact) {
        const sx = (Math.random() - 0.5) * 6;
        const sy = (Math.random() - 0.5) * 6;
        ctx.translate(sx, sy);
      }

      // Background plate
      ctx.fillStyle = '#070b13';
      ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

      // Build danger map from all alive enemy intents
      const dangerMap = new Map<string, number>();
      const hoveredEnemy = hoveredTile
        ? combat.enemies.find((e) => e.hp > 0 && e.x === hoveredTile.x && e.y === hoveredTile.y)
        : undefined;
      const hoveredEnemyTargets = new Set(
        hoveredEnemy ? hoveredEnemy.intent.targetTiles.map((p) => `${p.x},${p.y}`) : []
      );

      for (const e of combat.enemies) {
        if (e.hp <= 0 || e.stunned) continue;
        for (const tp of e.intent.targetTiles) {
          const k = `${tp.x},${tp.y}`;
          dangerMap.set(k, (dangerMap.get(k) ?? 0) + e.intent.damage);
        }
      }

      const validSet = new Set(validTargets.map((p) => `${p.x},${p.y}`));
      const affectedSet = new Set(preview?.affectedTiles.map((p) => `${p.x},${p.y}`) ?? []);

      // 1. Draw Tiles
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const tile = combat.grid[y][x];
          const px = PAD + x * CELL;
          const py = PAD + y * CELL;
          const key = `${x},${y}`;

          // Base terrain styling
          if (tile.terrain === 'pit') {
            const grad = ctx.createRadialGradient(
              px + CELL / 2,
              py + CELL / 2,
              4,
              px + CELL / 2,
              py + CELL / 2,
              CELL * 0.65
            );
            grad.addColorStop(0, '#020408');
            grad.addColorStop(1, '#111827');
            ctx.fillStyle = grad;
          } else if (tile.terrain === 'vent') {
            const pulse = 0.18 + Math.sin(t * 1.8 + x + y) * 0.08;
            ctx.fillStyle = `rgba(249, 115, 22, ${pulse})`;
          } else if (tile.terrain === 'charger') {
            const pulse = 0.14 + Math.sin(t * 2 + x) * 0.07;
            ctx.fillStyle = `rgba(34, 211, 238, ${pulse})`;
          } else if (tile.terrain === 'pillar') {
            ctx.fillStyle = '#1e293b';
          } else {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#0e1726' : '#111c2e';
          }

          ctx.beginPath();
          ctx.roundRect(px + 3, py + 3, CELL - 6, CELL - 6, 8);
          ctx.fill();

          // Terrain details
          if (tile.terrain === 'pit') {
            ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
            ctx.setLineDash([5, 4]);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(244, 63, 94, 0.55)';
            ctx.font = '700 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(lang === 'ru' ? 'ПРОПАСТЬ' : 'PIT', px + CELL / 2, py + CELL / 2 + 4);
          } else if (tile.terrain === 'pillar') {
            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.roundRect(px + 10, py + 8, CELL - 20, CELL - 20, 6);
            ctx.fill();
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#94a3b8';
            ctx.font = '700 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(lang === 'ru' ? 'КОЛОННА' : 'PILLAR', px + CELL / 2, py + CELL / 2 + 3);
          } else if (tile.terrain === 'vent') {
            ctx.strokeStyle = 'rgba(251, 146, 60, 0.65)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#fb923c';
            ctx.font = '700 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🔥 -3', px + CELL / 2, py + CELL - 10);
          } else if (tile.terrain === 'charger') {
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#67e8f9';
            ctx.font = '700 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚡ +1/+2', px + CELL / 2, py + CELL - 10);
          } else {
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Danger telegraph overlay
          const dangerDmg = dangerMap.get(key) ?? 0;
          if (dangerDmg > 0) {
            const focused = hoveredEnemyTargets.has(key);
            const alpha = focused ? 0.38 : 0.16 + Math.sin(t * 2.4) * 0.06;
            ctx.fillStyle = `rgba(244, 63, 94, ${alpha})`;
            ctx.beginPath();
            ctx.roundRect(px + 4, py + 4, CELL - 8, CELL - 8, 7);
            ctx.fill();
            ctx.strokeStyle = focused ? '#fb7185' : 'rgba(244, 63, 94, 0.65)';
            ctx.lineWidth = focused ? 2.5 : 1.3;
            ctx.stroke();

            // Corner hazard indicator
            ctx.fillStyle = '#fda4af';
            ctx.font = '700 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`⚠${dangerDmg}`, px + CELL - 8, py + 16);
          }

          // Valid target tile highlight
          if (validSet.has(key)) {
            ctx.fillStyle = 'rgba(34, 211, 238, 0.11)';
            ctx.beginPath();
            ctx.roundRect(px + 4, py + 4, CELL - 8, CELL - 8, 7);
            ctx.fill();
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Affected preview tile highlight
          if (affectedSet.has(key)) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
            ctx.beginPath();
            ctx.roundRect(px + 4, py + 4, CELL - 8, CELL - 8, 7);
            ctx.fill();
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Hover border
          if (hoveredTile && hoveredTile.x === x && hoveredTile.y === y) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(px + 3, py + 3, CELL - 6, CELL - 6, 8);
            ctx.stroke();
          }
        }
      }

      // 2. Passive Arc Network Links between existing nodes (Manhattan <= 2)
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -t * 14;
      for (let i = 0; i < combat.nodes.length; i++) {
        for (let j = i + 1; j < combat.nodes.length; j++) {
          const a = combat.nodes[i];
          const b = combat.nodes[j];
          if (manhattan(a, b) <= 2) {
            const ca = tileCenter(a);
            const cb = tileCenter(b);
            ctx.beginPath();
            ctx.moveTo(ca.cx, ca.cy);
            ctx.lineTo(cb.cx, cb.cy);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // 3. Preview Arc Links (jagged bright preview lightning!)
      if (preview && preview.valid && preview.arcLinks.length > 0) {
        for (let i = 0; i < preview.arcLinks.length; i++) {
          const l = preview.arcLinks[i];
          const a = tileCenter(l.from);
          const b = tileCenter(l.to);
          drawJaggedLightning(ctx, a.cx, a.cy, b.cx, b.cy, '#22d3ee', 3, 5, t + i);
        }
      }

      // 4. Draw Relay / Tesla / Mine Nodes
      for (const node of combat.nodes) {
        const { cx, cy } = tileCenter(node);
        const r = 20 + Math.sin(t * 2.5 + node.x) * 1.5;
        ctx.save();
        ctx.fillStyle =
          node.kind === 'mine'
            ? 'rgba(244, 63, 94, 0.25)'
            : node.kind === 'tesla'
            ? 'rgba(168, 85, 247, 0.28)'
            : 'rgba(34, 211, 238, 0.22)';
        ctx.strokeStyle =
          node.kind === 'mine' ? '#f43f5e' : node.kind === 'tesla' ? '#c084fc' : '#22d3ee';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = '19px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.kind === 'mine' ? '💣' : node.kind === 'tesla' ? '🗼' : '⚡', cx, cy - 1);

        ctx.fillStyle = '#e0f2fe';
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillText(
          node.kind === 'mine' ? 'MINE' : node.kind === 'tesla' ? 'COIL' : 'RELAY',
          cx,
          cy + 27
        );
        ctx.restore();
      }

      // 5. Draw Player Core
      {
        const { cx, cy } = tileCenter(combat.player);
        ctx.save();
        // Outer double-next glow
        if (combat.player.doubleNext) {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, 31 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Core octagon
        ctx.fillStyle = '#0f2942';
        ctx.strokeStyle = combat.player.shield > 0 ? '#10b981' : '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (Math.PI / 4) * i + Math.PI / 8;
          const vx = cx + Math.cos(ang) * 25;
          const vy = cy + Math.sin(ang) * 25;
          if (i === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner reactor ring
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 11, t, t + Math.PI * 1.4);
        ctx.stroke();

        ctx.fillStyle = '#e0f2fe';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CORE', cx, cy + 3);

        // Shield badge on core
        if (combat.player.shield > 0) {
          ctx.fillStyle = '#065f46';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(cx - 22, cy - 38, 44, 15, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#a7f3d0';
          ctx.font = '700 10px "JetBrains Mono", monospace';
          ctx.fillText(`🛡${combat.player.shield}`, cx, cy - 27);
        }
        ctx.restore();
      }

      // 6. Draw Enemies
      for (const e of combat.enemies) {
        if (e.hp <= 0) continue;
        const { cx, cy } = tileCenter(e);
        const pred = preview?.damageByEnemyId[e.id];
        ctx.save();

        // Enemy body
        const radius = e.isBoss ? 29 : e.isElite ? 26 : 22;
        ctx.fillStyle = '#1f1224';
        ctx.strokeStyle = e.stunned ? '#94a3b8' : e.color;
        ctx.lineWidth = e.isBoss ? 3.5 : 2.5;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = e.isBoss ? 14 : 8;
        ctx.beginPath();
        ctx.roundRect(cx - radius, cy - radius, radius * 2, radius * 2, e.isBoss ? 12 : 8);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Icon
        ctx.font = e.isBoss ? '26px sans-serif' : '21px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.icon, cx, cy - 2);

        // HP bar
        const bw = CELL - 16;
        const bx = cx - bw / 2;
        const by = cy + radius - 2;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(bx, by, bw, 8);
        const ratio = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = e.isBoss ? '#ec4899' : '#f43f5e';
        ctx.fillRect(bx, by, bw * ratio, 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, 8);

        // HP numbers
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillText(
          `${e.hp}/${e.maxHp}${e.shield > 0 ? ` +${e.shield}` : ''}`,
          cx,
          by + 16
        );

        // Top Intent Badge
        const intentBadge = e.stunned
          ? '📡 STUN'
          : e.intent.damage > 0
          ? `⚔${e.intent.damage}`
          : e.intent.shield
          ? `🛡+${e.intent.shield}`
          : '⚡';
        ctx.fillStyle = e.stunned ? '#334155' : e.intent.damage > 0 ? '#881337' : '#1e3a8a';
        ctx.beginPath();
        ctx.roundRect(cx - 24, cy - radius - 13, 48, 15, 5);
        ctx.fill();
        ctx.fillStyle = '#fff1f2';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillText(intentBadge, cx, cy - radius - 5);

        // Status icons (Vulnerable / Weak)
        if (e.vulnerable > 0 || e.weak > 0) {
          ctx.fillStyle = '#facc15';
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.fillText(
            `${e.vulnerable > 0 ? `VUL${e.vulnerable} ` : ''}${e.weak > 0 ? `WK${e.weak}` : ''}`.trim(),
            cx,
            cy - radius + 8
          );
        }

        // Live Predicted Damage Pill on Hover!
        if (pred) {
          const lethal = pred.pitKill || pred.total >= e.hp + e.shield;
          ctx.fillStyle = lethal ? '#dc2626' : '#f59e0b';
          ctx.beginPath();
          ctx.roundRect(cx - 32, cy - 10, 64, 20, 6);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = '800 11px "JetBrains Mono", monospace';
          ctx.fillText(
            pred.pitKill ? '☠ KILL!' : `${lethal ? '💀' : ''}-${pred.total}`,
            cx,
            cy + 1
          );
        }

        ctx.restore();
      }

      // 7. Preview Knockback Arrows & Move Ghost
      if (preview && preview.valid) {
        for (const kb of preview.knockbacks) {
          const a = tileCenter(kb.from);
          const b = tileCenter(kb.to);
          ctx.save();
          ctx.strokeStyle = kb.pitKill ? '#f43f5e' : '#fbbf24';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(a.cx, a.cy);
          ctx.lineTo(b.cx, b.cy);
          ctx.stroke();
          // Arrowhead
          const ang = Math.atan2(b.cy - a.cy, b.cx - a.cx);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.moveTo(b.cx, b.cy);
          ctx.lineTo(b.cx - Math.cos(ang - 0.5) * 11, b.cy - Math.sin(ang - 0.5) * 11);
          ctx.lineTo(b.cx - Math.cos(ang + 0.5) * 11, b.cy - Math.sin(ang + 0.5) * 11);
          ctx.closePath();
          ctx.fill();
          if (kb.slammed || kb.detonatedNode) {
            ctx.fillStyle = '#fef08a';
            ctx.font = '800 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(kb.detonatedNode ? '💣 BOOM!' : '💥 SLAM!', b.cx, b.cy - 18);
          }
          ctx.restore();
        }
        if (preview.moveDest) {
          const { cx, cy } = tileCenter(preview.moveDest);
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(cx, cy, 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 8. Active VFX animations
      for (const v of combat.vfx) {
        const age = now - v.createdAt;
        if (age > v.duration) continue;
        const pNorm = age / v.duration;
        const alpha = Math.max(0, 1 - pNorm);

        if (v.kind === 'arc' && v.from && v.to) {
          const a = tileCenter(v.from);
          const b = tileCenter(v.to);
          ctx.save();
          ctx.globalAlpha = alpha;
          drawJaggedLightning(ctx, a.cx, a.cy, b.cx, b.cy, v.color, 4, 8, now * 0.03);
          ctx.restore();
        } else if (v.kind === 'move_trail' && v.from && v.to) {
          const a = tileCenter(v.from);
          const b = tileCenter(v.to);
          ctx.save();
          ctx.globalAlpha = alpha * 0.8;
          ctx.strokeStyle = v.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(a.cx, a.cy);
          ctx.lineTo(b.cx, b.cy);
          ctx.stroke();
          ctx.restore();
        } else if ((v.kind === 'explosion' || v.kind === 'slam') && v.pos) {
          const { cx, cy } = tileCenter(v.pos);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = v.color;
          ctx.lineWidth = 4 * (1 - pNorm) + 1;
          ctx.beginPath();
          ctx.arc(cx, cy, 10 + pNorm * 38, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (v.text && v.pos) {
          const { cx, cy } = tileCenter(v.pos);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = '800 15px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#020617';
          ctx.fillText(v.text, cx + 1, cy - 18 - pNorm * 28 + 1);
          ctx.fillStyle = v.color;
          ctx.fillText(v.text, cx, cy - 18 - pNorm * 28);
          ctx.restore();
        }
      }

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [combat, validTargets, hoveredTile, preview, lang]);

  const getTileFromEvent = (e: React.MouseEvent<HTMLCanvasElement>): Pos | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_PX / rect.width;
    const scaleY = CANVAS_PX / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const gx = Math.floor((mx - PAD) / CELL);
    const gy = Math.floor((my - PAD) / CELL);
    if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
      return { x: gx, y: gy };
    }
    return null;
  };

  return (
    <div className="arena-wrap">
      <canvas
        ref={canvasRef}
        className="arena-canvas"
        style={{ width: CANVAS_PX, height: CANVAS_PX }}
        onMouseMove={(e) => onHoverTile(getTileFromEvent(e))}
        onMouseLeave={() => onHoverTile(null)}
        onClick={(e) => {
          const pos = getTileFromEvent(e);
          if (pos) onClickTile(pos);
        }}
      />
    </div>
  );
};
