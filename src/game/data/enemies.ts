import { EnemyDef, TerrainType } from '../types';

export const ENEMIES: Record<string, EnemyDef> = {
  // === ACT 1 ENEMIES ===
  ram_drone: {
    id: 'ram_drone',
    nameRu: 'Таран-Дрон',
    nameEn: 'Ram Drone',
    icon: '🤖',
    color: '#fb7185',
    maxHp: 14,
    moveRange: 2,
    act: 1,
    descRu: 'Сближается и бьёт вплотную на 6 урона.',
    descEn: 'Closes in and strikes adjacent Core for 6 dmg.',
  },
  laser_sniper: {
    id: 'laser_sniper',
    nameRu: 'Лазер-Снайпер',
    nameEn: 'Laser Sniper',
    icon: '🎯',
    color: '#f43f5e',
    maxHp: 11,
    moveRange: 1,
    act: 1,
    descRu: 'Выходит на линию и стреляет пробивным лучом (7 урона). Легко сбить толчком!',
    descEn: 'Aligns on a row/col and fires a piercing beam (7 dmg). Easy to displace!',
  },
  shield_bearer: {
    id: 'shield_bearer',
    nameRu: 'Щитоносец',
    nameEn: 'Aegis Guard',
    icon: '🛡',
    color: '#60a5fa',
    maxHp: 18,
    moveRange: 1,
    act: 1,
    descRu: 'Усиливает щитом себя и союзников, затем наносит удар (5 урона).',
    descEn: 'Shields itself and allies, then strikes for 5 dmg.',
  },
  mortar_bot: {
    id: 'mortar_bot',
    nameRu: 'Миномётчик',
    nameEn: 'Mortar Bot',
    icon: '💣',
    color: '#fb923c',
    maxHp: 13,
    moveRange: 1,
    act: 1,
    descRu: 'Телеграфирует удар крестом по клетке Ядра (6 урона). Уходите из зоны!',
    descEn: 'Telegraphs a cross-shaped blast on Core tile (6 dmg). Step out of danger!',
  },
  swarm_spark: {
    id: 'swarm_spark',
    nameRu: 'Искра-Рой',
    nameEn: 'Swarm Spark',
    icon: '🐝',
    color: '#facc15',
    maxHp: 9,
    moveRange: 3,
    act: 1,
    descRu: 'Быстрый и хрупкий дрон (5 урона). Идеальная цель для цепной Дуги.',
    descEn: 'Fast, fragile drone (5 dmg). Prime target for Chain Arcs.',
  },

  // === ACT 1 ELITE ===
  elite_warden: {
    id: 'elite_warden',
    nameRu: 'Страж Контура',
    nameEn: 'Circuit Warden',
    icon: '👹',
    color: '#e11d48',
    maxHp: 32,
    moveRange: 1,
    isElite: true,
    act: 1,
    descRu: 'ЭЛИТА: чередует мощный удар по площади (9) с призывом Искры и щитом.',
    descEn: 'ELITE: alternates heavy AoE blast (9) with summoning a Spark & shielding.',
  },

  // === ACT 2 ENEMIES ===
  pyro_bomber: {
    id: 'pyro_bomber',
    nameRu: 'Пиро-Бомбардир',
    nameEn: 'Pyro Bomber',
    icon: '🔥',
    color: '#f97316',
    maxHp: 21,
    moveRange: 1,
    act: 2,
    descRu: 'Накрывает крестом 9 урона. При гибели или толчке опасен рядом с люками.',
    descEn: 'Fires 9-dmg cross barrages across the thermal foundry.',
  },
  mag_puller: {
    id: 'mag_puller',
    nameRu: 'Магнитный Тягач',
    nameEn: 'Mag-Puller',
    icon: '🧲',
    color: '#c084fc',
    maxHp: 20,
    moveRange: 1,
    act: 2,
    descRu: 'Притягивает Ядро по прямой и наносит 8 урона — сбивайте его с линии!',
    descEn: 'Pulls your Core along its line and deals 8 dmg — displace it first!',
  },
  heavy_turret: {
    id: 'heavy_turret',
    nameRu: 'Тяжёлая Турель',
    nameEn: 'Heavy Turret',
    icon: '🗼',
    color: '#f43f5e',
    maxHp: 24,
    moveRange: 0,
    act: 2,
    descRu: 'Неподвижна, но стреляет по целой линии (10 урона). Можно сбросить в пропасть!',
    descEn: 'Immobile, fires a 10-dmg full-line laser. Knock it off its line or into a pit!',
  },
  berserk_blade: {
    id: 'berserk_blade',
    nameRu: 'Берсерк-Резак',
    nameEn: 'Saw Berserker',
    icon: '⚔️',
    color: '#ef4444',
    maxHp: 23,
    moveRange: 2,
    act: 2,
    descRu: 'Агрессивно бросается на Ядро (10 урона). Держите на дистанции!',
    descEn: 'Charges relentlessly at your Core for 10 melee dmg. Keep it pushed back!',
  },

  // === ACT 2 ELITE ===
  elite_furnace: {
    id: 'elite_furnace',
    nameRu: 'Плавильный Голем',
    nameEn: 'Furnace Golem',
    icon: '🌋',
    color: '#dc2626',
    maxHp: 46,
    moveRange: 1,
    isElite: true,
    act: 2,
    descRu: 'ЭЛИТА: огромный запас HP, щитуется и бьёт крестом на 11 урона.',
    descEn: 'ELITE: massive armor, shields up and slams a 11-dmg cross shockwave.',
  },

  // === ACT 3 ENEMIES ===
  void_reaper: {
    id: 'void_reaper',
    nameRu: 'Жнец Ядра',
    nameEn: 'Core Reaper',
    icon: '💀',
    color: '#ec4899',
    maxHp: 30,
    moveRange: 2,
    act: 3,
    descRu: 'Быстрый убийца Сектора III: 12 урона вплотную.',
    descEn: 'Fast Sector III hunter: 12 heavy melee dmg.',
  },
  prism_sentinel: {
    id: 'prism_sentinel',
    nameRu: 'Призма-Часовой',
    nameEn: 'Prism Sentinel',
    icon: '🔷',
    color: '#38bdf8',
    maxHp: 26,
    moveRange: 1,
    act: 3,
    descRu: 'Стреляет мощным лучом (11 урона) и вешает щит на отряд.',
    descEn: 'Fires an 11-dmg beam and reinforces ally shields.',
  },
  elite_architect: {
    id: 'elite_architect',
    nameRu: 'Архитектор Сбоя',
    nameEn: 'Fault Architect',
    icon: '👁',
    color: '#be123c',
    maxHp: 58,
    moveRange: 1,
    isElite: true,
    act: 3,
    descRu: 'ЭЛИТА: вызывает подкрепления и обрушивает 12 урона по широкой зоне.',
    descEn: 'ELITE: summons drones and blasts a wide 12-dmg danger zone.',
  },

  // === 3 ACT BOSSES ===
  boss_crusher: {
    id: 'boss_crusher',
    nameRu: 'БОСС: МОЛОТ-09',
    nameEn: 'BOSS: CRUSHER-09',
    icon: '🦾',
    color: '#f43f5e',
    maxHp: 56,
    moveRange: 1,
    isBoss: true,
    act: 1,
    descRu: 'Босс Сектора I: сметает целые ряды арены (10 урона), призывает дронов и уязвим к длинным Дугам и столкновениям.',
    descEn: 'Act I Boss: sweeps entire rows (10 dmg), summons drones, vulnerable to Arc Chains & slams.',
  },
  boss_prism: {
    id: 'boss_prism',
    nameRu: 'БОСС: МАТРИЦА ПРИЗМЫ',
    nameEn: 'BOSS: PRISM SOVEREIGN',
    icon: '🔮',
    color: '#a855f7',
    maxHp: 78,
    moveRange: 1,
    isBoss: true,
    act: 2,
    descRu: 'Босс Сектора II: бьёт перекрёстными лучами через всю арену (11 урона) и генерирует мощные барьеры.',
    descEn: 'Act II Boss: fires full-arena cross beams (11 dmg) and refreshes energy barriers.',
  },
  boss_singularity: {
    id: 'boss_singularity',
    nameRu: 'ФИНАЛ: СИНГУЛЯРНОСТЬ-Ω',
    nameEn: 'FINAL: SINGULARITY-Ω',
    icon: '🕳',
    color: '#ec4899',
    maxHp: 105,
    moveRange: 1,
    isBoss: true,
    act: 3,
    descRu: 'Финальный Босс: в 2-й фазе (<50% HP) усиливает перегрузку арены, призывает стражей и бьёт грави-волнами!',
    descEn: 'Final Boss: enters Phase 2 (<50% HP), supercharges grid danger zones & summons guardians!',
  },
};

