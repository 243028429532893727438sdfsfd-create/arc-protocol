import { CARDS } from '../data/cards';
import { ENCOUNTERS, ENEMIES, EncounterTemplate, parseTerrainChar } from '../data/enemies';
import {
  ActionPreview,
  CardDef,
  CardEffectSpec,
  CardInstance,
  CombatState,
  EnemyIntent,
  EnemyUnit,
  GRID_SIZE,
  NodeKind,
  Pos,
  RelayNode,
  Tile,
  VfxEvent,
} from '../types';

let uidSeq = 1;
export function nextUid(prefix = 'id'): string {
  uidSeq += 1;
  return `${prefix}_${uidSeq}_${Math.floor(Math.random() * 10000)}`;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getCardDef(card: CardInstance): CardDef {
  return CARDS[card.defId];
}

export function getCardEffect(card: CardInstance): CardEffectSpec {
  const def = CARDS[card.defId];
  return card.upgraded ? def.upgradedEffect : def.effect;
}

export function getCardCost(card: CardInstance, state: CombatState, relicIds: string[]): number {
  const def = CARDS[card.defId];
  const base = card.upgraded && def.upgradedCost !== undefined ? def.upgradedCost : def.cost;
  const eff = getCardEffect(card);
  if (eff.placeNode && relicIds.includes('superconductor') && !state.player.freeNodeUsed) {
    return 0;
  }
  return base;
}

export function getEnemyAt(state: CombatState, x: number, y: number): EnemyUnit | undefined {
  return state.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y);
}

export function getNodeAt(state: CombatState, x: number, y: number): RelayNode | undefined {
  return state.nodes.find((n) => n.x === x && n.y === y);
}

export function isTileBlockedForWalk(state: CombatState, x: number, y: number, ignorePlayer = false): boolean {
  if (!inBounds(x, y)) return true;
  const tile = state.grid[y][x];
  if (tile.terrain === 'pillar' || tile.terrain === 'pit') return true;
  if (!ignorePlayer && state.player.x === x && state.player.y === y) return true;
  if (getEnemyAt(state, x, y)) return true;
  const node = getNodeAt(state, x, y);
  // Relay and Tesla Coils physically block enemy movement; Mines remain walkable so enemies trigger them!
  if (node && node.kind !== 'mine') return true;
  return false;
}

export function isTileWalkableForPlayer(state: CombatState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const tile = state.grid[y][x];
  if (tile.terrain === 'pillar' || tile.terrain === 'pit') return false;
  if (getEnemyAt(state, x, y)) return false;
  if (getNodeAt(state, x, y)) return false;
  return true;
}

export function isTileValidForNode(state: CombatState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const tile = state.grid[y][x];
  if (tile.terrain === 'pillar' || tile.terrain === 'pit') return false;
  if (state.player.x === x && state.player.y === y) return false;
  if (getEnemyAt(state, x, y)) return false;
  if (getNodeAt(state, x, y)) return false;
  return true;
}

/**
 * Computes connected Arc Circuit starting from an origin (or all nodes for global resonance).
 * Nodes connect to each other (and to origin) within Manhattan distance <= 2.
 */
export function computeArcNetwork(
  state: CombatState,
  origin: Pos,
  connectAllNodes = false
): {
  connectedNodes: RelayNode[];
  links: Array<{ from: Pos; to: Pos }>;
  hitEnemies: EnemyUnit[];
  affectedTiles: Pos[];
} {
  const activeNodes = state.nodes;
  const visited = new Set<string>();
  const queue: Pos[] = [];
  const links: Array<{ from: Pos; to: Pos }> = [];
  const connectedNodes: RelayNode[] = [];

  if (connectAllNodes) {
    for (const n of activeNodes) {
      visited.add(n.id);
      connectedNodes.push(n);
      queue.push({ x: n.x, y: n.y });
    }
    // Draw links between all pairs of connected nodes within distance <= 2 (and from player to nearest)
    for (let i = 0; i < connectedNodes.length; i++) {
      for (let j = i + 1; j < connectedNodes.length; j++) {
        const a = connectedNodes[i];
        const b = connectedNodes[j];
        if (manhattan(a, b) <= 2) {
          links.push({ from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y } });
        }
      }
      if (manhattan(origin, connectedNodes[i]) <= 2) {
        links.push({ from: origin, to: { x: connectedNodes[i].x, y: connectedNodes[i].y } });
      }
    }
  } else {
    queue.push(origin);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const n of activeNodes) {
        if (!visited.has(n.id) && manhattan(curr, n) <= 2) {
          visited.add(n.id);
          connectedNodes.push(n);
          links.push({ from: curr, to: { x: n.x, y: n.y } });
          queue.push({ x: n.x, y: n.y });
        }
      }
    }
  }

  // Affected tiles: origin + all connected nodes + tiles orthogonally adjacent (dist <= 1) to any connected node
  const tileKey = (p: Pos) => `${p.x},${p.y}`;
  const tileSet = new Map<string, Pos>();
  tileSet.set(tileKey(origin), origin);
  for (const n of connectedNodes) {
    const dirs = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    for (const d of dirs) {
      const nx = n.x + d.x;
      const ny = n.y + d.y;
      if (inBounds(nx, ny)) {
        tileSet.set(tileKey({ x: nx, y: ny }), { x: nx, y: ny });
      }
    }
  }

  const hitEnemies = state.enemies.filter((e) => {
    if (e.hp <= 0) return false;
    if (samePos(e, origin)) return true;
    return connectedNodes.some((n) => manhattan(e, n) <= 1);
  });

  // Add visual arc links from nearest connected node (or origin) to every struck enemy
  for (const e of hitEnemies) {
    let source: Pos = origin;
    let bestDist = manhattan(origin, e);
    for (const n of connectedNodes) {
      const d = manhattan(n, e);
      if (d < bestDist) {
        bestDist = d;
        source = { x: n.x, y: n.y };
      }
    }
    if (!samePos(source, e)) {
      links.push({ from: source, to: { x: e.x, y: e.y } });
    }
  }

  return {
    connectedNodes,
    links,
    hitEnemies,
    affectedTiles: Array.from(tileSet.values()),
  };
}

function calcDamage(
  raw: number,
  target: EnemyUnit,
  playerWeak = false
): number {
  let d = raw;
  if (playerWeak) d = Math.floor(d * 0.75);
  if (target.vulnerable > 0) d = Math.round(d * 1.5);
  return Math.max(0, d);
}

function getPushDir(from: Pos, to: Pos): Pos {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: dx === 0 ? 1 : Math.sign(dx), y: 0 };
  }
  return { x: 0, y: dy === 0 ? 1 : Math.sign(dy) };
}

function getCardinalStep(from: Pos, target: Pos): Pos | null {
  if (from.x === target.x && from.y === target.y) return null;
  if (from.x === target.x) return { x: 0, y: Math.sign(target.y - from.y) };
  if (from.y === target.y) return { x: Math.sign(target.x - from.x), y: 0 };
  return null;
}

export function simulateKnockback(
  state: CombatState,
  enemy: EnemyUnit,
  dir: Pos,
  steps: number,
  relicIds: string[]
): {
  finalPos: Pos;
  slammed: boolean;
  slamTargetEnemyId?: string;
  pitKill: boolean;
  ventHits: number;
  detonatedNode?: RelayNode;
  slamDamage: number;
} {
  let cx = enemy.x;
  let cy = enemy.y;
  let slammed = false;
  let slamTargetEnemyId: string | undefined;
  let pitKill = false;
  let ventHits = 0;
  let detonatedNode: RelayNode | undefined;
  const totalSteps = steps + (relicIds.includes('heavy_pistons') ? 1 : 0);
  const slamBase = 3 + (relicIds.includes('impact_dampener') ? 2 : 0);

  for (let i = 0; i < totalSteps; i++) {
    const nx = cx + dir.x;
    const ny = cy + dir.y;
    if (!inBounds(nx, ny)) {
      slammed = true;
      break;
    }
    const tile = state.grid[ny][nx];
    if (tile.terrain === 'pillar') {
      slammed = true;
      break;
    }
    if (state.player.x === nx && state.player.y === ny) {
      slammed = true;
      break;
    }
    const otherEnemy = state.enemies.find((e) => e.hp > 0 && e.id !== enemy.id && e.x === nx && e.y === ny);
    if (otherEnemy) {
      slammed = true;
      slamTargetEnemyId = otherEnemy.id;
      break;
    }
    if (tile.terrain === 'pit') {
      if (enemy.isBoss) {
        // Bosses resist instant pit fall, take heavy slam instead
        slammed = true;
        return {
          finalPos: { x: cx, y: cy },
          slammed: true,
          pitKill: false,
          ventHits,
          detonatedNode,
          slamDamage: 12,
        };
      }
      cx = nx;
      cy = ny;
      pitKill = true;
      break;
    }
    cx = nx;
    cy = ny;
    if (tile.terrain === 'vent') {
      ventHits += 1;
    }
    const hitNode = getNodeAt(state, cx, cy);
    if (hitNode) {
      detonatedNode = hitNode;
      break;
    }
  }

  return {
    finalPos: { x: cx, y: cy },
    slammed,
    slamTargetEnemyId,
    pitKill,
    ventHits,
    detonatedNode,
    slamDamage: slammed ? slamBase : 0,
  };
}

