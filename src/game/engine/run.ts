import { CARDS, REWARD_POOL_IDS } from '../data/cards';
import { EVENTS } from '../data/events';
import { META_UPGRADES, PILOTS } from '../data/pilots';
import { BOSS_RELIC_IDS, DROPPABLE_RELIC_IDS, RELICS } from '../data/relics';
import {
  CardDef,
  CardInstance,
  MapNode,
  MapNodeType,
  MetaProgress,
  RelicDef,
  RunState,
  ShopItem,
} from '../types';
import { createCombatState, nextUid, pickEncounterForNode, shuffle } from './combat';

const META_KEY = 'arc_protocol_meta_v1';
const SAVE_KEY = 'arc_protocol_run_v1';

export function defaultMeta(): MetaProgress {
  return {
    shards: 0,
    totalRuns: 0,
    totalWins: 0,
    bestChain: 0,
    maxOverdriveUnlocked: 0,
    unlockedPilots: ['volt_01'],
    upgrades: {},
    tutorialCompleted: false,
    reviewerAllUnlocked: false,
  };
}

export function loadMeta(): MetaProgress {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    return { ...defaultMeta(), ...JSON.parse(raw) };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaProgress): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore quota errors
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveRun(run: RunState | null): void {
  try {
    if (!run) {
      localStorage.removeItem(SAVE_KEY);
    } else {
      localStorage.setItem(SAVE_KEY, JSON.stringify(run));
    }
  } catch {
    // ignore
  }
}

export function generateActMap(act: 1 | 2 | 3): MapNode[] {
  // 6 layers:
  // 0: 2 combat starts
  // 1: 3 nodes (combat / event / combat)
  // 2: 3 nodes (elite / workshop / shop)
  // 3: 3 nodes (combat / event / elite)
  // 4: 2 nodes (workshop / shop)
  // 5: 1 Boss node
  const layers: MapNodeType[][] = [
    ['combat', 'combat'],
    shuffle<MapNodeType>(['combat', 'event', 'combat']),
    shuffle<MapNodeType>(['elite', 'workshop', 'shop']),
    shuffle<MapNodeType>(['combat', 'event', 'elite']),
    ['workshop', 'shop'],
    ['boss'],
  ];

  const nodes: MapNode[] = [];
  const byLayer: MapNode[][] = [];

  layers.forEach((rowTypes, layerIdx) => {
    const row: MapNode[] = rowTypes.map((type, colIdx) => {
      const node: MapNode = {
        id: `a${act}_l${layerIdx}_c${colIdx}`,
        act,
        layer: layerIdx,
        col: colIdx,
        type,
        nextIds: [],
        visited: false,
      };
      nodes.push(node);
      return node;
    });
    byLayer.push(row);
  });

  // Connect layers cleanly so every node has at least 1 forward path and every target is reachable
  for (let l = 0; l < byLayer.length - 1; l++) {
    const curr = byLayer[l];
    const next = byLayer[l + 1];
    curr.forEach((n, idx) => {
      if (next.length === 1) {
        n.nextIds.push(next[0].id);
      } else if (curr.length === next.length) {
        n.nextIds.push(next[idx].id);
        const neighbor = idx === 0 ? 1 : idx === curr.length - 1 ? idx - 1 : idx + (l % 2 === 0 ? 1 : -1);
        if (next[neighbor] && !n.nextIds.includes(next[neighbor].id)) {
          n.nextIds.push(next[neighbor].id);
        }
      } else if (curr.length < next.length) {
        // 2 -> 3
        n.nextIds.push(next[idx].id);
        n.nextIds.push(next[idx + 1].id);
      } else {
        // 3 -> 2
        if (idx === 0) n.nextIds.push(next[0].id);
        else if (idx === 2) n.nextIds.push(next[1].id);
        else {
          n.nextIds.push(next[0].id);
          n.nextIds.push(next[1].id);
        }
      }
    });
  }

  return nodes;
}

