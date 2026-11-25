import { RelicDef } from '../types';

export const RELICS: Record<string, RelicDef> = {
  // === PILOT STARTER RELICS ===
  copper_core: {
    id: 'copper_core',
    rarity: 'starter',
    icon: '🔌',
    nameRu: 'Медный Сердечник',
    nameEn: 'Copper Core',
    descRu: 'В начале боя ставит 1 Энерго-Реле рядом с Ядром. Дуги из 2+ узлов наносят +2 урона.',
    descEn: 'Start combat with 1 Arc Relay nearby. Arc chains of 2+ Nodes deal +2 bonus dmg.',
  },
  impact_dampener: {
    id: 'impact_dampener',
    rarity: 'starter',
    icon: '🛡',
    nameRu: 'Амортизатор Удара',
    nameEn: 'Impact Dampener',
    descRu: 'Каждое столкновение врага (Slam) наносит +2 урона и даёт Ядру +3 Щита.',
    descEn: 'Every enemy Slam collision deals +2 extra dmg and grants +3 Shield.',
  },
  quantum_capacitor: {
    id: 'quantum_capacitor',
    rarity: 'starter',
    icon: '⚛️',
    nameRu: 'Квантовый Конденсатор',
    nameEn: 'Quantum Capacitor',
    descRu: 'На 1-м ходу каждого боя даёт +1 Энергию и добор +1 карты.',
    descEn: 'On Turn 1 of every combat, gain +1 Energy and draw +1 card.',
  },

  // === COMMON & RARE RELICS ===
  superconductor: {
    id: 'superconductor',
    rarity: 'common',
    icon: '⚡',
    nameRu: 'Сверхпроводник',
    nameEn: 'Superconductor',
    descRu: 'Первая карта установки Реле/Катушки/Мины в бою стоит 0 Энергии.',
    descEn: 'Your first Relay/Coil/Mine card each combat costs 0 Energy.',
  },
  gravi_anchor: {
    id: 'gravi_anchor',
    rarity: 'common',
    icon: '⚓',
    nameRu: 'Грави-Якорь',
    nameEn: 'Gravi-Anchor',
    descRu: 'При отталкивании врага в стену, колонну или пропасть добираете 1 карту (до 2 раз/ход).',
    descEn: 'Whenever an enemy slams into a wall, pillar, or pit, draw 1 card.',
  },
  recuperator: {
    id: 'recuperator',
    rarity: 'rare',
    icon: '🔋',
    nameRu: 'Рекуператор Дуги',
    nameEn: 'Arc Recuperator',
    descRu: 'Уничтожение любого врага даёт +1 Энергию в этом ходу.',
    descEn: 'Destroying any enemy grants +1 Energy this turn.',
  },
  titanium_hull: {
    id: 'titanium_hull',
    rarity: 'common',
    icon: '🦾',
    nameRu: 'Титановая Обшивка',
    nameEn: 'Titanium Hull',
    descRu: 'В начале каждого хода Ядро автоматически получает +3 Щита.',
    descEn: 'At the start of every turn, automatically gain +3 Shield.',
  },
  nano_salvager: {
    id: 'nano_salvager',
    rarity: 'common',
    icon: '🔧',
    nameRu: 'Нано-Сборщик',
    nameEn: 'Nano Salvager',
    descRu: 'После каждого боя восстанавливает +5 HP и даёт +12 Кредитов.',
    descEn: 'After every combat, restore +5 HP and gain +12 extra Credits.',
  },
  plasma_vent_boots: {
    id: 'plasma_vent_boots',
    rarity: 'common',
    icon: '🥾',
    nameRu: 'Термо-Траки',
    nameEn: 'Thermal Treads',
    descRu: 'Ядро не получает урон от термальных люков и получает +4 Щита при окончании хода на люке.',
    descEn: 'Immune to Thermal Vents and gain +4 Shield when ending turn on a Vent.',
  },
  tesla_overdrive: {
    id: 'tesla_overdrive',
    rarity: 'rare',
    icon: '🌩',
    nameRu: 'Усилитель Теслы',
    nameEn: 'Tesla Amplifier',
    descRu: 'Все ваши Дуги дополнительно наносят +1 урон за КАЖДЫЙ узел в цепи.',
    descEn: 'All your Arc Chains deal an extra +1 dmg per Node in the circuit.',
  },
  heavy_pistons: {
    id: 'heavy_pistons',
    rarity: 'common',
    icon: '🔨',
    nameRu: 'Тяжёлые Поршни',
    nameEn: 'Heavy Pistons',
    descRu: 'Все карты отталкивания толкают врагов на +1 клетку дальше.',
    descEn: 'All Push effects knock enemies +1 additional tile.',
  },
  volatile_nodes: {
    id: 'volatile_nodes',
    rarity: 'rare',
    icon: '💣',
    nameRu: 'Нестабильные Узлы',
    nameEn: 'Volatile Nodes',
    descRu: 'Подрыв Реле при столкновении врага наносит 10 урона (вместо 6) в кресте.',
    descEn: 'Detonating a Relay via enemy knockback deals 10 AoE dmg (up from 6).',
  },
  overclock_chip: {
    id: 'overclock_chip',
    rarity: 'boss',
    icon: '💎',
    nameRu: 'Кристалл Сверхзаряда',
    nameEn: 'Overdrive Crystal',
    descRu: '+1 к максимальной Энергии каждый ход! (Легендарный модуль босса)',
    descEn: '+1 Max Energy every turn! (Legendary Boss Relic)',
  },
  chrono_stabilizer: {
    id: 'chrono_stabilizer',
    rarity: 'boss',
    icon: '⏳',
    nameRu: 'Хроно-Стабилизатор',
    nameEn: 'Chrono Stabilizer',
    descRu: 'Каждый ход добираете +1 карту и начинаете ход с +4 Щита.',
    descEn: 'Draw +1 extra card every turn and start each turn with +4 Shield.',
  },
  prism_lens: {
    id: 'prism_lens',
    rarity: 'boss',
    icon: '🔮',
    nameRu: 'Призма Сектора',
    nameEn: 'Sector Prism',
    descRu: 'Все Дуги и Лучи наносят +3 базового урона и накладывают Уязвимость (1).',
    descEn: 'All Arcs and Line Beams deal +3 base dmg and apply Vulnerable (1).',
  },
  scrap_magnet: {
    id: 'scrap_magnet',
    rarity: 'common',
    icon: '🧲',
    nameRu: 'Магнит Лома',
    nameEn: 'Scrap Magnet',
    descRu: 'На 35% больше Энергокредитов со всех боёв и 20% скидка на Чёрном Рынке.',
    descEn: '+35% Credits from all combats and 20% discount at the Black Market.',
  },
};

export const DROPPABLE_RELIC_IDS = Object.values(RELICS)
  .filter((r) => r.rarity === 'common' || r.rarity === 'rare')
  .map((r) => r.id);

export const BOSS_RELIC_IDS = Object.values(RELICS)
  .filter((r) => r.rarity === 'boss')
  .map((r) => r.id);