export function getValidTargetTiles(state: CombatState, card: CardInstance): Pos[] {
  const def = getCardDef(card);
  const eff = getCardEffect(card);
  const range = eff.range ?? 8;
  const p = { x: state.player.x, y: state.player.y };
  const result: Pos[] = [];

  if (def.target === 'none') {
    return [p];
  }

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const pos = { x, y };
      const dist = manhattan(p, pos);
      if (def.target === 'move_tile') {
        if (dist > 0 && dist <= range && isTileWalkableForPlayer(state, x, y)) {
          result.push(pos);
        }
      } else if (def.target === 'empty_tile') {
        if (dist > 0 && dist <= range && isTileValidForNode(state, x, y)) {
          result.push(pos);
        }
      } else if (def.target === 'enemy') {
        if (dist <= range && getEnemyAt(state, x, y)) {
          result.push(pos);
        }
      } else if (def.target === 'any_tile') {
        if (dist <= range) {
          result.push(pos);
        }
      } else if (def.target === 'cardinal_dir') {
        const step = getCardinalStep(p, pos);
        if (step && dist <= range) {
          result.push(pos);
        }
      }
    }
  }
  return result;
}

export function previewCardAction(
  state: CombatState,
  card: CardInstance,
  target: Pos,
  relicIds: string[],
  metaArcBonus = 0
): ActionPreview {
  const def = getCardDef(card);
  const eff = getCardEffect(card);
  const cost = getCardCost(card, state, relicIds);
  const empty: ActionPreview = {
    valid: false,
    affectedTiles: [],
    arcLinks: [],
    chainCount: 0,
    damageByEnemyId: {},
    knockbacks: [],
    summaryRu: '',
    summaryEn: '',
  };

  if (state.phase !== 'player') return empty;
  if (state.player.energy < cost) {
    return { ...empty, reasonRu: 'Недостаточно энергии', reasonEn: 'Not enough Energy' };
  }

  const validTiles = getValidTargetTiles(state, card);
  const effectiveTarget = def.target === 'none' ? { x: state.player.x, y: state.player.y } : target;
  if (!validTiles.some((t) => samePos(t, effectiveTarget))) {
    return { ...empty, reasonRu: 'Выберите подсвеченную клетку', reasonEn: 'Select a highlighted tile' };
  }

  const affectedTiles: Pos[] = [];
  const arcLinks: Array<{ from: Pos; to: Pos }> = [];
  const damageByEnemyId: ActionPreview['damageByEnemyId'] = {};
  const knockbacks: ActionPreview['knockbacks'] = [];
  let chainCount = 0;

  const addDmg = (enemy: EnemyUnit, raw: number, slam = 0, pitKill = false, arcBonus = 0) => {
    const cur = damageByEnemyId[enemy.id] || { total: 0, slam: 0, pitKill: false, arcBonus: 0 };
    cur.total += calcDamage(raw, enemy) + slam;
    cur.slam += slam;
    cur.pitKill = cur.pitKill || pitKill;
    cur.arcBonus = Math.max(cur.arcBonus, arcBonus);
    damageByEnemyId[enemy.id] = cur;
  };

  const p = { x: state.player.x, y: state.player.y };

  if (def.target === 'empty_tile' && eff.placeNode) {
    affectedTiles.push(effectiveTarget);
    // Show which existing nodes it will connect with!
    for (const n of state.nodes) {
      if (manhattan(effectiveTarget, n) <= 2) {
        arcLinks.push({ from: effectiveTarget, to: { x: n.x, y: n.y } });
      }
    }
    return {
      valid: true,
      affectedTiles,
      arcLinks,
      chainCount: arcLinks.length + 1,
      damageByEnemyId,
      knockbacks,
      nodePlacement: effectiveTarget,
      summaryRu: `Установить ${def.nameRu} (${arcLinks.length > 0 ? `свяжется с ${arcLinks.length} узл.` : 'новый узел'})`,
      summaryEn: `Deploy ${def.nameEn} (${arcLinks.length > 0 ? `links ${arcLinks.length} nodes` : 'new node'})`,
    };
  }

  if (def.target === 'move_tile') {
    affectedTiles.push(effectiveTarget);
    if (eff.damage && eff.aoeRadius) {
      for (const e of state.enemies) {
        if (e.hp > 0 && manhattan(effectiveTarget, e) <= eff.aoeRadius) {
          affectedTiles.push({ x: e.x, y: e.y });
          let slam = 0;
          let pitKill = false;
          if (eff.push) {
            const sim = simulateKnockback(state, e, getPushDir(effectiveTarget, e), eff.push, relicIds);
            slam = sim.slamDamage + sim.ventHits * 3;
            pitKill = sim.pitKill;
            knockbacks.push({
              enemyId: e.id,
              from: { x: e.x, y: e.y },
              to: sim.finalPos,
              slammed: sim.slammed,
              pitKill: sim.pitKill,
              detonatedNode: !!sim.detonatedNode,
            });
          }
          addDmg(e, eff.damage, slam, pitKill);
        }
      }
    }
    return {
      valid: true,
      affectedTiles,
      arcLinks,
      chainCount: 0,
      damageByEnemyId,
      knockbacks,
      moveDest: effectiveTarget,
      summaryRu: eff.damage ? `Прыжок + удар (${eff.damage} ур.)` : `Переместить Ядро`,
      summaryEn: eff.damage ? `Leap + smash (${eff.damage} dmg)` : `Move Core`,
    };
  }

  // Compute Arc Circuit if card triggersArc
  const prismBonus = relicIds.includes('prism_lens') ? 3 : 0;
  if (eff.triggersArc) {
    const arcOrigin = eff.arcFromPlayer ? p : effectiveTarget;
    const net = computeArcNetwork(state, arcOrigin, !!eff.arcFromPlayer);
    chainCount = net.connectedNodes.length;
    arcLinks.push(...net.links);
    affectedTiles.push(...net.affectedTiles);

    const perNodeBonus =
      (eff.arcChainBonus ?? 2) + (relicIds.includes('tesla_overdrive') ? 1 : 0);
    const chargerBoost = net.connectedNodes.reduce(
      (acc, n) => acc + (state.grid[n.y][n.x].terrain === 'charger' ? 2 : 0),
      0
    );
    const copperBoost = relicIds.includes('copper_core') && chainCount >= 2 ? 2 : 0;
    const totalRaw =
      (eff.damage ?? 0) +
      perNodeBonus * chainCount +
      chargerBoost +
      copperBoost +
      prismBonus +
      metaArcBonus;

    for (const e of net.hitEnemies) {
      addDmg(e, totalRaw, 0, false, chainCount);
    }
  }

  // Cardinal line or targeted attack
  if (def.target === 'cardinal_dir') {
    const step = getCardinalStep(p, effectiveTarget)!;
    const maxRange = eff.lineAttack || eff.dashToTarget ? GRID_SIZE : (eff.range ?? GRID_SIZE);
    let cx = p.x + step.x;
    let cy = p.y + step.y;
    let dist = 1;
    let dashDest: Pos | undefined;
    while (inBounds(cx, cy) && dist <= maxRange) {
      const tile = state.grid[cy][cx];
      affectedTiles.push({ x: cx, y: cy });
      if (tile.terrain === 'pillar') break;
      const e = getEnemyAt(state, cx, cy);
      if (e) {
        const lineDmg = (eff.damage ?? 0) + (eff.lineAttack ? prismBonus : 0);
        let slam = 0;
        let pitKill = false;
        if (eff.push) {
          const sim = simulateKnockback(state, e, step, eff.push, relicIds);
          slam = sim.slamDamage + sim.ventHits * 3;
          pitKill = sim.pitKill;
          knockbacks.push({
            enemyId: e.id,
            from: { x: e.x, y: e.y },
            to: sim.finalPos,
            slammed: sim.slammed,
            pitKill: sim.pitKill,
            detonatedNode: !!sim.detonatedNode,
          });
        } else if (eff.pull) {
          const rev = { x: -step.x, y: -step.y };
          const sim = simulateKnockback(state, e, rev, eff.pull, relicIds);
          slam = sim.slamDamage + sim.ventHits * 3;
          pitKill = sim.pitKill;
          knockbacks.push({
            enemyId: e.id,
            from: { x: e.x, y: e.y },
            to: sim.finalPos,
            slammed: sim.slammed,
            pitKill: sim.pitKill,
            detonatedNode: !!sim.detonatedNode,
          });
        }
        if (!eff.triggersArc || !damageByEnemyId[e.id]) {
          addDmg(e, lineDmg, slam, pitKill);
        }
        if (!eff.lineAttack) break;
      } else if (eff.dashToTarget && tile.terrain !== 'pit' && !getNodeAt(state, cx, cy)) {
        dashDest = { x: cx, y: cy };
      }
      cx += step.x;
      cy += step.y;
      dist += 1;
    }
    const targetCount = Object.keys(damageByEnemyId).length;
    return {
      valid: true,
      affectedTiles,
      arcLinks,
      chainCount,
      damageByEnemyId,
      knockbacks,
      moveDest: dashDest,
      summaryRu:
        targetCount > 0
          ? `${def.nameRu}: заденет ${targetCount} ц.${knockbacks.some((k) => k.pitKill) ? ' ☠ СБРОС В ПРОПАСТЬ!' : knockbacks.some((k) => k.slammed) ? ' 💥 СТОЛКНОВЕНИЕ!' : ''}`
          : `${def.nameRu} (нет врагов на линии)`,
      summaryEn:
        targetCount > 0
          ? `${def.nameEn}: hits ${targetCount}${knockbacks.some((k) => k.pitKill) ? ' ☠ PIT KILL!' : knockbacks.some((k) => k.slammed) ? ' 💥 SLAM!' : ''}`
          : `${def.nameEn} (no enemy in line)`,
    };
  }

  // Single enemy or AoE non-arc
  if (def.target === 'enemy' && !eff.triggersArc) {
    affectedTiles.push(effectiveTarget);
    const e = getEnemyAt(state, effectiveTarget.x, effectiveTarget.y);
    if (e) {
      let slam = 0;
      let pitKill = false;
      if (eff.push) {
        const sim = simulateKnockback(state, e, getPushDir(p, e), eff.push, relicIds);
        slam = sim.slamDamage + sim.ventHits * 3;
        pitKill = sim.pitKill;
        knockbacks.push({
          enemyId: e.id,
          from: { x: e.x, y: e.y },
          to: sim.finalPos,
          slammed: sim.slammed,
          pitKill: sim.pitKill,
          detonatedNode: !!sim.detonatedNode,
        });
      }
      addDmg(e, eff.damage ?? 0, slam, pitKill);
    }
  } else if ((def.target === 'any_tile' || def.target === 'none') && eff.aoeRadius && !eff.triggersArc) {
    const center = effectiveTarget;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (manhattan(center, { x, y }) <= eff.aoeRadius) {
          affectedTiles.push({ x, y });
        }
      }
    }
    for (const e of state.enemies) {
      if (e.hp > 0 && manhattan(center, e) <= eff.aoeRadius) {
        let slam = 0;
        let pitKill = false;
        if (eff.push && !samePos(center, e)) {
          const sim = simulateKnockback(state, e, getPushDir(center, e), eff.push, relicIds);
          slam = sim.slamDamage + sim.ventHits * 3;
          pitKill = sim.pitKill;
          knockbacks.push({
            enemyId: e.id,
            from: { x: e.x, y: e.y },
            to: sim.finalPos,
            slammed: sim.slammed,
            pitKill: sim.pitKill,
            detonatedNode: !!sim.detonatedNode,
          });
        }
        if (eff.damage) addDmg(e, eff.damage, slam, pitKill);
      }
    }
  }

  const hits = Object.keys(damageByEnemyId).length;
  const summaryRu = eff.triggersArc
    ? `⚡ Дуга (цепь ×${chainCount}) → целей: ${hits}`
    : hits > 0
    ? `${def.nameRu} → целей: ${hits}`
    : `${def.nameRu}`;
  const summaryEn = eff.triggersArc
    ? `⚡ Arc (chain ×${chainCount}) → hits: ${hits}`
    : hits > 0
    ? `${def.nameEn} → hits: ${hits}`
    : `${def.nameEn}`;

  return {
    valid: true,
    affectedTiles,
    arcLinks,
    chainCount,
    damageByEnemyId,
    knockbacks,
    summaryRu,
    summaryEn,
  };
}