export function createNewRun(pilotId: string, overdrive: number, meta: MetaProgress): RunState {
  const pilot = PILOTS.find((p) => p.id === pilotId) ?? PILOTS[0];
  const bonusHp = (meta.upgrades.hull_plating ?? 0) * 5;
  const bonusScrap = (meta.upgrades.starting_credits ?? 0) * 25;
  const maxHp = pilot.maxHp + bonusHp;

  const deck: CardInstance[] = pilot.starterDeck.map((defId) => ({
    uid: nextUid('card'),
    defId,
    upgraded: false,
  }));

  return {
    pilotId: pilot.id,
    overdrive,
    act: 1,
    hp: maxHp,
    maxHp,
    scrap: 55 + bonusScrap,
    deck,
    relicIds: [pilot.starterRelicId],
    map: generateActMap(1),
    currentNodeId: null,
    screen: 'map',
    combat: null,
    reward: null,
    shopItems: null,
    activeEventId: null,
    eventOutcomeText: null,
    workshopUsed: false,
    usedEventIds: [],
    victory: null,
    stats: {
      combatsWon: 0,
      elitesWon: 0,
      bossesWon: 0,
      maxChain: 0,
      totalSlams: 0,
      totalPitKills: 0,
      totalEnemiesKilled: 0,
      totalTurns: 0,
      startedAt: Date.now(),
    },
  };
}

export function getSelectableMapNodeIds(run: RunState): string[] {
  if (!run.currentNodeId) {
    return run.map.filter((n) => n.layer === 0).map((n) => n.id);
  }
  const curr = run.map.find((n) => n.id === run.currentNodeId);
  return curr ? curr.nextIds : [];
}

function rollCardChoices(count: number, isEliteOrBoss: boolean): CardDef[] {
  const pool = shuffle(REWARD_POOL_IDS).map((id) => CARDS[id]);
  const weighted = isEliteOrBoss
    ? [...pool.filter((c) => c.rarity === 'rare' || c.rarity === 'uncommon'), ...pool]
    : pool;
  const seen = new Set<string>();
  const picked: CardDef[] = [];
  for (const c of weighted) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      picked.push(c);
      if (picked.length === count) break;
    }
  }
  return picked;
}

function rollRelicChoices(owned: string[], bossPool: boolean, count = 1): RelicDef[] {
  const source = bossPool ? BOSS_RELIC_IDS : DROPPABLE_RELIC_IDS;
  const avail = shuffle(source.filter((id) => !owned.includes(id)));
  return avail.slice(0, count).map((id) => RELICS[id]);
}

function generateShopItems(run: RunState): ShopItem[] {
  const discount = run.relicIds.includes('scrap_magnet') ? 0.8 : 1;
  const p = (v: number) => Math.round(v * discount);
  const cards = rollCardChoices(4, true);
  const relics = rollRelicChoices(run.relicIds, false, 2);
  const items: ShopItem[] = [
    ...cards.map((c) => ({
      id: nextUid('shop'),
      kind: 'card' as const,
      defId: c.id,
      price: p(c.rarity === 'rare' ? 85 : c.rarity === 'uncommon' ? 60 : 40),
      sold: false,
    })),
    ...relics.map((r) => ({
      id: nextUid('shop'),
      kind: 'relic' as const,
      defId: r.id,
      price: p(r.rarity === 'rare' ? 120 : 85),
      sold: false,
    })),
    { id: nextUid('shop'), kind: 'heal', price: p(35), sold: false },
    { id: nextUid('shop'), kind: 'purge', price: p(45), sold: false },
  ];
  return items;
}