export interface EncounterTemplate {
  id: string;
  act: 1 | 2 | 3;
  isElite?: boolean;
  isBoss?: boolean;
  titleRu: string;
  titleEn: string;
  enemies: Array<{ defId: string; x: number; y: number }>;
  /** 5x5 layout chars: '.' floor, 'P' pillar, 'O' pit, 'V' vent, 'C' charger */
  layout: string[];
}

export function parseTerrainChar(ch: string): TerrainType {
  switch (ch) {
    case 'P':
      return 'pillar';
    case 'O':
      return 'pit';
    case 'V':
      return 'vent';
    case 'C':
      return 'charger';
    default:
      return 'floor';
  }
}

export const ENCOUNTERS: EncounterTemplate[] = [
  // === ACT 1 COMBATS ===
  {
    id: 'a1_patrol',
    act: 1,
    titleRu: 'Внешний Патруль',
    titleEn: 'Outer Patrol',
    enemies: [
      { defId: 'ram_drone', x: 3, y: 1 },
      { defId: 'swarm_spark', x: 4, y: 3 },
    ],
    layout: ['.....', '..P..', '.C..O', '.....', '....P'],
  },
  {
    id: 'a1_crossfire',
    act: 1,
    titleRu: 'Перекрёстный Огонь',
    titleEn: 'Crossfire Sector',
    enemies: [
      { defId: 'laser_sniper', x: 4, y: 0 },
      { defId: 'ram_drone', x: 3, y: 3 },
      { defId: 'swarm_spark', x: 4, y: 4 },
    ],
    layout: ['...O.', '.P...', '..C..', '...P.', '..V..'],
  },
  {
    id: 'a1_artillery',
    act: 1,
    titleRu: 'Миномётный Узел',
    titleEn: 'Mortar Relay',
    enemies: [
      { defId: 'mortar_bot', x: 4, y: 2 },
      { defId: 'shield_bearer', x: 3, y: 1 },
    ],
    layout: ['..O..', '.....', '.C.P.', '....V', '..O..'],
  },
  {
    id: 'a1_swarm',
    act: 1,
    titleRu: 'Рой Сборщиков',
    titleEn: 'Collector Swarm',
    enemies: [
      { defId: 'swarm_spark', x: 3, y: 0 },
      { defId: 'swarm_spark', x: 4, y: 2 },
      { defId: 'laser_sniper', x: 4, y: 4 },
    ],
    layout: ['....O', '..P..', '.C.V.', '..P..', '.....'],
  },
  {
    id: 'a1_elite',
    act: 1,
    isElite: true,
    titleRu: 'ЭЛИТА: Страж Контура',
    titleEn: 'ELITE: Circuit Warden',
    enemies: [
      { defId: 'elite_warden', x: 4, y: 2 },
      { defId: 'laser_sniper', x: 3, y: 0 },
    ],
    layout: ['...O.', '.P...', '..C..', '.P..V', '...O.'],
  },
  {
    id: 'a1_boss',
    act: 1,
    isBoss: true,
    titleRu: 'БОСС СЕКТОРА I: МОЛОТ-09',
    titleEn: 'SECTOR I BOSS: CRUSHER-09',
    enemies: [
      { defId: 'boss_crusher', x: 4, y: 2 },
      { defId: 'swarm_spark', x: 3, y: 4 },
    ],
    layout: ['..P..', '...O.', '.C...', '...V.', '..P..'],
  },

  // === ACT 2 COMBATS ===
  {
    id: 'a2_foundry',
    act: 2,
    titleRu: 'Термальный Цех',
    titleEn: 'Thermal Foundry',
    enemies: [
      { defId: 'pyro_bomber', x: 4, y: 1 },
      { defId: 'berserk_blade', x: 3, y: 3 },
    ],
    layout: ['..V..', '.P..O', '..C..', '.V.P.', '.....'],
  },
  {
    id: 'a2_magnet',
    act: 2,
    titleRu: 'Магнитный Конвейер',
    titleEn: 'Magnetic Conveyor',
    enemies: [
      { defId: 'mag_puller', x: 4, y: 2 },
      { defId: 'heavy_turret', x: 4, y: 0 },
      { defId: 'swarm_spark', x: 3, y: 4 },
    ],
    layout: ['...O.', '..P..', '.C.V.', '..P..', '...O.'],
  },
  {
    id: 'a2_bunker',
    act: 2,
    titleRu: 'Бункер Турелей',
    titleEn: 'Turret Bunker',
    enemies: [
      { defId: 'heavy_turret', x: 4, y: 1 },
      { defId: 'shield_bearer', x: 3, y: 2 },
      { defId: 'mortar_bot', x: 4, y: 4 },
    ],
    layout: ['....O', '.P...', '..C.V', '.P...', '....O'],
  },
  {
    id: 'a2_elite',
    act: 2,
    isElite: true,
    titleRu: 'ЭЛИТА: Плавильный Голем',
    titleEn: 'ELITE: Furnace Golem',
    enemies: [
      { defId: 'elite_furnace', x: 4, y: 2 },
      { defId: 'pyro_bomber', x: 3, y: 0 },
    ],
    layout: ['..V.O', '.P...', '..C..', '.P.V.', '....O'],
  },
  {
    id: 'a2_boss',
    act: 2,
    isBoss: true,
    titleRu: 'БОСС СЕКТОРА II: МАТРИЦА ПРИЗМЫ',
    titleEn: 'SECTOR II BOSS: PRISM SOVEREIGN',
    enemies: [
      { defId: 'boss_prism', x: 4, y: 2 },
      { defId: 'shield_bearer', x: 3, y: 1 },
    ],
    layout: ['..O..', '.P.C.', '..V..', '.P.C.', '..O..'],
  },

  // === ACT 3 COMBATS ===
  {
    id: 'a3_vanguard',
    act: 3,
    titleRu: 'Авангард Сингулярности',
    titleEn: 'Singularity Vanguard',
    enemies: [
      { defId: 'void_reaper', x: 3, y: 1 },
      { defId: 'prism_sentinel', x: 4, y: 3 },
      { defId: 'mag_puller', x: 4, y: 0 },
    ],
    layout: ['...O.', '.P.V.', '..C..', '.V.P.', '...O.'],
  },
  {
    id: 'a3_killbox',
    act: 3,
    titleRu: 'Камера Перегрузки',
    titleEn: 'Overload Chamber',
    enemies: [
      { defId: 'prism_sentinel', x: 4, y: 1 },
      { defId: 'heavy_turret', x: 4, y: 3 },
      { defId: 'void_reaper', x: 3, y: 2 },
    ],
    layout: ['..O..', '.C.P.', '...V.', '.C.P.', '..O..'],
  },
  {
    id: 'a3_elite',
    act: 3,
    isElite: true,
    titleRu: 'ЭЛИТА: Архитектор Сбоя',
    titleEn: 'ELITE: Fault Architect',
    enemies: [
      { defId: 'elite_architect', x: 4, y: 2 },
      { defId: 'void_reaper', x: 3, y: 4 },
    ],
    layout: ['..O.V', '.P...', '..C..', '.P...', '..V.O'],
  },
  {
    id: 'a3_boss',
    act: 3,
    isBoss: true,
    titleRu: 'ФИНАЛЬНЫЙ БОСС: СИНГУЛЯРНОСТЬ-Ω',
    titleEn: 'FINAL BOSS: SINGULARITY-Ω',
    enemies: [
      { defId: 'boss_singularity', x: 4, y: 2 },
      { defId: 'prism_sentinel', x: 3, y: 0 },
    ],
    layout: ['..O..', '.C.P.', '..V..', '.C.P.', '..O..'],
  },
];