// === ENEMY INTENT TELEGRAPHING ===
export function planEnemyIntent(state: CombatState, enemy: EnemyUnit, overdrive = 0): EnemyIntent {
  const p = { x: state.player.x, y: state.player.y };
  const odBonus = overdrive > 0 ? overdrive : 0;
  const weakMult = enemy.weak > 0 ? 0.75 : 1;
  const scale = (base: number) => Math.max(1, Math.round((base + odBonus) * weakMult));

  if (enemy.stunned) {
    return {
      kind: 'buff_shield',
      damage: 0,
      targetTiles: [],
      labelRu: 'ОГЛУШЁН (пропуск)',
      labelEn: 'STUNNED (skipped)',
    };
  }

  const lineTilesFrom = (origin: Pos, dir: Pos): Pos[] => {
    const tiles: Pos[] = [];
    let cx = origin.x + dir.x;
    let cy = origin.y + dir.y;
    while (inBounds(cx, cy)) {
      if (state.grid[cy][cx].terrain === 'pillar') break;
      tiles.push({ x: cx, y: cy });
      cx += dir.x;
      cy += dir.y;
    }
    return tiles;
  };

  const crossTiles = (center: Pos): Pos[] => {
    const dirs = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    return dirs
      .map((d) => ({ x: center.x + d.x, y: center.y + d.y }))
      .filter((pos) => inBounds(pos.x, pos.y));
  };

  switch (enemy.defId) {
    case 'ram_drone':
    case 'swarm_spark':
    case 'berserk_blade':
    case 'void_reaper': {
      const dmgMap: Record<string, number> = {
        ram_drone: 6,
        swarm_spark: 5,
        berserk_blade: 10,
        void_reaper: 12,
      };
      const dmg = scale(dmgMap[enemy.defId]);
      const adj = [
        { x: enemy.x + 1, y: enemy.y },
        { x: enemy.x - 1, y: enemy.y },
        { x: enemy.x, y: enemy.y + 1 },
        { x: enemy.x, y: enemy.y - 1 },
      ].filter((t) => inBounds(t.x, t.y));
      const inRange = manhattan(enemy, p) === 1;
      return {
        kind: 'melee',
        damage: dmg,
        targetTiles: inRange ? [p] : adj.filter((t) => manhattan(t, p) < manhattan(enemy, p)).slice(0, 1),
        labelRu: `Удар ${dmg}`,
        labelEn: `Strike ${dmg}`,
      };
    }

    case 'laser_sniper':
    case 'heavy_turret':
    case 'prism_sentinel': {
      const dmgMap: Record<string, number> = {
        laser_sniper: 7,
        heavy_turret: 10,
        prism_sentinel: 11,
      };
      const dmg = scale(dmgMap[enemy.defId]);
      const dir = getPushDir(enemy, p);
      const tiles = lineTilesFrom(enemy, dir);
      if (enemy.defId === 'prism_sentinel' && enemy.turnCount % 3 === 2) {
        return {
          kind: 'buff_shield',
          damage: 0,
          shield: 8 + odBonus * 2,
          targetTiles: [],
          labelRu: `Щит отряду +${8 + odBonus * 2}`,
          labelEn: `Squad Shield +${8 + odBonus * 2}`,
        };
      }
      return {
        kind: 'ranged_line',
        damage: dmg,
        dir,
        targetTiles: tiles,
        labelRu: `Луч ${dmg}`,
        labelEn: `Beam ${dmg}`,
      };
    }

    case 'mortar_bot':
    case 'pyro_bomber': {
      const dmg = scale(enemy.defId === 'pyro_bomber' ? 9 : 6);
      return {
        kind: 'aoe_mortar',
        damage: dmg,
        targetTiles: crossTiles(p),
        labelRu: `Залп крестом ${dmg}`,
        labelEn: `Cross Blast ${dmg}`,
      };
    }

    case 'shield_bearer': {
      if (enemy.turnCount % 2 === 0) {
        return {
          kind: 'buff_shield',
          damage: 0,
          shield: 6 + odBonus * 2,
          targetTiles: [],
          labelRu: `Барьер +${6 + odBonus * 2}`,
          labelEn: `Barrier +${6 + odBonus * 2}`,
        };
      }
      const dmg = scale(6);
      return {
        kind: 'melee',
        damage: dmg,
        targetTiles: [p],
        labelRu: `Удар ${dmg}`,
        labelEn: `Bash ${dmg}`,
      };
    }

    case 'mag_puller': {
      const dmg = scale(8);
      const dir = getPushDir(enemy, p);
      return {
        kind: 'pull_blast',
        damage: dmg,
        dir,
        targetTiles: lineTilesFrom(enemy, dir),
        labelRu: `Захват + ${dmg}`,
        labelEn: `Pull + ${dmg}`,
      };
    }

    case 'elite_warden':
    case 'elite_furnace':
    case 'elite_architect': {
      if (enemy.turnCount % 3 === 1) {
        return {
          kind: 'summon',
          damage: 0,
          shield: 7 + odBonus * 2,
          targetTiles: [],
          labelRu: 'Призыв + Щит',
          labelEn: 'Summon + Shield',
        };
      }
      const dmg = scale(enemy.defId === 'elite_warden' ? 9 : enemy.defId === 'elite_furnace' ? 11 : 12);
      return {
        kind: 'aoe_mortar',
        damage: dmg,
        targetTiles: crossTiles(p),
        labelRu: `Ударная волна ${dmg}`,
        labelEn: `Shockwave ${dmg}`,
      };
    }

    case 'boss_crusher': {
      if (enemy.turnCount % 3 === 2) {
        return {
          kind: 'summon',
          damage: 0,
          shield: 9 + odBonus * 2,
          targetTiles: [],
          labelRu: 'Подкрепление + Щит',
          labelEn: 'Reinforce + Shield',
        };
      }
      const dmg = scale(10);
      // Sweeps player's entire row!
      const rowTiles: Pos[] = [];
      for (let x = 0; x < GRID_SIZE; x++) rowTiles.push({ x, y: p.y });
      return {
        kind: 'boss_sweep',
        damage: dmg,
        targetTiles: rowTiles,
        labelRu: `Сметание ряда ${dmg}`,
        labelEn: `Row Sweep ${dmg}`,
      };
    }

    case 'boss_prism': {
      if (enemy.turnCount % 3 === 1) {
        return {
          kind: 'buff_shield',
          damage: 0,
          shield: 14 + odBonus * 3,
          targetTiles: [],
          labelRu: `Призма-Щит +${14 + odBonus * 3}`,
          labelEn: `Prism Shield +${14 + odBonus * 3}`,
        };
      }
      const dmg = scale(11);
      // Full cross centered on Boss OR Player's row + col!
      const tiles: Pos[] = [];
      for (let i = 0; i < GRID_SIZE; i++) {
        tiles.push({ x: i, y: p.y });
        if (i !== p.y) tiles.push({ x: p.x, y: i });
      }
      return {
        kind: 'boss_prism',
        damage: dmg,
        targetTiles: tiles,
        labelRu: `Призма-Крест ${dmg}`,
        labelEn: `Prism Cross ${dmg}`,
      };
    }

    case 'boss_singularity': {
      const phase2 = enemy.hp <= enemy.maxHp / 2;
      if (enemy.turnCount % 3 === 2) {
        return {
          kind: 'summon',
          damage: 0,
          shield: phase2 ? 15 : 10,
          targetTiles: [],
          labelRu: phase2 ? 'ФАЗА II: Рой + Щит' : 'Призыв + Щит',
          labelEn: phase2 ? 'PHASE II: Swarm + Shield' : 'Summon + Shield',
        };
      }
      const dmg = scale(phase2 ? 14 : 11);
      // Targets checkerboard or cross + player's row
      const tiles: Pos[] = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (phase2 ? (x + y) % 2 === (p.x + p.y) % 2 : manhattan(p, { x, y }) <= 1 || y === p.y) {
            tiles.push({ x, y });
          }
        }
      }
      return {
        kind: 'boss_gravity',
        damage: dmg,
        targetTiles: tiles,
        labelRu: phase2 ? `Коллапс ${dmg}` : `Грави-Волна ${dmg}`,
        labelEn: phase2 ? `Collapse ${dmg}` : `Gravity Wave ${dmg}`,
      };
    }

    default:
      return {
        kind: 'melee',
        damage: scale(6),
        targetTiles: [p],
        labelRu: `Атака ${scale(6)}`,
        labelEn: `Attack ${scale(6)}`,
      };
  }
}