export function enterMapNode(run: RunState, nodeId: string, meta: MetaProgress): RunState {
  const selectable = getSelectableMapNodeIds(run);
  if (!selectable.includes(nodeId)) return run;

  const next: RunState = structuredClone(run);
  const node = next.map.find((n) => n.id === nodeId);
  if (!node) return run;

  node.visited = true;
  next.currentNodeId = nodeId;
  next.workshopUsed = false;
  next.eventOutcomeText = null;

  const pilot = PILOTS.find((p) => p.id === next.pilotId) ?? PILOTS[0];

  if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
    const template = pickEncounterForNode(
      next.act,
      node.type === 'elite',
      node.type === 'boss',
      []
    );
    const isFirstEverFight =
      !meta.tutorialCompleted && next.act === 1 && next.stats.combatsWon === 0 && node.layer === 0;
    next.combat = createCombatState({
      template,
      deck: next.deck,
      hp: next.hp,
      maxHp: next.maxHp,
      baseEnergy: pilot.baseEnergy,
      relicIds: next.relicIds,
      overdrive: next.overdrive,
      metaUpgrades: meta.upgrades,
      showTutorial: isFirstEverFight,
    });
    next.screen = 'combat';
  } else if (node.type === 'workshop') {
    next.screen = 'workshop';
  } else if (node.type === 'shop') {
    next.shopItems = generateShopItems(next);
    next.screen = 'shop';
  } else if (node.type === 'event') {
    const avail = EVENTS.filter((e) => !next.usedEventIds.includes(e.id));
    const pool = avail.length > 0 ? avail : EVENTS;
    const ev = pool[Math.floor(Math.random() * pool.length)];
    next.activeEventId = ev.id;
    next.usedEventIds.push(ev.id);
    next.screen = 'event';
  }

  return next;
}

export function finishCombatVictory(run: RunState): RunState {
  if (!run.combat) return run;
  const next: RunState = structuredClone(run);
  const c = next.combat!;

  next.hp = Math.min(next.maxHp, c.player.hp + (next.relicIds.includes('nano_salvager') ? 5 : 0));
  next.stats.combatsWon += 1;
  if (c.isElite) next.stats.elitesWon += 1;
  if (c.isBoss) next.stats.bossesWon += 1;
  next.stats.maxChain = Math.max(next.stats.maxChain, c.stats.maxChain);
  next.stats.totalSlams += c.stats.slams;
  next.stats.totalPitKills += c.stats.pitKills;
  next.stats.totalEnemiesKilled += c.stats.enemiesKilled;
  next.stats.totalTurns += c.stats.turns;

  const baseScrap = c.isBoss ? 85 : c.isElite ? 55 : 32 + next.act * 8;
  const scrapMult = next.relicIds.includes('scrap_magnet') ? 1.35 : 1;
  const scrap = Math.round(baseScrap * scrapMult) + (next.relicIds.includes('nano_salvager') ? 12 : 0);
  const shards = c.isBoss ? 18 + next.act * 6 : c.isElite ? 10 : 4;

  next.scrap += scrap;

  // Final Boss defeated => Victory!
  if (c.isBoss && next.act === 3) {
    next.victory = true;
    next.combat = null;
    next.screen = 'summary';
    return next;
  }

  const relicChoices = c.isBoss
    ? rollRelicChoices(next.relicIds, true, 3)
    : c.isElite
    ? rollRelicChoices(next.relicIds, false, 1)
    : undefined;

  next.reward = {
    scrap,
    shards,
    cardChoices: rollCardChoices(3, c.isElite || c.isBoss),
    cardPicked: false,
    relicChoices,
    relicPicked: !relicChoices || relicChoices.length === 0,
    isBoss: c.isBoss,
  };
  next.combat = null;
  next.screen = 'reward';
  return next;
}

export function proceedAfterReward(run: RunState): RunState {
  const next: RunState = structuredClone(run);
  const wasBoss = next.reward?.isBoss ?? false;
  next.reward = null;

  if (wasBoss && next.act < 3) {
    next.act = (next.act + 1) as 1 | 2 | 3;
    // Heal 35% between acts
    next.hp = Math.min(next.maxHp, next.hp + Math.round(next.maxHp * 0.35));
    next.map = generateActMap(next.act);
    next.currentNodeId = null;
  }
  next.screen = 'map';
  return next;
}

