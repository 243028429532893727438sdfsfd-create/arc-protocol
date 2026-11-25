import React from 'react';
import { CARDS } from '../game/data/cards';
import { CardInstance, Lang } from '../game/types';

interface CardViewProps {
  card: CardInstance;
  cost: number;
  lang: Lang;
  selected?: boolean;
  playable?: boolean;
  hotkey?: number;
  compact?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

const ARCHETYPE_LABEL: Record<string, { ru: string; en: string }> = {
  arc: { ru: 'ДУГА', en: 'ARC' },
  kinetic: { ru: 'КИНЕТИКА', en: 'KINETIC' },
  defense: { ru: 'ЗАЩИТА', en: 'DEFENSE' },
  overclock: { ru: 'РАЗГОН', en: 'OVERCLOCK' },
};

export const CardView: React.FC<CardViewProps> = ({
  card,
  cost,
  lang,
  selected = false,
  playable = true,
  hotkey,
  compact = false,
  onClick,
  onDoubleClick,
}) => {
  const def = CARDS[card.defId];
  const name = (lang === 'ru' ? def.nameRu : def.nameEn) + (card.upgraded ? '+' : '');
  const desc = card.upgraded
    ? lang === 'ru'
      ? def.upgradedDescRu
      : def.upgradedDescEn
    : lang === 'ru'
    ? def.descRu
    : def.descEn;

  return (
    <button
      type="button"
      className={`game-card arch-${def.archetype} ${card.upgraded ? 'upgraded' : ''} ${
        selected ? 'selected' : ''
      } ${!playable ? 'unplayable' : ''} ${compact ? 'compact' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="card-top">
        <span className="card-cost">{cost}</span>
        <span className="card-arch">{ARCHETYPE_LABEL[def.archetype][lang]}</span>
        {hotkey !== undefined && <span className="card-hotkey">{hotkey}</span>}
      </div>
      <div className="card-icon">{def.icon}</div>
      <div className="card-name">{name}</div>
      <div className="card-desc">{desc}</div>
    </button>
  );
};