export function createCombatState(params: {
  template: EncounterTemplate;
  deck: CardInstance[];
  hp: number;
  maxHp: number;
  baseEnergy: number;
  relicIds: string[];
  overdrive: number;
  metaUpgrades: Record<string, number>;
  showTutorial: boolean;
}): CombatState {
  const { template, deck, hp, maxHp, baseEnergy, relicIds, overdrive, metaUpgrades, showTutorial } = params;

  const grid: Tile[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const ch = template.layout[y]?.[x] ?? '.';
      const terrain = parseTerrainChar(ch);
      row.push({ x, y, terrain, pillarHp: terrain === 'pillar' ? 2 : undefined });
    }
    grid.push(row);
  }

  // Ensure player spawn (0, 2) is clean floor
  grid[2][0].terrain = 'floor';

  const hpMult = 1 + overdrive * 0.15;
  const enemies: EnemyUnit[] = template.enemies.map((sp, idx) => {
    const def = ENEMIES[sp.defId];
    const scaledHp = Math.round(def.maxHp * hpMult);
    // Ensure spawn tile is walkable
    if (grid[sp.y][sp.x].terrain === 'pillar' || grid[sp.y][sp.x].terrain === 'pit') {
      grid[sp.y][sp.x].terrain = 'floor';
    }
    return {
      id: `enemy_${idx}_${sp.defId}`,
      defId: def.id,
      nameRu: def.nameRu,
      nameEn: def.nameEn,
      icon: def.icon,
      isElite: def.isElite,
      isBoss: def.isBoss,
      x: sp.x,
      y: sp.y,
      hp: scaledHp,
      maxHp: scaledHp,
      shield: 0,
      vulnerable: 0,
      weak: 0,
      stunned: false,
      intent: { kind: 'melee', damage: 0, targetTiles: [], labelRu: '', labelEn: '' },
      phase: 1,
      turnCount: 0,
      color: def.color,
    };
  });

  const maxEnergy = baseEnergy + (relicIds.includes('overclock_chip') ? 1 : 0);
  const startEnergy = maxEnergy + (relicIds.includes('quantum_capacitor') ? 1 : 0);
  const startShield =
    (relicIds.includes('titanium_hull') ? 3 : 0) +
    (relicIds.includes('chrono_stabilizer') ? 4 : 0) +
    (metaUpgrades.emergency_shield ?? 0) * 4;

  let shuffled = shuffle(deck.map((c) => ({ ...c })));
  if (showTutorial) {
    // Guarantee Turn 1 tutorial hand has a Relay, an Arc Spark, and a Piston Strike for smooth onboarding
    const priorityIds = ['deploy_relay', 'arc_spark', 'piston_strike'];
    const front: CardInstance[] = [];
    const rest: CardInstance[] = [];
    const picked = new Set<string>();
    for (const c of shuffled) {
      if (priorityIds.includes(c.defId) && !picked.has(c.defId)) {
        picked.add(c.defId);
        front.push(c);
      } else {
        rest.push(c);
      }
    }
    shuffled = [...front, ...rest];
  }
  const drawCount =
    5 +
    (relicIds.includes('quantum_capacitor') ? 1 : 0) +
    (relicIds.includes('chrono_stabilizer') ? 1 : 0);

  const hand = shuffled.slice(0, drawCount);
  const drawPile = shuffled.slice(drawCount);

  const nodes: RelayNode[] = [];
  const state: CombatState = {
    encounterId: template.id,
    encounterTitleRu: template.titleRu,
    encounterTitleEn: template.titleEn,
    act: template.act,
    isElite: !!template.isElite,
    isBoss: !!template.isBoss,
    grid,
    nodes,
    player: {
      x: 0,
      y: 2,
      hp,
      maxHp,
      shield: startShield,
      energy: startEnergy,
      maxEnergy,
      doubleNext: false,
      freeNodeUsed: false,
      firstCardPlayed: false,
      moveFreeUsed: false,
      overclockBonus: 0,
    },
    enemies,
    drawPile,
    hand,
    discardPile: [],
    exhaustPile: [],
    turn: 1,
    phase: 'player',
    log: [`⚡ Бой начался: ${template.titleRu}`],
    vfx: [],
    stats: {
      turns: 1,
      maxChain: 0,
      slams: 0,
      pitKills: 0,
      enemiesKilled: 0,
      damageDealt: 0,
      cardsPlayed: 0,
    },
    tutorialStep: showTutorial ? 1 : 0,
  };

  // Copper Core relic: place 1 starter Relay near Player
  if (relicIds.includes('copper_core')) {
    const candidates = [
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 2 },
    ];
    for (const c of candidates) {
      if (isTileValidForNode(state, c.x, c.y)) {
        state.nodes.push({ id: nextUid('node'), x: c.x, y: c.y, kind: 'relay', power: 2 });
        break;
      }
    }
  }

  for (const e of state.enemies) {
    e.intent = planEnemyIntent(state, e, overdrive);
  }

  return state;
}

