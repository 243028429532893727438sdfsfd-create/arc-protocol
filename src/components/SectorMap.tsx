import React from 'react';
import { getSelectableMapNodeIds } from '../game/engine/run';
import { Lang, MapNode, MapNodeType, RunState } from '../game/types';

interface SectorMapProps {
  run: RunState;
  lang: Lang;
  onSelectNode: (nodeId: string) => void;
}

const ACT_TITLES: Record<1 | 2 | 3, { ru: string; en: string }> = {
  1: { ru: 'СЕКТОР I — ВНЕШНИЙ КОНТУР', en: 'SECTOR I — OUTER CIRCUIT' },
  2: { ru: 'СЕКТОР II — ТЕРМАЛЬНЫЙ ЦЕХ', en: 'SECTOR II — THERMAL FOUNDRY' },
  3: { ru: 'СЕКТОР III — ЯДРО СИНГУЛЯРНОСТИ', en: 'SECTOR III — SINGULARITY CORE' },
};

const NODE_META: Record<MapNodeType, { icon: string; ru: string; en: string; color: string }> = {
  combat: { icon: '⚔️', ru: 'Бой', en: 'Combat', color: '#38bdf8' },
  elite: { icon: '💀', ru: 'Элита', en: 'Elite', color: '#f43f5e' },
  workshop: { icon: '⚙️', ru: 'Мастерская', en: 'Workshop', color: '#10b981' },
  event: { icon: '❓', ru: 'Событие', en: 'Event', color: '#a855f7' },
  shop: { icon: '🛒', ru: 'Рынок', en: 'Market', color: '#f59e0b' },
  boss: { icon: '👑', ru: 'БОСС', en: 'BOSS', color: '#ec4899' },
};

function nodeCoords(node: MapNode, nodesInLayer: number): { x: number; y: number } {
  const x = 90 + node.layer * 145;
  const totalH = 340;
  const spacing = totalH / (nodesInLayer + 1);
  const y = spacing * (node.col + 1) + 20;
  return { x, y };
}

export const SectorMap: React.FC<SectorMapProps> = ({ run, lang, onSelectNode }) => {
  const selectable = new Set(getSelectableMapNodeIds(run));
  const countsByLayer = new Map<number, number>();
  for (const n of run.map) {
    countsByLayer.set(n.layer, (countsByLayer.get(n.layer) ?? 0) + 1);
  }

  const posMap = new Map<string, { x: number; y: number }>();
  for (const n of run.map) {
    posMap.set(n.id, nodeCoords(n, countsByLayer.get(n.layer) ?? 1));
  }

  return (
    <div className="panel-screen map-screen">
      <div className="screen-header">
        <div>
          <div className="eyebrow">{lang === 'ru' ? 'НАВИГАЦИЯ СЕКТОРА' : 'SECTOR NAVIGATION'}</div>
          <h2>{ACT_TITLES[run.act][lang]}</h2>
        </div>
        <div className="map-hint">
          {lang === 'ru'
            ? 'Выберите подсвеченный узел маршрута — цель: Босс Сектора справа'
            : 'Choose a glowing route node — reach the Sector Boss on the right'}
        </div>
      </div>

      <div className="map-canvas-shell">
        <svg viewBox="0 0 920 380" className="map-svg">
          {/* Edges */}
          {run.map.map((n) => {
            const p1 = posMap.get(n.id)!;
            return n.nextIds.map((tid) => {
              const p2 = posMap.get(tid)!;
              const isAvailEdge = n.id === run.currentNodeId && selectable.has(tid);
              return (
                <line
                  key={`${n.id}-${tid}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={isAvailEdge ? '#22d3ee' : 'rgba(148,163,184,0.28)'}
                  strokeWidth={isAvailEdge ? 3.5 : 2}
                  strokeDasharray={isAvailEdge ? undefined : '6 5'}
                />
              );
            });
          })}

          {/* Nodes */}
          {run.map.map((n) => {
            const pos = posMap.get(n.id)!;
            const meta = NODE_META[n.type];
            const isSel = selectable.has(n.id);
            const isCur = run.currentNodeId === n.id;
            const r = n.type === 'boss' ? 34 : 26;
            return (
              <g
                key={n.id}
                className={`map-node ${isSel ? 'selectable' : ''} ${n.visited ? 'visited' : ''} ${
                  isCur ? 'current' : ''
                }`}
                onClick={() => isSel && onSelectNode(n.id)}
                style={{ cursor: isSel ? 'pointer' : 'default' }}
              >
                {isSel && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r + 8}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2.5"
                    opacity="0.7"
                    className="pulse-ring"
                  />
                )}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  fill={n.visited ? '#1e293b' : '#0f172a'}
                  stroke={isSel ? '#22d3ee' : isCur ? '#f59e0b' : meta.color}
                  strokeWidth={isSel || isCur ? 3.5 : 2}
                  opacity={n.visited && !isCur ? 0.55 : 1}
                />
                <text
                  x={pos.x}
                  y={pos.y + 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={n.type === 'boss' ? '26' : '20'}
                >
                  {meta.icon}
                </text>
                <text
                  x={pos.x}
                  y={pos.y + r + 15}
                  textAnchor="middle"
                  fill={isSel ? '#e0f2fe' : '#94a3b8'}
                  fontSize="11"
                  fontWeight="700"
                >
                  {meta[lang]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="map-legend">
        {(Object.keys(NODE_META) as MapNodeType[]).map((k) => (
          <span key={k} className="legend-pill">
            <span>{NODE_META[k].icon}</span>
            <span>{NODE_META[k][lang]}</span>
          </span>
        ))}
      </div>
    </div>
  );
};
