import React, { useState } from 'react';
import { CARDS } from '../game/data/cards';
import { ENEMIES } from '../game/data/enemies';
import { EVENTS } from '../game/data/events';
import { META_UPGRADES, PILOTS } from '../game/data/pilots';
import { RELICS } from '../game/data/relics';
import { CardInstance, Lang, MetaProgress, RunState } from '../game/types';
import { CardView } from './CardView';

export const RewardScreen: React.FC<{
  run: RunState;
  lang: Lang;
  onPickCard: (defId: string) => void;
  onSkipCard: () => void;
  onPickRelic: (relicId: string) => void;
  onContinue: () => void;
}> = ({ run, lang, onPickCard, onSkipCard, onPickRelic, onContinue }) => {
  const rew = run.reward!;
  return (
    <div className="panel-screen">
      <div className="screen-header">
        <div>
          <div className="eyebrow">{lang === 'ru' ? 'СЕКТОР ЗАЧИЩЕН' : 'SECTOR CLEARED'}</div>
          <h2>{lang === 'ru' ? 'Трофеи боя' : 'Combat Rewards'}</h2>
        </div>
        <div className="reward-chips">
          <span className="chip amber">💰 +{rew.scrap} {lang === 'ru' ? 'Кредитов' : 'Credits'}</span>
          <span className="chip violet">💎 +{rew.shards} {lang === 'ru' ? 'Кристаллов' : 'Shards'}</span>
        </div>
      </div>

      {rew.relicChoices && rew.relicChoices.length > 0 && !rew.relicPicked && (
        <div className="reward-section">
          <h3>
            {rew.isBoss
              ? lang === 'ru'
                ? '👑 Выберите легендарный Модуль Босса:'
                : '👑 Choose a Legendary Boss Relic:'
              : lang === 'ru'
              ? '🎁 Заберите Модуль Элиты:'
              : '🎁 Claim Elite Relic:'}
          </h3>
          <div className="relic-choice-grid">
            {rew.relicChoices.map((rel) => (
              <button
                type="button"
                key={rel.id}
                className="relic-choice-card"
                onClick={() => onPickRelic(rel.id)}
              >
                <div className="relic-big-icon">{rel.icon}</div>
                <div className="relic-title">{lang === 'ru' ? rel.nameRu : rel.nameEn}</div>
                <div className="relic-desc">{lang === 'ru' ? rel.descRu : rel.descEn}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!rew.cardPicked && (
        <div className="reward-section">
          <h3>{lang === 'ru' ? '⚡ Выберите 1 новую карту в колоду:' : '⚡ Choose 1 card to add to your deck:'}</h3>
          <div className="card-choice-row">
            {rew.cardChoices.map((def) => (
              <CardView
                key={def.id}
                card={{ uid: def.id, defId: def.id, upgraded: false }}
                cost={def.cost}
                lang={lang}
                onClick={() => onPickCard(def.id)}
              />
            ))}
          </div>
          <div className="center-actions">
            <button type="button" className="btn secondary" onClick={onSkipCard}>
              {lang === 'ru' ? 'Пропустить карту (+20 Кредитов)' : 'Skip Card (+20 Credits)'}
            </button>
          </div>
        </div>
      )}

      {rew.cardPicked && rew.relicPicked && (
        <div className="center-actions" style={{ marginTop: 28 }}>
          <button type="button" className="btn primary lg" onClick={onContinue}>
            {rew.isBoss
              ? lang === 'ru'
                ? `Перейти в Сектор ${run.act + 1} →`
                : `Advance to Sector ${run.act + 1} →`
              : lang === 'ru'
              ? 'Вернуться на карту →'
              : 'Return to Sector Map →'}
          </button>
        </div>
      )}
    </div>
  );
};

export const WorkshopScreen: React.FC<{
  run: RunState;
  lang: Lang;
  onHeal: () => void;
  onUpgradeCard: (uid: string) => void;
  onPurgeCard: (uid: string) => void;
  onLeave: () => void;
}> = ({ run, lang, onHeal, onUpgradeCard, onPurgeCard, onLeave }) => {
  const [mode, setMode] = useState<'menu' | 'upgrade' | 'purge'>('menu');
  const healAmt = Math.round(run.maxHp * 0.35);

  return (
    <div className="panel-screen">
      <div className="screen-header">
        <div>
          <div className="eyebrow">{lang === 'ru' ? 'ТЕХНИЧЕСКИЙ УЗЕЛ' : 'ENGINEERING BAY'}</div>
          <h2>⚙️ {lang === 'ru' ? 'Мастерская Ядра' : 'Core Workshop'}</h2>
        </div>
        <button type="button" className="btn secondary" onClick={onLeave}>
          {lang === 'ru' ? 'На карту →' : 'To Map →'}
        </button>
      </div>

      {run.workshopUsed ? (
        <div className="outcome-box">
          <p>{lang === 'ru' ? '✅ Обслуживание завершено. Можно продолжать маршрут!' : '✅ Maintenance complete. Ready to proceed!'}</p>
          <button type="button" className="btn primary" onClick={onLeave}>
            {lang === 'ru' ? 'Продолжить маршрут →' : 'Continue Route →'}
          </button>
        </div>
      ) : mode === 'menu' ? (
        <div className="workshop-grid">
          <button type="button" className="workshop-opt" onClick={onHeal}>
            <span className="ws-icon">💚</span>
            <strong>{lang === 'ru' ? `Ремонт корпуса (+${healAmt} HP)` : `Repair Hull (+${healAmt} HP)`}</strong>
            <span>{lang === 'ru' ? 'Восстанавливает 35% от максимальной прочности' : 'Restore 35% of Max HP'}</span>
          </button>
          <button type="button" className="workshop-opt" onClick={() => setMode('upgrade')}>
            <span className="ws-icon">⬆️</span>
            <strong>{lang === 'ru' ? 'Перепрошить карту (+)' : 'Upgrade a Card (+)'}</strong>
            <span>{lang === 'ru' ? 'Усиливает урон, щит или снижает стоимость карты' : 'Boosts damage, shield, or lowers cost'}</span>
          </button>
          <button type="button" className="workshop-opt" onClick={() => setMode('purge')}>
            <span className="ws-icon">🔥</span>
            <strong>{lang === 'ru' ? 'Удалить лишнюю карту' : 'Purge a Card'}</strong>
            <span>{lang === 'ru' ? 'Убирает слабую карту, ускоряя ключевые комбо' : 'Thin your deck for stronger combos'}</span>
          </button>
        </div>
      ) : (
        <div>
          <div className="subbar">
            <strong>
              {mode === 'upgrade'
                ? lang === 'ru'
                  ? 'Выберите карту для улучшения до +:'
                  : 'Select a card to upgrade to +:'
                : lang === 'ru'
                ? 'Выберите карту для удаления из колоды:'
                : 'Select a card to remove from your deck:'}
            </strong>
            <button type="button" className="btn secondary sm" onClick={() => setMode('menu')}>
              ← {lang === 'ru' ? 'Назад' : 'Back'}
            </button>
          </div>
          <div className="deck-grid">
            {run.deck
              .filter((c) => (mode === 'upgrade' ? !c.upgraded : true))
              .map((c) => (
                <CardView
                  key={c.uid}
                  card={c}
                  cost={c.upgraded && CARDS[c.defId].upgradedCost !== undefined ? CARDS[c.defId].upgradedCost! : CARDS[c.defId].cost}
                  lang={lang}
                  compact
                  onClick={() => (mode === 'upgrade' ? onUpgradeCard(c.uid) : onPurgeCard(c.uid))}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ShopScreen: React.FC<{
  run: RunState;
  lang: Lang;
  onBuyItem: (itemId: string) => void;
  onBuyPurge: (itemId: string, cardUid: string) => void;
  onLeave: () => void;
}> = ({ run, lang, onBuyItem, onBuyPurge, onLeave }) => {
  const [purgingItemId, setPurgingItemId] = useState<string | null>(null);
  const items = run.shopItems ?? [];

  return (
    <div className="panel-screen">
      <div className="screen-header">
        <div>
          <div className="eyebrow">{lang === 'ru' ? 'ПОДПОЛЬНЫЙ ТЕРМИНАЛ' : 'BLACK MARKET'}</div>
          <h2>🛒 {lang === 'ru' ? 'Чёрный Рынок Модулей' : 'Black Market'}</h2>
        </div>
        <div className="row-gap">
          <span className="chip amber">💰 {run.scrap}</span>
          <button type="button" className="btn primary" onClick={onLeave}>
            {lang === 'ru' ? 'На карту →' : 'Leave Market →'}
          </button>
        </div>
      </div>

      {purgingItemId ? (
        <div>
          <div className="subbar">
            <strong>{lang === 'ru' ? 'Выберите карту для удаления:' : 'Select a card to purge:'}</strong>
            <button type="button" className="btn secondary sm" onClick={() => setPurgingItemId(null)}>
              ← {lang === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
          </div>
          <div className="deck-grid">
            {run.deck.map((c) => (
              <CardView
                key={c.uid}
                card={c}
                cost={CARDS[c.defId].cost}
                lang={lang}
                compact
                onClick={() => {
                  onBuyPurge(purgingItemId, c.uid);
                  setPurgingItemId(null);
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="shop-sections">
          <div className="card-choice-row">
            {items
              .filter((i) => i.kind === 'card' && i.defId)
              .map((item) => {
                const def = CARDS[item.defId!];
                const canAfford = !item.sold && run.scrap >= item.price;
                return (
                  <div key={item.id} className={`shop-slot ${item.sold ? 'sold' : ''}`}>
                    <CardView
                      card={{ uid: item.id, defId: def.id, upgraded: false }}
                      cost={def.cost}
                      lang={lang}
                      playable={canAfford}
                      compact
                      onClick={() => canAfford && onBuyItem(item.id)}
                    />
                    <div className="price-tag">
                      {item.sold ? (lang === 'ru' ? 'КУПЛЕНО' : 'SOLD') : `💰 ${item.price}`}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="relic-choice-grid" style={{ marginTop: 16 }}>
            {items
              .filter((i) => i.kind !== 'card')
              .map((item) => {
                const canAfford = !item.sold && run.scrap >= item.price;
                if (item.kind === 'relic' && item.defId) {
                  const rel = RELICS[item.defId];
                  return (
                    <button
                      type="button"
                      key={item.id}
                      disabled={!canAfford}
                      className="relic-choice-card"
                      onClick={() => onBuyItem(item.id)}
                    >
                      <div className="relic-big-icon">{rel.icon}</div>
                      <div className="relic-title">{lang === 'ru' ? rel.nameRu : rel.nameEn}</div>
                      <div className="relic-desc">{lang === 'ru' ? rel.descRu : rel.descEn}</div>
                      <div className="price-tag">
                        {item.sold ? (lang === 'ru' ? 'КУПЛЕНО' : 'SOLD') : `💰 ${item.price}`}
                      </div>
                    </button>
                  );
                }
                return (
                  <button
                    type="button"
                    key={item.id}
                    disabled={!canAfford}
                    className="relic-choice-card"
                    onClick={() =>
                      item.kind === 'purge' ? setPurgingItemId(item.id) : onBuyItem(item.id)
                    }
                  >
                    <div className="relic-big-icon">{item.kind === 'heal' ? '💚' : '🔥'}</div>
                    <div className="relic-title">
                      {item.kind === 'heal'
                        ? lang === 'ru'
                          ? 'Экспресс-Ремонт (+14 HP)'
                          : 'Quick Repair (+14 HP)'
                        : lang === 'ru'
                        ? 'Удалить карту из колоды'
                        : 'Purge a Card'}
                    </div>
                    <div className="price-tag">
                      {item.sold ? (lang === 'ru' ? 'КУПЛЕНО' : 'SOLD') : `💰 ${item.price}`}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export const EventScreen: React.FC<{
  run: RunState;
  lang: Lang;
  onChoose: (choiceId: string) => void;
  onLeave: () => void;
}> = ({ run, lang, onChoose, onLeave }) => {
  const ev = EVENTS.find((e) => e.id === run.activeEventId) ?? EVENTS[0];
  return (
    <div className="panel-screen narrow">
      <div className="event-hero">
        <span className="event-icon">{ev.icon}</span>
        <h2>{lang === 'ru' ? ev.titleRu : ev.titleEn}</h2>
        <p>{lang === 'ru' ? ev.bodyRu : ev.bodyEn}</p>
      </div>

      {run.eventOutcomeText ? (
        <div className="outcome-box">
          <p>{run.eventOutcomeText}</p>
          <button type="button" className="btn primary" onClick={onLeave}>
            {lang === 'ru' ? 'Продолжить маршрут →' : 'Continue →'}
          </button>
        </div>
      ) : (
        <div className="event-choices">
          {ev.choices.map((ch) => (
            <button type="button" key={ch.id} className="event-btn" onClick={() => onChoose(ch.id)}>
              <strong>{lang === 'ru' ? ch.labelRu : ch.labelEn}</strong>
              <span>{lang === 'ru' ? ch.hintRu : ch.hintEn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const SummaryScreen: React.FC<{
  run: RunState;
  shardsEarned: number;
  lang: Lang;
  onNewRun: () => void;
  onOpenLab: () => void;
  onTitle: () => void;
}> = ({ run, shardsEarned, lang, onNewRun, onOpenLab, onTitle }) => {
  const mins = Math.max(1, Math.round((Date.now() - run.stats.startedAt) / 60000));
  return (
    <div className="panel-screen narrow">
      <div className="summary-hero">
        <div className="summary-badge">{run.victory ? '🏆' : '💥'}</div>
        <h1>
          {run.victory
            ? lang === 'ru'
              ? 'ПРОТОКОЛ ВЫПОЛНЕН — ПОБЕДА!'
              : 'PROTOCOL COMPLETE — VICTORY!'
            : lang === 'ru'
            ? 'ЯДРО РАЗРУШЕНО'
            : 'CORE DESTROYED'}
        </h1>
        <p>
          {run.victory
            ? lang === 'ru'
              ? 'Сингулярность-Ω остановлена! Открыт следующий уровень Перегрузки (Overdrive).'
              : 'Singularity-Ω neutralized! Next Overdrive difficulty unlocked.'
            : lang === 'ru'
            ? 'Собранные Кристаллы Данных сохранены в Лаборатории Ядра — усильте старт и попробуйте снова!'
            : 'Earned Data Shards are saved in the Core Lab — upgrade your Core and deploy again!'}
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-box"><span>{lang === 'ru' ? 'Сектор' : 'Sector'}</span><strong>{run.act} / 3</strong></div>
        <div className="stat-box"><span>{lang === 'ru' ? 'Побед в боях' : 'Combats Won'}</span><strong>{run.stats.combatsWon}</strong></div>
        <div className="stat-box"><span>{lang === 'ru' ? 'Макс. Дуга' : 'Max Arc Chain'}</span><strong>⚡ ×{run.stats.maxChain}</strong></div>
        <div className="stat-box"><span>{lang === 'ru' ? 'Столкновений' : 'Slams'}</span><strong>💥 {run.stats.totalSlams}</strong></div>
        <div className="stat-box"><span>{lang === 'ru' ? 'Сбросов в пропасть' : 'Pit Kills'}</span><strong>☠ {run.stats.totalPitKills}</strong></div>
        <div className="stat-box"><span>{lang === 'ru' ? 'Кристаллов Данных' : 'Data Shards'}</span><strong>💎 +{shardsEarned}</strong></div>
        <div className="stat-box"><span>{lang === 'ru' ? 'Время забега' : 'Run Time'}</span><strong>{mins} мин</strong></div>
        <div className="stat-box"><span>{lang === 'ru' ? 'Размер колоды' : 'Deck Size'}</span><strong>{run.deck.length}</strong></div>
      </div>

      <div className="center-actions">
        <button type="button" className="btn primary lg" onClick={onOpenLab}>
          💎 {lang === 'ru' ? 'Лаборатория Ядра' : 'Core Lab'}
        </button>
        <button type="button" className="btn secondary lg" onClick={onNewRun}>
          ⚡ {lang === 'ru' ? 'Новый забег' : 'New Run'}
        </button>
        <button type="button" className="btn ghost" onClick={onTitle}>
          {lang === 'ru' ? 'Главное меню' : 'Main Menu'}
        </button>
      </div>
    </div>
  );
};

export const LabScreen: React.FC<{
  meta: MetaProgress;
  lang: Lang;
  onBuyUpgrade: (id: string) => void;
  onUnlockPilot: (id: string) => void;
  onToggleReviewer: () => void;
  onBack: () => void;
}> = ({ meta, lang, onBuyUpgrade, onUnlockPilot, onToggleReviewer, onBack }) => {
  return (
    <div className="panel-screen">
      <div className="screen-header">
        <div>
          <div className="eyebrow">{lang === 'ru' ? 'МЕТА-ПРОГРЕССИЯ МЕЖДУ ЗАБЕГАМИ' : 'META PROGRESSION'}</div>
          <h2>💎 {lang === 'ru' ? 'Лаборатория Ядра' : 'Core Lab'}</h2>
        </div>
        <div className="row-gap">
          <span className="chip violet">💎 {meta.shards} {lang === 'ru' ? 'Кристаллов' : 'Shards'}</span>
          <button type="button" className="btn primary" onClick={onBack}>
            ← {lang === 'ru' ? 'В меню' : 'Back'}
          </button>
        </div>
      </div>

      <h3>{lang === 'ru' ? 'Постоянные улучшения' : 'Permanent Upgrades'}</h3>
      <div className="relic-choice-grid">
        {META_UPGRADES.map((u) => {
          const lvl = meta.upgrades[u.id] ?? 0;
          const maxed = lvl >= u.maxLevel;
          const cost = maxed ? 0 : u.costs[lvl];
          return (
            <button
              type="button"
              key={u.id}
              disabled={maxed || meta.shards < cost}
              className="relic-choice-card"
              onClick={() => onBuyUpgrade(u.id)}
            >
              <div className="relic-big-icon">{u.icon}</div>
              <div className="relic-title">
                {lang === 'ru' ? u.nameRu : u.nameEn} ({lvl}/{u.maxLevel})
              </div>
              <div className="relic-desc">{lang === 'ru' ? u.descRu : u.descEn}</div>
              <div className="price-tag">
                {maxed ? 'MAX' : `💎 ${cost}`}
              </div>
            </button>
          );
        })}
      </div>

      <h3 style={{ marginTop: 22 }}>{lang === 'ru' ? 'Разблокировка Пилотов-Ядер' : 'Unlockable Pilot Cores'}</h3>
      <div className="relic-choice-grid">
        {PILOTS.map((p) => {
          const unlocked = meta.reviewerAllUnlocked || meta.unlockedPilots.includes(p.id);
          return (
            <button
              type="button"
              key={p.id}
              disabled={unlocked || meta.shards < p.unlockCost}
              className="relic-choice-card"
              onClick={() => onUnlockPilot(p.id)}
            >
              <div className="relic-big-icon">{p.icon}</div>
              <div className="relic-title">{lang === 'ru' ? p.nameRu : p.nameEn}</div>
              <div className="relic-desc">{lang === 'ru' ? p.descRu : p.descEn}</div>
              <div className="price-tag">
                {unlocked ? (lang === 'ru' ? 'ОТКРЫТ' : 'UNLOCKED') : `💎 ${p.unlockCost}`}
              </div>
            </button>
          );
        })}
      </div>

      <div className="reviewer-bar">
        <span>
          {lang === 'ru'
            ? 'Режим для ревьюера GamesUp42: открыть сразу все 3 Ядра и уровни Перегрузки (Overdrive 0–3) для быстрой оценки контента'
            : 'Reviewer Mode: unlock all 3 Pilot Cores & Overdrive tiers immediately for evaluation'}
        </span>
        <button type="button" className="btn secondary sm" onClick={onToggleReviewer}>
          {meta.reviewerAllUnlocked
            ? lang === 'ru'
              ? '✅ Включён'
              : '✅ Enabled'
            : lang === 'ru'
            ? 'Открыть всё'
            : 'Unlock All'}
        </button>
      </div>
    </div>
  );
};

export const CodexScreen: React.FC<{ lang: Lang; onBack: () => void }> = ({ lang, onBack }) => {
  const [tab, setTab] = useState<'cards' | 'relics' | 'enemies'>('cards');
  return (
    <div className="panel-screen">
      <div className="screen-header">
        <div>
          <div className="eyebrow">{lang === 'ru' ? 'БАЗА ЗНАНИЙ' : 'DATABASE'}</div>
          <h2>📚 {lang === 'ru' ? 'Кодекс Протокола' : 'Protocol Codex'}</h2>
        </div>
        <div className="row-gap">
          <button type="button" className={`btn sm ${tab === 'cards' ? 'primary' : 'secondary'}`} onClick={() => setTab('cards')}>
            {lang === 'ru' ? `Карты (${Object.keys(CARDS).length})` : `Cards (${Object.keys(CARDS).length})`}
          </button>
          <button type="button" className={`btn sm ${tab === 'relics' ? 'primary' : 'secondary'}`} onClick={() => setTab('relics')}>
            {lang === 'ru' ? `Модули (${Object.keys(RELICS).length})` : `Relics (${Object.keys(RELICS).length})`}
          </button>
          <button type="button" className={`btn sm ${tab === 'enemies' ? 'primary' : 'secondary'}`} onClick={() => setTab('enemies')}>
            {lang === 'ru' ? `Враги (${Object.keys(ENEMIES).length})` : `Enemies (${Object.keys(ENEMIES).length})`}
          </button>
          <button type="button" className="btn ghost sm" onClick={onBack}>
            ✕
          </button>
        </div>
      </div>

      {tab === 'cards' && (
        <div className="deck-grid">
          {Object.values(CARDS).map((def) => (
            <CardView
              key={def.id}
              card={{ uid: def.id, defId: def.id, upgraded: false }}
              cost={def.cost}
              lang={lang}
              compact
            />
          ))}
        </div>
      )}

      {tab === 'relics' && (
        <div className="relic-choice-grid">
          {Object.values(RELICS).map((r) => (
            <div key={r.id} className="relic-choice-card static">
              <div className="relic-big-icon">{r.icon}</div>
              <div className="relic-title">{lang === 'ru' ? r.nameRu : r.nameEn}</div>
              <div className="relic-desc">{lang === 'ru' ? r.descRu : r.descEn}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'enemies' && (
        <div className="relic-choice-grid">
          {Object.values(ENEMIES).map((e) => (
            <div key={e.id} className="relic-choice-card static">
              <div className="relic-big-icon">{e.icon}</div>
              <div className="relic-title">{lang === 'ru' ? e.nameRu : e.nameEn}</div>
              <div className="relic-desc">
                HP: {e.maxHp} · Act {e.act} — {lang === 'ru' ? e.descRu : e.descEn}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const DeckModal: React.FC<{
  title: string;
  cards: CardInstance[];
  lang: Lang;
  onClose: () => void;
}> = ({ title, cards, lang, onClose }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
      <div className="screen-header">
        <h3>
          {title} ({cards.length})
        </h3>
        <button type="button" className="btn ghost sm" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="deck-grid">
        {cards.map((c) => (
          <CardView
            key={c.uid}
            card={c}
            cost={
              c.upgraded && CARDS[c.defId].upgradedCost !== undefined
                ? CARDS[c.defId].upgradedCost!
                : CARDS[c.defId].cost
            }
            lang={lang}
            compact
          />
        ))}
      </div>
    </div>
  </div>
);