function drawCards(state: CombatState, count: number): void {
  for (let i = 0; i < count; i++) {
    if (state.hand.length >= 8) break;
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      state.drawPile = shuffle(state.discardPile);
      state.discardPile = [];
    }
    const card = state.drawPile.shift();
    if (card) state.hand.push(card);
  }
}

function pushVfx(state: CombatState, ev: Omit<VfxEvent, 'id' | 'createdAt'>): void {
  state.vfx.push({
    ...ev,
    id: nextUid('vfx'),
    createdAt: Date.now(),
  });
}

function damageEnemy(
  state: CombatState,
  enemy: EnemyUnit,
  rawDamage: number,
  relicIds: string[],
  sourceLabel = '',
  ignoreVuln = false
): number {
  if (enemy.hp <= 0 || rawDamage <= 0) return 0;
  let dmg = ignoreVuln ? rawDamage : calcDamage(rawDamage, enemy);
  const blocked = Math.min(enemy.shield, dmg);
  enemy.shield -= blocked;
  const hpDmg = dmg - blocked;
  enemy.hp = Math.max(0, enemy.hp - hpDmg);
  state.stats.damageDealt += dmg;

  pushVfx(state, {
    kind: 'float_text',
    pos: { x: enemy.x, y: enemy.y },
    text: `-${dmg}${sourceLabel ? ` ${sourceLabel}` : ''}`,
    color: sourceLabel.includes('⚡') ? '#22d3ee' : sourceLabel.includes('💥') ? '#f59e0b' : '#fb7185',
    duration: 900,
  });

  if (enemy.hp <= 0) {
    state.stats.enemiesKilled += 1;
    state.log.push(`💀 ${enemy.nameRu} уничтожен!`);
    pushVfx(state, {
      kind: 'explosion',
      pos: { x: enemy.x, y: enemy.y },
      color: '#f43f5e',
      duration: 500,
    });
    if (relicIds.includes('recuperator')) {
      state.player.energy += 1;
      pushVfx(state, {
        kind: 'float_text',
        pos: { x: state.player.x, y: state.player.y },
        text: '+1 ⚡',
        color: '#22d3ee',
        duration: 850,
      });
    }
  }
  return dmg;
}

function applyKnockbackAndHazards(
  state: CombatState,
  enemy: EnemyUnit,
  dir: Pos,
  steps: number,
  relicIds: string[]
): void {
  if (enemy.hp <= 0) return;
  const startPos = { x: enemy.x, y: enemy.y };
  const sim = simulateKnockback(state, enemy, dir, steps, relicIds);
  enemy.x = sim.finalPos.x;
  enemy.y = sim.finalPos.y;

  if (!samePos(startPos, sim.finalPos)) {
    pushVfx(state, {
      kind: 'move_trail',
      from: startPos,
      to: sim.finalPos,
      color: '#f59e0b',
      duration: 380,
    });
  }

  if (sim.pitKill) {
    enemy.hp = 0;
    state.stats.enemiesKilled += 1;
    state.stats.pitKills += 1;
    state.log.push(`☠ ${enemy.nameRu} сброшен в пропасть!`);
    pushVfx(state, {
      kind: 'pit_kill',
      pos: sim.finalPos,
      text: '☠ ПРОПАСТЬ!',
      color: '#f43f5e',
      duration: 900,
    });
    if (relicIds.includes('gravi_anchor')) drawCards(state, 1);
    if (relicIds.includes('recuperator')) state.player.energy += 1;
    return;
  }

  if (sim.ventHits > 0) {
    damageEnemy(state, enemy, sim.ventHits * 3, relicIds, '🔥', true);
  }

  if (sim.slammed) {
    state.stats.slams += 1;
    damageEnemy(state, enemy, sim.slamDamage, relicIds, '💥', true);
    pushVfx(state, { kind: 'slam', pos: sim.finalPos, color: '#f59e0b', duration: 400 });
    if (sim.slamTargetEnemyId) {
      const other = state.enemies.find((e) => e.id === sim.slamTargetEnemyId && e.hp > 0);
      if (other) {
        damageEnemy(state, other, sim.slamDamage, relicIds, '💥', true);
      }
    }
    if (relicIds.includes('impact_dampener')) {
      state.player.shield += 3;
      pushVfx(state, {
        kind: 'shield',
        pos: { x: state.player.x, y: state.player.y },
        text: '+3 🛡',
        color: '#10b981',
        duration: 700,
      });
    }
    if (relicIds.includes('gravi_anchor')) {
      drawCards(state, 1);
    }
  }

  if (sim.detonatedNode) {
    const node = sim.detonatedNode;
    state.nodes = state.nodes.filter((n) => n.id !== node.id);
    const detDmg =
      node.kind === 'mine'
        ? 8 + (node.power - 3)
        : relicIds.includes('volatile_nodes')
        ? 10
        : 6;
    state.log.push(`💣 Подрыв узла! ${detDmg} урона по площади.`);
    pushVfx(state, { kind: 'explosion', pos: { x: node.x, y: node.y }, color: '#22d3ee', duration: 500 });
    for (const target of state.enemies) {
      if (target.hp > 0 && manhattan(target, node) <= 1) {
        damageEnemy(state, target, detDmg, relicIds, '💣');
        if (node.kind === 'mine' && target.hp > 0) {
          target.stunned = true;
          target.intent = planEnemyIntent(state, target);
        }
      }
    }
  }
}

