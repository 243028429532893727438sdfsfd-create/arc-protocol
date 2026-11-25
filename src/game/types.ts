export const GRID_SIZE = 5;

export type Lang = 'ru' | 'en';

export interface Pos {
  x: number;
  y: number;
}

export type TerrainType = 'floor' | 'pit' | 'vent' | 'pillar' | 'charger';

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  pillarHp?: number;
}

export type NodeKind = 'relay' | 'tesla' | 'mine';

export interface RelayNode {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
  power: number; // extra arc damage bonus
  charges?: number;
}

export type CardArchetype = 'arc' | 'kinetic' | 'defense' | 'overclock';
export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare';
export type CardTargetType =
  | 'none'          // immediate play (click card or click arena)
  | 'move_tile'     // valid empty walkable tile within range
  | 'empty_tile'    // place node / summon on empty floor/charger/vent
  | 'enemy'         // any enemy within range
  | 'any_tile'      // any tile within range (AoE / pulse / arc origin)
  | 'cardinal_dir'; // tile in straight row/col from player (ray / dash / push)

export interface CardEffectSpec {
  damage?: number;
  arcChainBonus?: number; // extra dmg per connected node in arc circuit
  triggersArc?: boolean;
  arcFromPlayer?: boolean;
  placeNode?: NodeKind;
  nodePower?: number;
  push?: number; // push away from player (or away from target center if AoE)
  pull?: number; // pull toward player / center
  aoeRadius?: number; // Manhattan radius around target (0 = single tile, 1 = cross)
  lineAttack?: boolean; // hits all enemies in chosen cardinal direction
  dashToTarget?: boolean; // player moves along line / to tile
  teleport?: boolean;
  shield?: number;
  heal?: number;
  draw?: number;
  energyGain?: number;
  vulnerable?: number; // +50% incoming dmg turns
  weak?: number; // -25% outgoing dmg turns
  stun?: boolean;
  consumeNodes?: boolean; // detonate all connected nodes for massive damage
  exhaust?: boolean;
  freeIfNodeExists?: boolean;
  bonusShieldPerNode?: number;
  doubleNextCard?: boolean;
  spawnRandomRelay?: number;
  range?: number; // max Manhattan distance from player (99 = global)
}

export interface CardDef {
  id: string;
  archetype: CardArchetype;
  rarity: CardRarity;
  cost: number;
  upgradedCost?: number;
  target: CardTargetType;
  icon: string;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  upgradedDescRu: string;
  upgradedDescEn: string;
  effect: CardEffectSpec;
  upgradedEffect: CardEffectSpec;
}

export interface CardInstance {
  uid: string;
  defId: string;
  upgraded: boolean;
}

export interface RelicDef {
  id: string;
  rarity: 'starter' | 'common' | 'rare' | 'boss';
  icon: string;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
}

export interface PilotDef {
  id: string;
  icon: string;
  accent: string;
  nameRu: string;
  nameEn: string;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  maxHp: number;
  baseEnergy: number;
  starterRelicId: string;
  starterDeck: string[];
  unlockCost: number; // 0 = unlocked from start
}

export type EnemyIntentKind = 'melee' | 'ranged_line' | 'aoe_mortar' | 'buff_shield' | 'summon' | 'pull_blast' | 'boss_sweep' | 'boss_prism' | 'boss_gravity';

export interface EnemyIntent {
  kind: EnemyIntentKind;
  damage: number;
  shield?: number;
  targetTiles: Pos[]; // exact red danger tiles telegraphed to player
  dir?: Pos;
  labelRu: string;
  labelEn: string;
}

export interface EnemyUnit {
  id: string;
  defId: string;
  nameRu: string;
  nameEn: string;
  icon: string;
  isElite?: boolean;
  isBoss?: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  vulnerable: number;
  weak: number;
  stunned: boolean;
  intent: EnemyIntent;
  phase?: number;
  turnCount: number;
  color: string;
}

export interface EnemyDef {
  id: string;
  nameRu: string;
  nameEn: string;
  icon: string;
  color: string;
  maxHp: number;
  moveRange: number;
  isElite?: boolean;
  isBoss?: boolean;
  act: 1 | 2 | 3;
  descRu: string;
  descEn: string;
}

export interface VfxEvent {
  id: string;
  kind: 'arc' | 'slash' | 'explosion' | 'slam' | 'shield' | 'heal' | 'float_text' | 'pit_kill' | 'move_trail' | 'boss_wave';
  from?: Pos;
  to?: Pos;
  pos?: Pos;
  text?: string;
  color: string;
  createdAt: number;
  duration: number;
}