export function resolveEventChoice(
  run: RunState,
  choiceId: string
): { run: RunState; bonusShards: number } {
  const next: RunState = structuredClone(run);
  let bonusShards = 0;

  const upgradeRandomCards = (count: number): string[] => {
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const avail = next.deck.filter((c) => !c.upgraded);
      if (avail.length === 0) break;
      const pick = avail[Math.floor(Math.random() * avail.length)];
      pick.upgraded = true;
      names.push(CARDS[pick.defId].nameRu + '+');
    }
    return names;
  };

  switch (choiceId) {
    case 'overcharge_upgrade': {
      next.hp = Math.max(1, next.hp - 6);
      const up = upgradeRandomCards(2);
      next.eventOutcomeText = `⚡ Вы потеряли 6 HP, но улучшили: ${up.join(', ') || 'все карты уже улучшены'}!`;
      break;
    }
    case 'salvage_scrap':
      next.scrap += 45;
      next.hp = Math.min(next.maxHp, next.hp + 4);
      next.eventOutcomeText = '💰 Вы аккуратно разобрали обшивку: +45 Кредитов и +4 HP.';
      break;
    case 'trade_hp_relic': {
      next.hp = Math.max(1, next.hp - 9);
      const rel = rollRelicChoices(next.relicIds, false, 1)[0];
      if (rel) {
        next.relicIds.push(rel.id);
        next.eventOutcomeText = `🎁 Вы отдали 9 HP и получили модуль «${rel.nameRu}»!`;
      } else {
        next.scrap += 70;
        next.eventOutcomeText = '💰 Все модули уже собраны — дрон выплатил +70 Кредитов.';
      }
      break;
    }
    case 'trade_scrap_rare': {
      if (next.scrap >= 35) {
        next.scrap -= 35;
        const rares = shuffle(Object.values(CARDS).filter((c) => c.rarity === 'rare'));
        const card = rares[0];
        next.deck.push({ uid: nextUid('card'), defId: card.id, upgraded: true });
        next.eventOutcomeText = `✨ Вы купили редкую карту «${card.nameRu}+»!`;
      } else {
        next.eventOutcomeText = 'Недостаточно кредитов (нужно 35). Вы продолжили путь.';
      }
      break;
    }
    case 'decline_repair':
      next.hp = Math.min(next.maxHp, next.hp + 8);
      next.eventOutcomeText = '💚 Вы спокойно восстановили +8 HP и двинулись дальше.';
      break;
    case 'purge_starter': {
      const idx = next.deck.findIndex((c) => CARDS[c.defId].rarity === 'starter');
      if (idx >= 0) {
        const removed = CARDS[next.deck[idx].defId].nameRu;
        next.deck.splice(idx, 1);
        next.eventOutcomeText = `❄️ Стартовая карта «${removed}» удалена из колоды.`;
      } else {
        next.scrap += 35;
        next.eventOutcomeText = 'Стартовых карт не осталось — получено +35 Кредитов.';
      }
      break;
    }
    case 'boost_max_hp':
      next.maxHp += 8;
      next.hp += 8;
      next.eventOutcomeText = '🛡️ Корпус Ядра усилен: +8 к максимальному HP и +8 HP!';
      break;
    case 'crack_box': {
      if (Math.random() < 0.7) {
        const rel = rollRelicChoices(next.relicIds, false, 1)[0];
        next.scrap += 30;
        if (rel) {
          next.relicIds.push(rel.id);
          next.eventOutcomeText = `🎉 Удача! Внутри оказался модуль «${rel.nameRu}» и +30 Кредитов!`;
        } else {
          next.scrap += 40;
          next.eventOutcomeText = '🎉 Удача! Внутри оказалось +70 Кредитов!';
        }
      } else {
        next.hp = Math.max(1, next.hp - 8);
        next.scrap += 25;
        next.eventOutcomeText = '⚡ Разряд конденсатора (-8 HP), но вы успели забрать +25 Кредитов.';
      }
      break;
    }
    case 'scan_shards':
      bonusShards = 10;
      next.scrap += 25;
      next.eventOutcomeText = '💎 Телеметрия собрана: +10 Кристаллов Данных и +25 Кредитов.';
      break;
    case 'extract_kinetic': {
      next.hp = Math.max(1, next.hp - 5);
      const id = Math.random() < 0.5 ? 'magnetic_vortex' : 'meteor_slam';
      next.deck.push({ uid: nextUid('card'), defId: id, upgraded: true });
      next.eventOutcomeText = `🌀 Ценой 5 HP вы извлекли «${CARDS[id].nameRu}+»!`;
      break;
    }
    case 'bypass_safe':
      next.scrap += 30;
      next.hp = Math.min(next.maxHp, next.hp + 5);
      next.eventOutcomeText = 'Вы безопасно обошли аномалию: +30 Кредитов и +5 HP.';
      break;
    case 'full_patch': {
      const heal = Math.round(next.maxHp * 0.4);
      next.hp = Math.min(next.maxHp, next.hp + heal);
      next.eventOutcomeText = `💚 Аварийный док восстановил +${heal} HP!`;
      break;
    }
    case 'upgrade_one': {
      const up = upgradeRandomCards(1);
      next.scrap += 20;
      next.eventOutcomeText = `⚙️ Улучшена карта ${up[0] ?? '—'} и получено +20 Кредитов.`;
      break;
    }
    case 'take_short_circuit':
      next.deck.push({ uid: nextUid('card'), defId: 'short_circuit', upgraded: false });
      next.eventOutcomeText = '💥 В колоду добавлена редкая карта «Короткое Замыкание»!';
      break;
    case 'take_quantum':
      next.deck.push({ uid: nextUid('card'), defId: 'quantum_echo', upgraded: false });
      next.eventOutcomeText = '🪞 В колоду добавлена редкая карта «Квантовый Дубль»!';
      break;
    case 'pay_upgrade_two': {
      if (next.scrap >= 40) {
        next.scrap -= 40;
        const up = upgradeRandomCards(2);
        next.eventOutcomeText = `⚙️ Двойной апгрейд выполнен: ${up.join(', ') || 'готово'}!`;
      } else {
        next.eventOutcomeText = 'Недостаточно кредитов (нужно 40).';
      }
      break;
    }
    case 'take_bounty':
      next.scrap += 55;
      next.eventOutcomeText = '💰 Ключи доступа выкуплены: +55 Кредитов!';
      break;
  }

  return { run: next, bonusShards };
}

export function buyMetaUpgrade(meta: MetaProgress, upgradeId: string): MetaProgress {
  const def = META_UPGRADES.find((u) => u.id === upgradeId);
  if (!def) return meta;
  const lvl = meta.upgrades[upgradeId] ?? 0;
  if (lvl >= def.maxLevel) return meta;
  const cost = def.costs[lvl];
  if (meta.shards < cost) return meta;
  return {
    ...meta,
    shards: meta.shards - cost,
    upgrades: { ...meta.upgrades, [upgradeId]: lvl + 1 },
  };
}

export function unlockPilot(meta: MetaProgress, pilotId: string): MetaProgress {
  const pilot = PILOTS.find((p) => p.id === pilotId);
  if (!pilot || meta.unlockedPilots.includes(pilotId)) return meta;
  if (meta.shards < pilot.unlockCost) return meta;
  return {
    ...meta,
    shards: meta.shards - pilot.unlockCost,
    unlockedPilots: [...meta.unlockedPilots, pilotId],
  };
}