function spawnRandomRelaysNearEnemies(state: CombatState, count: number): void {
  for (let i = 0; i < count; i++) {
    const candidates: Pos[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (isTileValidForNode(state, x, y)) {
          candidates.push({ x, y });
        }
      }
    }
    if (candidates.length === 0) break;
    // Prefer tiles close to alive enemies
    candidates.sort((a, b) => {
      const da = Math.min(...state.enemies.filter((e) => e.hp > 0).map((e) => manhattan(a, e)), 9);
      const db = Math.min(...state.enemies.filter((e) => e.hp > 0).map((e) => manhattan(b, e)), 9);
      return da - db;
    });
    const pick = candidates[0];
    state.nodes.push({ id: nextUid('node'), x: pick.x, y: pick.y, kind: 'relay', power: 2 });
    pushVfx(state, { kind: 'shield', pos: pick, text: '⚡ РЕЛЕ', color: '#22d3ee', duration: 600 });
  }
}

function executeCardEffectOnce(
  state: CombatState,
  card: CardInstance,
  target: Pos,
  relicIds: string[],
  metaArcBonus: number,
  overdrive: number
): void {
  const def = getCardDef(card);
  const eff = getCardEffect(card);
  const p = { x: state.player.x, y: state.player.y };

  // Special Synchro Pulse conditional
  if (card.defId === 'synchro_pulse') {
    if (state.nodes.length > 0) {
      state.player.energy += eff.energyGain ?? 1;
      drawCards(state, eff.draw ?? 2);
      state.log.push(`⚙️ Синхро-Импульс: +${eff.energyGain}⚡ и добор ${eff.draw}.`);
    } else {
      spawnRandomRelaysNearEnemies(state, 1);
      if (card.upgraded) state.player.energy += 1;
      state.log.push(`⚙️ Синхро-Импульс поставил Реле на арену.`);
    }
    return;
  }

  if (eff.spawnRandomRelay) {
    spawnRandomRelaysNearEnemies(state, eff.spawnRandomRelay);
  }

  // Place node
  if (def.target === 'empty_tile' && eff.placeNode && isTileValidForNode(state, target.x, target.y)) {
    state.nodes.push({
      id: nextUid('node'),
      x: target.x,
      y: target.y,
      kind: eff.placeNode,
      power: eff.nodePower ?? 2,
    });
    pushVfx(state, {
      kind: 'shield',
      pos: target,
      text: eff.placeNode === 'mine' ? '💣 МИНА' : eff.placeNode === 'tesla' ? '🗼 КАТУШКА' : '⚡ РЕЛЕ',
      color: '#22d3ee',
      duration: 650,
    });
    state.log.push(`⚡ Установлен узел «${def.nameRu}» (${target.x + 1},${target.y + 1}).`);
    if (state.tutorialStep === 1) state.tutorialStep = 2;
  }

  // Move / Teleport
  if (def.target === 'move_tile' && isTileWalkableForPlayer(state, target.x, target.y)) {
    pushVfx(state, { kind: 'move_trail', from: p, to: target, color: '#38bdf8', duration: 350 });
    state.player.x = target.x;
    state.player.y = target.y;
    if (eff.damage && eff.aoeRadius) {
      pushVfx(state, { kind: 'explosion', pos: target, color: '#f59e0b', duration: 480 });
      const targets = state.enemies.filter((e) => e.hp > 0 && manhattan(target, e) <= eff.aoeRadius!);
      for (const e of targets) {
        damageEnemy(state, e, eff.damage, relicIds);
        if (eff.push) applyKnockbackAndHazards(state, e, getPushDir(target, e), eff.push, relicIds);
      }
    }
  }

  // Shield & Heal & Energy & Draw & Double
  let shieldGain = eff.shield ?? 0;
  if (eff.bonusShieldPerNode) {
    shieldGain += eff.bonusShieldPerNode * state.nodes.length;
  }
  if (shieldGain > 0) {
    state.player.shield += shieldGain;
    pushVfx(state, {
      kind: 'shield',
      pos: { x: state.player.x, y: state.player.y },
      text: `+${shieldGain} 🛡`,
      color: '#10b981',
      duration: 750,
    });
  }
  if (eff.heal) {
    const healed = Math.min(state.player.maxHp - state.player.hp, eff.heal);
    state.player.hp += healed;
    if (healed > 0) {
      pushVfx(state, {
        kind: 'heal',
        pos: { x: state.player.x, y: state.player.y },
        text: `+${healed} HP`,
        color: '#34d399',
        duration: 850,
      });
    }
  }
  if (eff.energyGain) {
    state.player.energy += eff.energyGain;
    pushVfx(state, {
      kind: 'float_text',
      pos: { x: state.player.x, y: state.player.y },
      text: `+${eff.energyGain} ⚡`,
      color: '#22d3ee',
      duration: 750,
    });
  }
  if (eff.doubleNextCard) {
    state.player.doubleNext = true;
    state.log.push('🪞 Следующая карта сработает ДВАЖДЫ!');
  }

  const prismBonus = relicIds.includes('prism_lens') ? 3 : 0;

  // Arc Chain execution
  if (eff.triggersArc) {
    const arcOrigin = eff.arcFromPlayer ? { x: state.player.x, y: state.player.y } : target;
    const net = computeArcNetwork(state, arcOrigin, !!eff.arcFromPlayer);
    const chain = net.connectedNodes.length;
    if (chain > state.stats.maxChain) state.stats.maxChain = chain;

    for (const link of net.links) {
      pushVfx(state, { kind: 'arc', from: link.from, to: link.to, color: '#22d3ee', duration: 480 });
    }
    if (chain >= 1) {
      pushVfx(state, {
        kind: 'float_text',
        pos: arcOrigin,
        text: `⚡ ЦЕПЬ ×${chain}!`,
        color: '#67e8f9',
        duration: 950,
      });
    }

    const perNode = (eff.arcChainBonus ?? 2) + (relicIds.includes('tesla_overdrive') ? 1 : 0);
    const chargerBoost = net.connectedNodes.reduce(
      (acc, n) => acc + (state.grid[n.y][n.x].terrain === 'charger' ? 2 : 0),
      0
    );
    const copperBoost = relicIds.includes('copper_core') && chain >= 2 ? 2 : 0;
    const totalRaw =
      (eff.damage ?? 0) + perNode * chain + chargerBoost + copperBoost + prismBonus + metaArcBonus;

    // Pull for Magnetic Vortex before damage/arc
    if (eff.pull && eff.aoeRadius) {
      const pullTargets = state.enemies.filter((e) => e.hp > 0 && manhattan(target, e) <= eff.aoeRadius! + 1 && !samePos(target, e));
      for (const e of pullTargets) {
        applyKnockbackAndHazards(state, e, getPushDir(e, target), eff.pull, relicIds);
      }
    }

    for (const e of net.hitEnemies) {
      damageEnemy(state, e, totalRaw, relicIds, chain > 0 ? `⚡×${chain}` : '⚡');
      if (eff.vulnerable && e.hp > 0) e.vulnerable += eff.vulnerable;
      if (relicIds.includes('prism_lens') && e.hp > 0) e.vulnerable += 1;
    }

    if (eff.consumeNodes && net.connectedNodes.length > 0) {
      const consumedIds = new Set(net.connectedNodes.map((n) => n.id));
      for (const n of net.connectedNodes) {
        pushVfx(state, { kind: 'explosion', pos: { x: n.x, y: n.y }, color: '#22d3ee', duration: 500 });
      }
      state.nodes = state.nodes.filter((n) => !consumedIds.has(n.id));
      state.log.push(`💥 Короткое Замыкание взорвало ${net.connectedNodes.length} узл.!`);
    } else if (net.hitEnemies.length > 0) {
      state.log.push(`⚡ ${def.nameRu} (цепь ×${chain}): ${totalRaw} ур. по ${net.hitEnemies.length} ц.`);
    }

    if (state.tutorialStep === 2 && chain >= 1) state.tutorialStep = 3;
  }

  // Cardinal Direction attacks (Piston Strike, Ram Charge, Railgun, Gravi-Hook, Plasma Conduit)
  if (def.target === 'cardinal_dir') {
    const step = getCardinalStep(p, target);
    if (step) {
      const maxRange = eff.lineAttack || eff.dashToTarget ? GRID_SIZE : (eff.range ?? GRID_SIZE);
      let cx = p.x + step.x;
      let cy = p.y + step.y;
      let dist = 1;
      const hitList: EnemyUnit[] = [];
      let dashPos = p;
      let lastLineTile = p;

      while (inBounds(cx, cy) && dist <= maxRange) {
        const tile = state.grid[cy][cx];
        if (tile.terrain === 'pillar') break;
        lastLineTile = { x: cx, y: cy };
        const e = getEnemyAt(state, cx, cy);
        if (e) {
          hitList.push(e);
          if (!eff.lineAttack) break;
        } else if (eff.dashToTarget && tile.terrain !== 'pit' && !getNodeAt(state, cx, cy)) {
          dashPos = { x: cx, y: cy };
        }
        cx += step.x;
        cy += step.y;
        dist += 1;
      }

      if (eff.dashToTarget && !samePos(p, dashPos)) {
        pushVfx(state, { kind: 'move_trail', from: p, to: dashPos, color: '#f59e0b', duration: 350 });
        state.player.x = dashPos.x;
        state.player.y = dashPos.y;
      }
      if (eff.lineAttack) {
        pushVfx(state, {
          kind: 'arc',
          from: p,
          to: lastLineTile,
          color: def.archetype === 'arc' ? '#22d3ee' : '#f59e0b',
          duration: 420,
        });
      }

      // Process hits (reverse order if pushing along line so front unit doesn't block back unit unexpectedly)
      const ordered = eff.push ? [...hitList].reverse() : hitList;
      for (const e of ordered) {
        const lineDmg = (eff.damage ?? 0) + (eff.lineAttack ? prismBonus : 0);
        if (!eff.triggersArc) {
          damageEnemy(state, e, lineDmg, relicIds);
        }
        if (eff.vulnerable && e.hp > 0) e.vulnerable += eff.vulnerable;
        if (eff.weak && e.hp > 0) e.weak += eff.weak;
        if (eff.push && e.hp > 0) {
          applyKnockbackAndHazards(state, e, step, eff.push, relicIds);
          if (state.tutorialStep === 3) state.tutorialStep = 0;
        } else if (eff.pull && e.hp > 0) {
          applyKnockbackAndHazards(state, e, { x: -step.x, y: -step.y }, eff.pull, relicIds);
        }
      }
    }
  }

  // Targeted single enemy (not arc)
  if (def.target === 'enemy' && !eff.triggersArc) {
    const e = getEnemyAt(state, target.x, target.y);
    if (e) {
      if (eff.damage) damageEnemy(state, e, eff.damage, relicIds);
      if (eff.vulnerable && e.hp > 0) e.vulnerable += eff.vulnerable;
      if (eff.weak && e.hp > 0) e.weak += eff.weak;
      if (eff.stun && e.hp > 0) {
        e.stunned = true;
        e.intent = planEnemyIntent(state, e, overdrive);
        state.log.push(`📡 ${e.nameRu} ОГЛУШЁН!`);
      }
      if (eff.push && e.hp > 0) {
        applyKnockbackAndHazards(state, e, getPushDir(p, e), eff.push, relicIds);
        if (state.tutorialStep === 3) state.tutorialStep = 0;
      }
    }
  }

  // AoE non-arc (Seismic Wave, Pulse Grenade, Aegis Protocol, Reactive Plating)
  if ((def.target === 'any_tile' || def.target === 'none') && eff.aoeRadius && !eff.triggersArc) {
    const center = def.target === 'none' ? { x: state.player.x, y: state.player.y } : target;
    if (eff.damage) {
      pushVfx(state, { kind: 'explosion', pos: center, color: '#f59e0b', duration: 450 });
    }
    const targets = state.enemies.filter((e) => e.hp > 0 && manhattan(center, e) <= eff.aoeRadius!);
    for (const e of targets) {
      if (eff.damage) damageEnemy(state, e, eff.damage, relicIds);
      if (eff.weak && e.hp > 0) e.weak += eff.weak;
      if (eff.vulnerable && e.hp > 0) e.vulnerable += eff.vulnerable;
      if (eff.push && e.hp > 0 && !samePos(center, e)) {
        applyKnockbackAndHazards(state, e, getPushDir(center, e), eff.push, relicIds);
        if (state.tutorialStep === 3) state.tutorialStep = 0;
      }
    }
  }

  if (eff.draw) {
    drawCards(state, eff.draw);
  }
}