export interface PlayerCombatState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  energy: number;
  maxEnergy: number;
  doubleNext: boolean;
  freeNodeUsed: boolean;
  firstCardPlayed: boolean;
  moveFreeUsed: boolean;
  overclockBonus: number;
}

export interface CombatStats {
  turns: number;
  maxChain: number;
  slams: number;
  pitKills: number;
  enemiesKilled: number;
  damageDealt: number;
  cardsPlayed: number;
}

export interface CombatState {
  encounterId: string;
  encounterTitleRu: string;
  encounterTitleEn: string;
  act: 1 | 2 | 3;
  isElite: boolean;
  isBoss: boolean;
  grid: Tile[][];
  nodes: RelayNode[];
  player: PlayerCombatState;
  enemies: EnemyUnit[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  turn: number;
  phase: 'player' | 'enemy' | 'victory' | 'defeat';
  log: string[];
  vfx: VfxEvent[];
  stats: CombatStats;
  tutorialStep: number; // 0 = off/done, 1..3 = interactive first-battle hints
}

export interface ActionPreview {
  valid: boolean;
  reasonRu?: string;
  reasonEn?: string;
  affectedTiles: Pos[];
  arcLinks: Array<{ from: Pos; to: Pos }>;
  chainCount: number;
  damageByEnemyId: Record<
    string,
    { total: number; slam: number; pitKill: boolean; arcBonus: number }
  >;
  knockbacks: Array<{
    enemyId: string;
    from: Pos;
    to: Pos;
    slammed: boolean;
    pitKill: boolean;
    detonatedNode: boolean;
  }>;
  moveDest?: Pos;
  nodePlacement?: Pos;
  summaryRu: string;
  summaryEn: string;
}

export type MapNodeType = 'combat' | 'elite' | 'workshop' | 'event' | 'shop' | 'boss';

export interface MapNode {
  id: string;
  act: 1 | 2 | 3;
  layer: number; // 0..5 (5 = boss)
  col: number; // 0..2
  type: MapNodeType;
  nextIds: string[];
  visited: boolean;
}

export interface ShopItem {
  id: string;
  kind: 'card' | 'relic' | 'heal' | 'purge';
  defId?: string;
  price: number;
  sold: boolean;
}

export interface NarrativeChoice {
  id: string;
  labelRu: string;
  labelEn: string;
  hintRu: string;
  hintEn: string;
}

export interface NarrativeEventDef {
  id: string;
  icon: string;
  titleRu: string;
  titleEn: string;
  bodyRu: string;
  bodyEn: string;
  choices: NarrativeChoice[];
}

export interface RewardState {
  scrap: number;
  shards: number;
  cardChoices: CardDef[];
  cardPicked: boolean;
  relicChoices?: RelicDef[];
  relicPicked?: boolean;
  isBoss: boolean;
}

export type ScreenMode =
  | 'title'
  | 'map'
  | 'combat'
  | 'reward'
  | 'workshop'
  | 'shop'
  | 'event'
  | 'summary'
  | 'lab'
  | 'codex';

export interface RunStats {
  combatsWon: number;
  elitesWon: number;
  bossesWon: number;
  maxChain: number;
  totalSlams: number;
  totalPitKills: number;
  totalEnemiesKilled: number;
  totalTurns: number;
  startedAt: number;
}

export interface RunState {
  pilotId: string;
  overdrive: number; // 0..3 ascension
  act: 1 | 2 | 3;
  hp: number;
  maxHp: number;
  scrap: number;
  deck: CardInstance[];
  relicIds: string[];
  map: MapNode[];
  currentNodeId: string | null;
  screen: ScreenMode;
  combat: CombatState | null;
  reward: RewardState | null;
  shopItems: ShopItem[] | null;
  activeEventId: string | null;
  eventOutcomeText: string | null;
  workshopUsed: boolean;
  usedEventIds: string[];
  victory: boolean | null;
  stats: RunStats;
}

export interface MetaUpgradeDef {
  id: string;
  icon: string;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  maxLevel: number;
  costs: number[];
}

export interface MetaProgress {
  shards: number;
  totalRuns: number;
  totalWins: number;
  bestChain: number;
  maxOverdriveUnlocked: number;
  unlockedPilots: string[];
  upgrades: Record<string, number>;
  tutorialCompleted: boolean;
  reviewerAllUnlocked: boolean;
}
