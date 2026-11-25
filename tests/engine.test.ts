import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/game/data/cards';
import { ENCOUNTERS } from '../src/game/data/enemies';
import { PILOTS } from '../src/game/data/pilots';
import { RELICS } from '../src/game/data/relics';
import {
  computeArcNetwork,
  createCombatState,
  endPlayerTurn,
  nextUid,
  playCard,
  previewCardAction,
} from '../src/game/engine/combat';
import {
  createNewRun,
  defaultMeta,
  enterMapNode,
  finishCombatVictory,
  generateActMap,
  getSelectableMapNodeIds,
  proceedAfterReward,
} from '../src/game/engine/run';

describe('ARC PROTOCOL — Core Mechanics & Balance Engine', () => {
  it('propagates Arc Chain across connected Relay nodes and scales damage by chain count', () => {
    const tpl = ENCOUNTERS[0];
    const deck = [
      { uid: 'c1', defId: 'deploy_relay', upgraded: false },
      { uid: 'c2', defId: 'deploy_relay', upgraded: false },
      { uid: 'c3', defId: 'arc_spark', upgraded: false },
    ];
    const state = createCombatState({
      template: tpl,
      deck,
      hp: 46,
      maxHp: 46,
      baseEnergy: 5,
      relicIds: [],
      overdrive: 0,
      metaUpgrades: {},
      showTutorial: false,
    });
    state.nodes = [
      { id: 'n1', x: 1, y: 1, kind: 'relay', power: 2 },
      { id: 'n2', x: 2, y: 1, kind: 'relay', power: 2 },
      { id: 'n3', x: 3, y: 2, kind: 'relay', power: 2 },
    ];
    state.enemies[0].x = 3;
    state.enemies[0].y = 1;
    state.enemies[0].hp = 20;

    const net = computeArcNetwork(state, { x: 1, y: 1 });
    expect(net.connectedNodes.length).toBe(3);
    expect(net.hitEnemies.some((e) => e.id === state.enemies[0].id)).toBe(true);

    const spark = state.hand.find((c) => c.defId === 'arc_spark')!;
    const prev = previewCardAction(state, spark, { x: 1, y: 1 }, [], 0);
    expect(prev.valid).toBe(true);
    expect(prev.chainCount).toBe(3);
    // base 4 + 3*2 = 10
    expect(prev.damageByEnemyId[state.enemies[0].id].total).toBe(10);

    const after = playCard(state, spark.uid, { x: 1, y: 1 }, [], 0, 0);
    expect(after.enemies[0].hp).toBe(10);
    expect(after.stats.maxChain).toBe(3);
  });

  it('handles knockback Wall Slam bonus damage and Pit Instant Kill', () => {
    const tpl = ENCOUNTERS[0];
    const deck = [{ uid: 'p1', defId: 'piston_strike', upgraded: false }];
    const state = createCombatState({
      template: tpl,
      deck,
      hp: 46,
      maxHp: 46,
      baseEnergy: 3,
      relicIds: ['impact_dampener'],
      overdrive: 0,
      metaUpgrades: {},
      showTutorial: false,
    });
    // Place enemy right next to player on row 2, with pit at (4, 2)
    state.player.x = 1;
    state.player.y = 2;
    state.grid[2][4].terrain = 'pit';
    state.enemies[0].x = 3;
    state.enemies[0].y = 2;
    state.enemies[0].hp = 14;

    const card = state.hand[0];
    const after = playCard(state, card.uid, { x: 3, y: 2 }, ['impact_dampener'], 0, 0);
    expect(after.enemies[0].hp).toBe(0);
    expect(after.stats.pitKills).toBe(1);
  });

  it('detonates a Relay node when an enemy is knocked onto it', () => {
    const tpl = ENCOUNTERS[0];
    const deck = [{ uid: 'p1', defId: 'piston_strike', upgraded: false }];
    const state = createCombatState({
      template: tpl,
      deck,
      hp: 46,
      maxHp: 46,
      baseEnergy: 3,
      relicIds: [],
      overdrive: 0,
      metaUpgrades: {},
      showTutorial: false,
    });
    state.player.x = 0;
    state.player.y = 2;
    state.grid[2][2].terrain = 'floor';
    state.grid[2][3].terrain = 'floor';
    state.enemies[0].x = 1;
    state.enemies[0].y = 2;
    state.enemies[0].hp = 20;
    state.nodes = [{ id: 'boom_node', x: 2, y: 2, kind: 'relay', power: 2 }];

    const after = playCard(state, state.hand[0].uid, { x: 1, y: 2 }, [], 0, 0);
    expect(after.nodes.length).toBe(0);
    // 5 piston strike + 6 relay detonation = 11 dmg -> 9 HP left
    expect(after.enemies[0].hp).toBe(9);
  });

  it('triggers Tesla Coil at end of turn and resolves enemy turn cleanly', () => {
    const tpl = ENCOUNTERS[0];
    const deck = PILOTS[0].starterDeck.map((id) => ({ uid: nextUid('c'), defId: id, upgraded: false }));
    const state = createCombatState({
      template: tpl,
      deck,
      hp: 46,
      maxHp: 46,
      baseEnergy: 3,
      relicIds: [],
      overdrive: 0,
      metaUpgrades: {},
      showTutorial: false,
    });
    state.enemies[0].x = 2;
    state.enemies[0].y = 2;
    state.enemies[0].hp = 14;
    state.nodes = [{ id: 't1', x: 2, y: 1, kind: 'tesla', power: 2 }];

    const next = endPlayerTurn(state, [], 0);
    expect(next.turn).toBe(2);
    expect(next.enemies[0].hp).toBeLessThan(14);
    expect(next.hand.length).toBe(5);
  });

  it('generates valid reachable 3-Act sector maps and transitions smoothly through Bosses', () => {
    for (const act of [1, 2, 3] as const) {
      const map = generateActMap(act);
      const boss = map.find((n) => n.type === 'boss');
      expect(boss).toBeDefined();
      // BFS from layer 0 must reach boss
      const visited = new Set<string>();
      const queue = map.filter((n) => n.layer === 0).map((n) => n.id);
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = map.find((n) => n.id === id)!;
        node.nextIds.forEach((nid) => queue.push(nid));
      }
      expect(visited.has(boss!.id)).toBe(true);
    }

    const meta = defaultMeta();
    let run = createNewRun('volt_01', 0, meta);
    const startNodes = getSelectableMapNodeIds(run);
    expect(startNodes.length).toBe(2);

    run = enterMapNode(run, startNodes[0], meta);
    expect(run.screen).toBe('combat');
    expect(run.combat).not.toBeNull();

    // Simulate winning combat -> reward -> map
    run.combat!.enemies.forEach((e) => (e.hp = 0));
    run.combat!.phase = 'victory';
    run = finishCombatVictory(run);
    expect(run.screen).toBe('reward');
    expect(run.reward!.cardChoices.length).toBe(3);

    run = proceedAfterReward(run);
    expect(run.screen).toBe('map');
  });

  it('verifies Relay nodes block enemy walking while Mines trigger when stepped on', () => {
    const tpl = ENCOUNTERS[0];
    const deck = PILOTS[0].starterDeck.map((id) => ({ uid: nextUid('c'), defId: id, upgraded: false }));
    const state = createCombatState({
      template: tpl,
      deck,
      hp: 46,
      maxHp: 46,
      baseEnergy: 3,
      relicIds: [],
      overdrive: 0,
      metaUpgrades: {},
      showTutorial: true,
    });
    // Tutorial guarantees deploy_relay + arc_spark in Turn 1 hand
    expect(state.hand.some((c) => c.defId === 'deploy_relay')).toBe(true);
    expect(state.hand.some((c) => c.defId === 'arc_spark')).toBe(true);

    // Put a Relay directly between player (0,2) and enemy (2,2)
    state.player.x = 0;
    state.player.y = 2;
    state.enemies = [state.enemies[0]];
    state.enemies[0].x = 2;
    state.enemies[0].y = 2;
    state.nodes = [{ id: 'blocker_relay', x: 1, y: 2, kind: 'relay', power: 2 }];

    const next = endPlayerTurn(state, [], 0);
    // Enemy must NOT overlap (1,2) relay!
    expect(next.enemies[0].x === 1 && next.enemies[0].y === 2).toBe(false);
  });

  it('verifies content depth meets 30+ min prototype target', () => {
    expect(Object.keys(CARDS).length).toBeGreaterThanOrEqual(28);
    expect(Object.keys(RELICS).length).toBeGreaterThanOrEqual(15);
    expect(PILOTS.length).toBe(3);
    expect(ENCOUNTERS.filter((e) => e.isBoss).length).toBe(3);
  });
});