export function playCard(
  prevState: CombatState,
  cardUid: string,
  target: Pos,
  relicIds: string[],
  metaArcBonus = 0,
  overdrive = 0
): CombatState {
  const state: CombatState = structuredClone(prevState);
  const idx = state.hand.findIndex((c) => c.uid === cardUid);
  if (idx === -1 || state.phase !== 'player') return prevState;

  const card = state.hand[idx];
  const preview = previewCardAction(state, card, target, relicIds, metaArcBonus);
  if (!preview.valid) return prevState;

  const eff = getCardEffect(card);
  const cost = getCardCost(card, state, relicIds);
  state.player.energy -= cost;
  state.stats.cardsPlayed += 1;

  if (eff.placeNode && relicIds.includes('superconductor') && !state.player.freeNodeUsed) {
    state.player.freeNodeUsed = true;
  }

  // Remove card from hand first
  state.hand.splice(idx, 1);

  const shouldDouble = state.player.doubleNext && !eff.doubleNextCard;
  if (shouldDouble) {
    state.player.doubleNext = false;
  }

  const effectiveTarget =
    getCardDef(card).target === 'none' ? { x: state.player.x, y: state.player.y } : target;

  executeCardEffectOnce(state, card, effectiveTarget, relicIds, metaArcBonus, overdrive);
  if (shouldDouble && state.enemies.some((e) => e.hp > 0)) {
    state.log.push(`🪞 Квантовый Дубль повторяет «${getCardDef(card).nameRu}»!`);
    executeCardEffectOnce(state, card, effectiveTarget, relicIds, metaArcBonus, overdrive);
  }

  // Send card to exhaust or discard
  if (eff.exhaust) {
    state.exhaustPile.push(card);
  } else {
    state.discardPile.push(card);
  }

  // Remove dead enemies cleanly from board check
  const alive = state.enemies.filter((e) => e.hp > 0);
  if (alive.length === 0) {
    state.phase = 'victory';
    state.log.push('🏆 Сектор зачищен! Победа!');
  } else {
    // Re-evaluate line-based intents ONLY if enemy was displaced (so telegraphs stay accurate!)
    for (const e of alive) {
      if (e.intent.kind === 'ranged_line' || e.intent.kind === 'pull_blast') {
        const dir = e.intent.dir ?? getPushDir(e, state.player);
        const tiles: Pos[] = [];
        let cx = e.x + dir.x;
        let cy = e.y + dir.y;
        while (inBounds(cx, cy)) {
          if (state.grid[cy][cx].terrain === 'pillar') break;
          tiles.push({ x: cx, y: cy });
          cx += dir.x;
          cy += dir.y;
        }
        e.intent = { ...e.intent, targetTiles: tiles };
      } else if (e.intent.kind === 'melee') {
        // If melee enemy was pushed away from player, its original targeted tile may no longer hit!
        e.intent = {
          ...e.intent,
          targetTiles: e.intent.targetTiles.filter((t) => manhattan(e, t) <= 1),
        };
      }
    }
  }

  return state;
}

function moveEnemyTowardPlayer(state: CombatState, enemy: EnemyUnit, steps: number, relicIds: string[]): void {
  for (let s = 0; s < steps; s++) {
    if (enemy.hp <= 0) break;
    const p = { x: state.player.x, y: state.player.y };
    const currDist = manhattan(enemy, p);
    if (currDist <= 1) break;

    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    let best: Pos | null = null;
    let bestScore = currDist * 10;

    for (const d of dirs) {
      const nx = enemy.x + d.x;
      const ny = enemy.y + d.y;
      if (isTileBlockedForWalk(state, nx, ny)) continue;
      // Avoid stepping onto thermal vents unless necessary
      const penalty = state.grid[ny][nx].terrain === 'vent' ? 4 : 0;
      const score = manhattan({ x: nx, y: ny }, p) * 10 + penalty;
      if (score < bestScore) {
        bestScore = score;
        best = { x: nx, y: ny };
      }
    }
    if (!best) break;
    enemy.x = best.x;
    enemy.y = best.y;

    // Trigger Shock Mine if enemy stepped on one!
    const steppedNode = getNodeAt(state, enemy.x, enemy.y);
    if (steppedNode && steppedNode.kind === 'mine') {
      state.nodes = state.nodes.filter((n) => n.id !== steppedNode.id);
      const mineDmg = 8 + (steppedNode.power - 3);
      damageEnemy(state, enemy, mineDmg, relicIds, '💣');
      if (enemy.hp > 0) {
        enemy.stunned = true;
        state.log.push(`💣 ${enemy.nameRu} подорвался на Шок-Мине!`);
      }
      break;
    }
  }
}

export function endPlayerTurn(
  prevState: CombatState,
  relicIds: string[],
  overdrive = 0
): CombatState {
  const state: CombatState = structuredClone(prevState);
  if (state.phase !== 'player') return prevState;

  // 1. End-of-player-turn effects: Tesla Coils zap adjacent enemies
  for (const node of state.nodes) {
    if (node.kind === 'tesla') {
      const zapDmg = node.power + 1;
      for (const e of state.enemies) {
        if (e.hp > 0 && manhattan(node, e) <= 1) {
          pushVfx(state, { kind: 'arc', from: { x: node.x, y: node.y }, to: { x: e.x, y: e.y }, color: '#22d3ee', duration: 420 });
          damageEnemy(state, e, zapDmg, relicIds, '🗼');
        }
      }
    }
  }

  // Player standing on Thermal Vent
  if (state.grid[state.player.y][state.player.x].terrain === 'vent') {
    if (relicIds.includes('plasma_vent_boots')) {
      state.player.shield += 4;
    } else {
      const dmg = 3;
      const blocked = Math.min(state.player.shield, dmg);
      state.player.shield -= blocked;
      state.player.hp = Math.max(0, state.player.hp - (dmg - blocked));
      state.log.push('🔥 Термальный люк обжёг Ядро (-3).');
    }
  }

  // Check victory from Tesla Coils before enemy actions
  if (!state.enemies.some((e) => e.hp > 0)) {
    state.phase = 'victory';
    state.log.push('🏆 Сектор зачищен! Победа!');
    return state;
  }

  // Discard remaining hand
  state.discardPile.push(...state.hand);
  state.hand = [];
  state.player.doubleNext = false;

  // 2. Enemy Turn Resolution
  const aliveEnemies = state.enemies.filter((e) => e.hp > 0);
  const spawned: EnemyUnit[] = [];

  for (const enemy of aliveEnemies) {
    if (enemy.hp <= 0) continue;

    // Thermal vent burn on enemies
    if (state.grid[enemy.y][enemy.x].terrain === 'vent') {
      damageEnemy(state, enemy, 3, relicIds, '🔥', true);
      if (enemy.hp <= 0) continue;
    }

    // Clear enemy's old shield at start of its turn
    enemy.shield = 0;

    if (enemy.stunned) {
      enemy.stunned = false;
      state.log.push(`📡 ${enemy.nameRu} пришёл в себя после оглушения.`);
    } else {
      const intent = enemy.intent;
      const playerHit = intent.targetTiles.some((t) => t.x === state.player.x && t.y === state.player.y);

      if (intent.kind === 'buff_shield' && intent.shield) {
        for (const ally of aliveEnemies) {
          if (ally.hp > 0) ally.shield += intent.shield;
        }
        state.log.push(`🛡 ${enemy.nameRu} усилил барьеры отряда (+${intent.shield}).`);
      } else if (intent.kind === 'summon') {
        if (intent.shield) enemy.shield += intent.shield;
        // Spawn a Swarm Spark on nearest free tile
        if (state.enemies.filter((e) => e.hp > 0).length + spawned.length < 5) {
          for (let y = 0; y < GRID_SIZE; y++) {
            let placed = false;
            for (let x = GRID_SIZE - 1; x >= 0; x--) {
              if (!isTileBlockedForWalk(state, x, y) && !spawned.some((s) => s.x === x && s.y === y)) {
                const spDef = ENEMIES.swarm_spark;
                const unit: EnemyUnit = {
                  id: nextUid('spawn'),
                  defId: spDef.id,
                  nameRu: spDef.nameRu,
                  nameEn: spDef.nameEn,
                  icon: spDef.icon,
                  x,
                  y,
                  hp: spDef.maxHp,
                  maxHp: spDef.maxHp,
                  shield: 0,
                  vulnerable: 0,
                  weak: 0,
                  stunned: false,
                  intent: { kind: 'melee', damage: 5, targetTiles: [], labelRu: 'Удар 5', labelEn: 'Strike 5' },
                  turnCount: 0,
                  color: spDef.color,
                };
                spawned.push(unit);
                state.log.push(`🐝 ${enemy.nameRu} призвал Искра-Рой!`);
                placed = true;
                break;
              }
            }
            if (placed) break;
          }
        }
      } else if (playerHit && intent.damage > 0) {
        const blocked = Math.min(state.player.shield, intent.damage);
        state.player.shield -= blocked;
        const net = intent.damage - blocked;
        state.player.hp = Math.max(0, state.player.hp - net);
        pushVfx(state, {
          kind: 'float_text',
          pos: { x: state.player.x, y: state.player.y },
          text: net > 0 ? `-${net} HP` : '🛡 БЛОК!',
          color: net > 0 ? '#f43f5e' : '#10b981',
          duration: 900,
        });
        state.log.push(
          net > 0
            ? `💥 ${enemy.nameRu} попал по Ядру: -${net} HP${blocked > 0 ? ` (щит поглотил ${blocked})` : ''}.`
            : `🛡 Щит полностью поглотил атаку ${enemy.nameRu}!`
        );

        // Mag-Puller pulls player 1 tile closer if hit
        if (intent.kind === 'pull_blast' && intent.dir) {
          const px = state.player.x - intent.dir.x;
          const py = state.player.y - intent.dir.y;
          if (isTileWalkableForPlayer(state, px, py)) {
            state.player.x = px;
            state.player.y = py;
          }
        }
      }

      // Move enemy after attacking (so player's positioning dodges work cleanly!)
      const eDef = ENEMIES[enemy.defId];
      if (eDef && eDef.moveRange > 0 && state.player.hp > 0) {
        moveEnemyTowardPlayer(state, enemy, eDef.moveRange, relicIds);
      }
    }

    // Decay status effects
    if (enemy.vulnerable > 0) enemy.vulnerable -= 1;
    if (enemy.weak > 0) enemy.weak -= 1;
    enemy.turnCount += 1;
  }

  state.enemies.push(...spawned);

  // Check defeat or victory
  if (state.player.hp <= 0) {
    state.phase = 'defeat';
    state.log.push('💥 Ядро разрушено. Забег завершён.');
    return state;
  }
  if (!state.enemies.some((e) => e.hp > 0)) {
    state.phase = 'victory';
    state.log.push('🏆 Сектор зачищен! Победа!');
    return state;
  }

  // 3. Start next Player Turn
  state.turn += 1;
  state.stats.turns = state.turn;
  const chargerEnergy = state.grid[state.player.y][state.player.x].terrain === 'charger' ? 1 : 0;
  state.player.energy = state.player.maxEnergy + chargerEnergy;
  state.player.shield =
    (relicIds.includes('titanium_hull') ? 3 : 0) +
    (relicIds.includes('chrono_stabilizer') ? 4 : 0);

  if (chargerEnergy > 0) {
    state.log.push('⚡ Зарядная плита дала +1 Энергию!');
  }

  const drawCount = 5 + (relicIds.includes('chrono_stabilizer') ? 1 : 0);
  drawCards(state, drawCount);

  // Plan fresh telegraphed intents for all alive enemies
  for (const e of state.enemies) {
    if (e.hp > 0) {
      e.intent = planEnemyIntent(state, e, overdrive);
    }
  }

  return state;
}

export function pickEncounterForNode(
  act: 1 | 2 | 3,
  isElite: boolean,
  isBoss: boolean,
  usedIds: string[]
): EncounterTemplate {
  const pool = ENCOUNTERS.filter(
    (e) => e.act === act && !!e.isElite === isElite && !!e.isBoss === isBoss
  );
  const fresh = pool.filter((e) => !usedIds.includes(e.id));
  const source = fresh.length > 0 ? fresh : pool;
  return source[Math.floor(Math.random() * source.length)] ?? ENCOUNTERS[0];
}
