import React, { useEffect, useMemo, useState } from 'react';
import { ArenaCanvas } from './components/ArenaCanvas';
import { CardView } from './components/CardView';
import {
  CodexScreen,
  DeckModal,
  EventScreen,
  LabScreen,
  RewardScreen,
  ShopScreen,
  SummaryScreen,
  WorkshopScreen,
} from './components/Overlays';
import { SectorMap } from './components/SectorMap';
import { sound } from './game/audio';
import { CARDS } from './game/data/cards';
import { PILOTS } from './game/data/pilots';
import { RELICS } from './game/data/relics';
import {
  endPlayerTurn,
  getCardCost,
  getCardDef,
  getEnemyAt,
  getNodeAt,
  getValidTargetTiles,
  nextUid,
  playCard,
  previewCardAction,
} from './game/engine/combat';
import {
  buyMetaUpgrade,
  createNewRun,
  enterMapNode,
  finishCombatVictory,
  loadMeta,
  loadRun,
  proceedAfterReward,
  resolveEventChoice,
  saveMeta,
  saveRun,
  unlockPilot,
} from './game/engine/run';
import { Lang, MetaProgress, Pos, RunState } from './game/types';

export default function App() {
  const [lang, setLang] = useState<Lang>('ru');
  const [muted, setMuted] = useState(false);
  const [meta, setMeta] = useState<MetaProgress>(() => loadMeta());
  const [run, setRun] = useState<RunState | null>(() => loadRun());
  const [screen, setScreen] = useState<'title' | 'run' | 'lab' | 'codex'>('title');
  const [selectedPilotId, setSelectedPilotId] = useState<string>('volt_01');
  const [selectedOverdrive, setSelectedOverdrive] = useState<number>(0);

  // Combat interaction state
  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<Pos | null>(null);
  const [deckModal, setDeckModal] = useState<'deck' | 'draw' | 'discard' | null>(null);
  const [lastRunShards, setLastRunShards] = useState<number>(0);

  useEffect(() => {
    saveMeta(meta);
  }, [meta]);

  useEffect(() => {
    saveRun(run);
  }, [run]);

  const combat = run?.combat ?? null;
  const metaArcBonus = meta.upgrades.arc_tuning ?? 0;

  const selectedCard = useMemo(
    () => (combat && selectedCardUid ? combat.hand.find((c) => c.uid === selectedCardUid) ?? null : null),
    [combat, selectedCardUid]
  );

  const validTargets = useMemo(() => {
    if (!combat || !selectedCard || combat.phase !== 'player') return [];
    const cost = getCardCost(selectedCard, combat, run?.relicIds ?? []);
    if (combat.player.energy < cost) return [];
    return getValidTargetTiles(combat, selectedCard);
  }, [combat, selectedCard, run?.relicIds]);

  const preview = useMemo(() => {
    if (!combat || !selectedCard || !run) return null;
    const def = getCardDef(selectedCard);
    if (def.target === 'none') {
      return previewCardAction(combat, selectedCard, { x: combat.player.x, y: combat.player.y }, run.relicIds, metaArcBonus);
    }
    if (!hoveredTile) return null;
    return previewCardAction(combat, selectedCard, hoveredTile, run.relicIds, metaArcBonus);
  }, [combat, selectedCard, hoveredTile, run, metaArcBonus]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sound.setMuted(next);
  };

  const startNewRun = (pilotId = selectedPilotId, od = selectedOverdrive) => {
    sound.playClick();
    const fresh = createNewRun(pilotId, od, meta);
    setRun(fresh);
    setSelectedCardUid(null);
    setHoveredTile(null);
    setScreen('run');
  };

  const finalizeRunSummary = (finalRun: RunState, won: boolean) => {
    const earned =
      finalRun.stats.combatsWon * 4 +
      finalRun.stats.elitesWon * 8 +
      finalRun.stats.bossesWon * 16 +
      (won ? 35 : 5);
    setLastRunShards(earned);
    setMeta((m) => ({
      ...m,
      shards: m.shards + earned,
      totalRuns: m.totalRuns + 1,
      totalWins: m.totalWins + (won ? 1 : 0),
      bestChain: Math.max(m.bestChain, finalRun.stats.maxChain),
      maxOverdriveUnlocked: won
        ? Math.min(3, Math.max(m.maxOverdriveUnlocked, finalRun.overdrive + 1))
        : m.maxOverdriveUnlocked,
      tutorialCompleted: true,
    }));
    if (won) sound.playVictory();
    else sound.playDefeat();
  };

  const handlePlaySelectedCard = (target: Pos, explicitCardUid?: string) => {
    if (!run || !run.combat) return;
    const uid = explicitCardUid ?? selectedCardUid;
    if (!uid) return;
    const card = run.combat.hand.find((c) => c.uid === uid);
    if (!card) return;

    const prev = previewCardAction(run.combat, card, target, run.relicIds, metaArcBonus);
    if (!prev.valid) return;

    const nextCombat = playCard(run.combat, uid, target, run.relicIds, metaArcBonus, run.overdrive);
    if (nextCombat === run.combat) return;

    // Play rich contextual Web Audio SFX
    const def = getCardDef(card);
    if (prev.knockbacks.some((k) => k.pitKill || k.detonatedNode)) {
      sound.playExplosion();
    } else if (prev.knockbacks.some((k) => k.slammed)) {
      sound.playSlam();
    } else if (prev.arcLinks.length > 0 || def.archetype === 'arc') {
      sound.playArcZap(prev.chainCount);
    } else if (def.target === 'move_tile') {
      sound.playMove();
    } else if (def.archetype === 'defense') {
      sound.playShield();
    } else {
      sound.playSlam();
    }

    setSelectedCardUid(null);
    setHoveredTile(null);

    if (nextCombat.phase === 'victory') {
      sound.playVictory();
      setMeta((m) => ({
        ...m,
        bestChain: Math.max(m.bestChain, nextCombat.stats.maxChain),
        tutorialCompleted: true,
      }));
      const updated = finishCombatVictory({ ...run, combat: nextCombat });
      if (updated.victory) {
        finalizeRunSummary(updated, true);
      } else if (updated.reward) {
        setMeta((m) => ({ ...m, shards: m.shards + (updated.reward?.shards ?? 0) }));
      }
      setRun(updated);
      return;
    }

    setRun({ ...run, hp: nextCombat.player.hp, combat: nextCombat });
  };

  const handleCardClick = (uid: string) => {
    if (!run || !run.combat || run.combat.phase !== 'player') return;
    const card = run.combat.hand.find((c) => c.uid === uid);
    if (!card) return;
    const cost = getCardCost(card, run.combat, run.relicIds);
    if (run.combat.player.energy < cost) return;

    const def = getCardDef(card);
    if (def.target === 'none') {
      // Single click on already-selected self card plays immediately; or click plays immediately!
      if (selectedCardUid === uid) {
        handlePlaySelectedCard({ x: run.combat.player.x, y: run.combat.player.y }, uid);
      } else {
        sound.playCardSelect();
        setSelectedCardUid(uid);
      }
      return;
    }

    sound.playCardSelect();
    setSelectedCardUid(selectedCardUid === uid ? null : uid);
  };

  const handleEndTurn = () => {
    if (!run || !run.combat || run.combat.phase !== 'player') return;
    sound.playClick();
    setSelectedCardUid(null);
    setHoveredTile(null);
    const prevHp = run.combat.player.hp;
    const nextCombat = endPlayerTurn(run.combat, run.relicIds, run.overdrive);
    if (nextCombat.player.hp < prevHp) {
      sound.playEnemyHit();
    }

    if (nextCombat.phase === 'victory') {
      sound.playVictory();
      const updated = finishCombatVictory({ ...run, combat: nextCombat });
      if (updated.victory) finalizeRunSummary(updated, true);
      else if (updated.reward) setMeta((m) => ({ ...m, shards: m.shards + (updated.reward?.shards ?? 0) }));
      setRun(updated);
      return;
    }

    if (nextCombat.phase === 'defeat') {
      const deadRun: RunState = {
        ...run,
        hp: 0,
        combat: null,
        victory: false,
        screen: 'summary',
        stats: {
          ...run.stats,
          maxChain: Math.max(run.stats.maxChain, nextCombat.stats.maxChain),
          totalSlams: run.stats.totalSlams + nextCombat.stats.slams,
          totalPitKills: run.stats.totalPitKills + nextCombat.stats.pitKills,
          totalEnemiesKilled: run.stats.totalEnemiesKilled + nextCombat.stats.enemiesKilled,
          totalTurns: run.stats.totalTurns + nextCombat.stats.turns,
        },
      };
      finalizeRunSummary(deadRun, false);
      setRun(deadRun);
      return;
    }

    setRun({ ...run, hp: nextCombat.player.hp, combat: nextCombat });
  };

  // Keyboard shortcuts during combat (1-8 select card, Space/E end turn, Esc cancel)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'run' || !run?.combat || run.combat.phase !== 'player') return;
      if (deckModal) {
        if (e.key === 'Escape') setDeckModal(null);
        return;
      }
      if (e.key === 'Escape') {
        setSelectedCardUid(null);
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') {
        handleEndTurn();
      } else if (e.key >= '1' && e.key <= '8') {
        const idx = parseInt(e.key, 10) - 1;
        const c = run.combat.hand[idx];
        if (c) handleCardClick(c.uid);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Hovered tile details for right inspector
  const inspectedEnemy =
    combat && hoveredTile ? getEnemyAt(combat, hoveredTile.x, hoveredTile.y) : undefined;
  const inspectedNode =
    combat && hoveredTile ? getNodeAt(combat, hoveredTile.x, hoveredTile.y) : undefined;
  const inspectedTile =
    combat && hoveredTile ? combat.grid[hoveredTile.y][hoveredTile.x] : undefined;

  const currentPilot = PILOTS.find((p) => p.id === (run?.pilotId ?? selectedPilotId)) ?? PILOTS[0];

  // === RENDER TITLE SCREEN ===
  if (screen === 'title') {
    const hasActiveRun = run !== null && run.screen !== 'summary';
    const maxOd = meta.reviewerAllUnlocked ? 3 : meta.maxOverdriveUnlocked;

    return (
      <div className="app-shell title-bg">
        <header className="top-bar">
          <div className="brand">
            <span className="brand-bolt">⚡</span>
            <span>ARC PROTOCOL</span>
            <span className="brand-sub">// {lang === 'ru' ? 'ПРОТОКОЛ ДУГИ' : 'TACTICAL DECKBUILDER'}</span>
          </div>
          <div className="top-controls">
            <a className="btn ghost sm" href="./one-pager.html" target="_blank" rel="noreferrer">
              📄 One-Pager
            </a>
            <button type="button" className="btn ghost sm" onClick={() => setScreen('codex')}>
              📚 {lang === 'ru' ? 'Кодекс' : 'Codex'}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
              🌐 {lang.toUpperCase()}
            </button>
            <button type="button" className="btn ghost sm" onClick={toggleMute}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </header>

        <main className="title-main">
          <div className="title-hero">
            <div className="eyebrow">
              {lang === 'ru'
                ? 'ТАКТИЧЕСКИЙ GRID-ROGUELITE DECKBUILDER · 3 СЕКТОРА · 30+ КАРТ · 16 МОДУЛЕЙ'
                : 'TACTICAL GRID ROGUELITE DECKBUILDER · 3 SECTORS · 30+ CARDS · 16 RELICS'}
            </div>
            <h1>
              {lang === 'ru' ? 'ПРОТОКОЛ ДУГИ' : 'ARC PROTOCOL'}
            </h1>
            <p className="hero-lead">
              {lang === 'ru'
                ? 'Стройте сеть Энерго-Реле на арене 5×5, сбрасывайте врагов в пропасти и поджигайте цепные молнии с растущим множителем. Три сектора, 3 уникальных босса и глубокая мета-прогрессия.'
                : 'Deploy Arc Relay networks across a 5×5 arena, slam enemies into chasms, and unleash escalating Chain Lightning combos across 3 sectors & unique bosses.'}
            </p>
          </div>

          <div className="pilot-select-grid">
            {PILOTS.map((p) => {
              const unlocked = meta.reviewerAllUnlocked || meta.unlockedPilots.includes(p.id);
              const isSel = selectedPilotId === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  className={`pilot-card ${isSel ? 'selected' : ''} ${!unlocked ? 'locked' : ''}`}
                  style={{ '--accent': p.accent } as React.CSSProperties}
                  onClick={() => {
                    if (unlocked) {
                      sound.playClick();
                      setSelectedPilotId(p.id);
                    } else {
                      setScreen('lab');
                    }
                  }}
                >
                  <div className="pilot-top">
                    <span className="pilot-icon">{p.icon}</span>
                    <div>
                      <div className="pilot-name">{lang === 'ru' ? p.nameRu : p.nameEn}</div>
                      <div className="pilot-role">{lang === 'ru' ? p.titleRu : p.titleEn}</div>
                    </div>
                  </div>
                  <p className="pilot-desc">{lang === 'ru' ? p.descRu : p.descEn}</p>
                  <div className="pilot-meta">
                    <span>❤️ {p.maxHp + (meta.upgrades.hull_plating ?? 0) * 5} HP</span>
                    <span>⚡ {p.baseEnergy}</span>
                    <span>
                      {unlocked
                        ? `🔌 ${lang === 'ru' ? RELICS[p.starterRelicId].nameRu : RELICS[p.starterRelicId].nameEn}`
                        : `🔒 💎 ${p.unlockCost}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="title-actions">
            <div className="overdrive-picker">
              <span>{lang === 'ru' ? 'Перегрузка (Сложность):' : 'Overdrive Tier:'}</span>
              {[0, 1, 2, 3].map((od) => (
                <button
                  type="button"
                  key={od}
                  disabled={od > maxOd}
                  className={`od-btn ${selectedOverdrive === od ? 'active' : ''}`}
                  onClick={() => setSelectedOverdrive(od)}
                >
                  {od === 0 ? (lang === 'ru' ? 'Стандарт' : 'Standard') : `OD-${od}`}
                </button>
              ))}
            </div>

            <div className="center-actions">
              {hasActiveRun && (
                <button
                  type="button"
                  className="btn amber lg"
                  onClick={() => {
                    sound.playClick();
                    setScreen('run');
                  }}
                >
                  ▶ {lang === 'ru' ? `Продолжить (Сектор ${run.act})` : `Continue (Sector ${run.act})`}
                </button>
              )}
              <button type="button" className="btn primary lg" onClick={() => startNewRun()}>
                ⚡ {lang === 'ru' ? 'Начать новый забег' : 'Launch New Run'}
              </button>
              <button type="button" className="btn secondary lg" onClick={() => setScreen('lab')}>
                💎 {lang === 'ru' ? `Лаборатория (${meta.shards})` : `Core Lab (${meta.shards})`}
              </button>
            </div>

            <div className="meta-strip">
              <span>🎮 {lang === 'ru' ? 'Забегов' : 'Runs'}: {meta.totalRuns}</span>
              <span>🏆 {lang === 'ru' ? 'Побед' : 'Wins'}: {meta.totalWins}</span>
              <span>⚡ {lang === 'ru' ? 'Лучшая дуга' : 'Best Chain'}: ×{meta.bestChain}</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (screen === 'lab') {
    return (
      <div className="app-shell">
        <LabScreen
          meta={meta}
          lang={lang}
          onBuyUpgrade={(id) => {
            sound.playShield();
            setMeta((m) => buyMetaUpgrade(m, id));
          }}
          onUnlockPilot={(id) => {
            sound.playVictory();
            setMeta((m) => unlockPilot(m, id));
          }}
          onToggleReviewer={() => {
            sound.playClick();
            setMeta((m) => ({ ...m, reviewerAllUnlocked: !m.reviewerAllUnlocked }));
          }}
          onBack={() => setScreen('title')}
        />
      </div>
    );
  }

  if (screen === 'codex') {
    return (
      <div className="app-shell">
        <CodexScreen lang={lang} onBack={() => setScreen(run ? 'run' : 'title')} />
      </div>
    );
  }

  if (!run) {
    setScreen('title');
    return null;
  }

  // === TOP HUD BAR FOR ACTIVE RUN ===
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="hud-left">
          <button type="button" className="brand-btn" onClick={() => setScreen('title')}>
            ⚡ ARC PROTOCOL
          </button>
          <span className="chip cyan">
            {lang === 'ru' ? `Сектор ${run.act}/3` : `Sector ${run.act}/3`}
            {run.overdrive > 0 ? ` · OD-${run.overdrive}` : ''}
          </span>
          <span className="chip rose">
            ❤️ {combat ? combat.player.hp : run.hp}/{run.maxHp}
          </span>
          {combat && combat.player.shield > 0 && (
            <span className="chip emerald">🛡 {combat.player.shield}</span>
          )}
          <span className="chip amber">💰 {run.scrap}</span>
          <span className="chip violet">💎 {meta.shards}</span>
        </div>

        <div className="relic-strip">
          {run.relicIds.map((id) => {
            const rel = RELICS[id];
            if (!rel) return null;
            return (
              <div
                key={id}
                className="relic-pill"
                title={`${lang === 'ru' ? rel.nameRu : rel.nameEn}: ${lang === 'ru' ? rel.descRu : rel.descEn}`}
              >
                {rel.icon}
              </div>
            );
          })}
        </div>

        <div className="top-controls">
          <button type="button" className="btn ghost sm" onClick={() => setDeckModal('deck')}>
            🃏 {run.deck.length}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setScreen('codex')}>
            📚
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
            {lang.toUpperCase()}
          </button>
          <button type="button" className="btn ghost sm" onClick={toggleMute}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* === MAP SCREEN === */}
      {run.screen === 'map' && (
        <SectorMap
          run={run}
          lang={lang}
          onSelectNode={(nodeId) => {
            sound.playClick();
            setRun((r) => (r ? enterMapNode(r, nodeId, meta) : null));
          }}
        />
      )}

      {/* === COMBAT SCREEN === */}
      {run.screen === 'combat' && combat && (
        <div className="combat-layout">
          {combat.tutorialStep > 0 && (
            <div className="tutorial-banner">
              <span>
                {combat.tutorialStep === 1 &&
                  (lang === 'ru'
                    ? '💡 Подсказка 1/3: Красные клетки — зоны атак врагов! Сначала сыграйте «Поставить Реле» на пустую клетку рядом с врагом.'
                    : '💡 Tip 1/3: Red tiles are telegraphed enemy attacks! Play "Deploy Relay" onto an empty tile near an enemy.')}
                {combat.tutorialStep === 2 &&
                  (lang === 'ru'
                    ? '💡 Подсказка 2/3: Отлично! Теперь выберите «Импульс Дуги» и наведите на Реле или врага — молния пройдёт по всей сети!'
                    : '💡 Tip 2/3: Nice! Now select "Arc Spark" and hover a Relay or enemy — lightning chains through the whole circuit!')}
                {combat.tutorialStep === 3 &&
                  (lang === 'ru'
                    ? '💡 Подсказка 3/3: Попробуйте «Гидро-Удар» чтобы толкнуть врага в стену (+3 Slam) или в Пропасть (мгновенная гибель)!'
                    : '💡 Tip 3/3: Try "Piston Strike" to slam an enemy into a wall (+3 Slam) or Pit (instant kill)!')}
              </span>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setMeta((m) => ({ ...m, tutorialCompleted: true }));
                  setRun((r) =>
                    r && r.combat ? { ...r, combat: { ...r.combat, tutorialStep: 0 } } : r
                  );
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="combat-main">
            <div className="arena-column">
              <div className="encounter-bar">
                <strong>
                  {lang === 'ru' ? combat.encounterTitleRu : combat.encounterTitleEn}
                </strong>
                <span>
                  {lang === 'ru' ? `Ход ${combat.turn}` : `Turn ${combat.turn}`} ·{' '}
                  {lang === 'ru' ? `Узлов: ${combat.nodes.length}` : `Nodes: ${combat.nodes.length}`}
                </span>
              </div>

              <ArenaCanvas
                combat={combat}
                validTargets={validTargets}
                hoveredTile={hoveredTile}
                preview={preview}
                lang={lang}
                onHoverTile={setHoveredTile}
                onClickTile={(pos) => handlePlaySelectedCard(pos)}
              />

              <div className="preview-bar">
                {selectedCard ? (
                  preview?.valid ? (
                    <span className="preview-ok">
                      ✨ {lang === 'ru' ? preview.summaryRu : preview.summaryEn}
                      {getCardDef(selectedCard).target === 'none'
                        ? lang === 'ru'
                          ? ' — кликните по арене или ещё раз по карте'
                          : ' — click arena or card again to cast'
                        : lang === 'ru'
                        ? ' — кликните по клетке'
                        : ' — click tile to cast'}
                    </span>
                  ) : (
                    <span className="preview-hint">
                      🎯 {lang === 'ru' ? 'Выберите подсвеченную клетку на арене (Esc — отмена)' : 'Select a highlighted tile on the arena (Esc to cancel)'}
                    </span>
                  )
                ) : (
                  <span className="preview-muted">
                    {lang === 'ru'
                      ? 'Выберите карту ниже (клавиши 1–8) · Наведите на врага для просмотра его зоны удара'
                      : 'Select a card below (keys 1–8) · Hover an enemy to highlight its danger zone'}
                  </span>
                )}
              </div>
            </div>

            <aside className="combat-sidebar">
              <div className="energy-panel">
                <div className="energy-orb">
                  <span className="energy-val">{combat.player.energy}</span>
                  <span className="energy-max">/{combat.player.maxEnergy}</span>
                </div>
                <div className="energy-info">
                  <strong>{lang === 'ru' ? 'Энергия Ядра' : 'Core Energy'}</strong>
                  <span>
                    {combat.player.doubleNext
                      ? lang === 'ru'
                        ? '🪞 КВАНТОВЫЙ ДУБЛЬ АКТИВЕН!'
                        : '🪞 DOUBLE CAST ACTIVE!'
                      : lang === 'ru'
                      ? currentPilot.nameRu
                      : currentPilot.nameEn}
                  </span>
                </div>
                <button type="button" className="btn end-turn-btn" onClick={handleEndTurn}>
                  {lang === 'ru' ? 'КОНЕЦ ХОДА [E]' : 'END TURN [E]'}
                </button>
              </div>

              {selectedCard && getCardDef(selectedCard).target === 'none' && (
                <button
                  type="button"
                  className="btn primary full-w"
                  onClick={() =>
                    handlePlaySelectedCard({ x: combat.player.x, y: combat.player.y })
                  }
                >
                  ⚡ {lang === 'ru' ? `Разыграть «${getCardDef(selectedCard).nameRu}»` : `Cast ${getCardDef(selectedCard).nameEn}`}
                </button>
              )}

              <div className="inspector-box">
                <div className="box-title">{lang === 'ru' ? 'ИНСПЕКТОР КЛЕТКИ' : 'TILE INSPECTOR'}</div>
                {inspectedEnemy ? (
                  <div className="inspect-body">
                    <div className="inspect-head">
                      <span>{inspectedEnemy.icon}</span>
                      <strong>{lang === 'ru' ? inspectedEnemy.nameRu : inspectedEnemy.nameEn}</strong>
                    </div>
                    <div className="inspect-stat">
                      HP: {inspectedEnemy.hp}/{inspectedEnemy.maxHp}
                      {inspectedEnemy.shield > 0 ? ` · 🛡 ${inspectedEnemy.shield}` : ''}
                    </div>
                    <div className="inspect-intent">
                      {lang === 'ru' ? 'Намерение:' : 'Intent:'}{' '}
                      <strong>{lang === 'ru' ? inspectedEnemy.intent.labelRu : inspectedEnemy.intent.labelEn}</strong>
                    </div>
                  </div>
                ) : inspectedNode ? (
                  <div className="inspect-body">
                    <strong>
                      {inspectedNode.kind === 'tesla'
                        ? lang === 'ru'
                          ? '🗼 Катушка Теслы'
                          : '🗼 Tesla Coil'
                        : inspectedNode.kind === 'mine'
                        ? lang === 'ru'
                          ? '💣 Шок-Мина'
                          : '💣 Shock Mine'
                        : lang === 'ru'
                        ? '⚡ Энерго-Реле'
                        : '⚡ Arc Relay'}
                    </strong>
                    <p>
                      {inspectedNode.kind === 'mine'
                        ? lang === 'ru'
                          ? 'Взрывается при наступании или толчке врага: 8+ урона и Оглушение.'
                          : 'Detonates when an enemy steps or is pushed onto it: 8+ dmg & Stun.'
                        : lang === 'ru'
                        ? 'Связывается с узлами на расстоянии ≤2 и усиливает Дуги! Если толкнуть врага в узел — взорвётся!'
                        : 'Links with nodes within dist ≤2 to multiply Arcs! Slamming an enemy into it detonates it!'}
                    </p>
                  </div>
                ) : inspectedTile ? (
                  <div className="inspect-body">
                    <strong>
                      {inspectedTile.terrain === 'pit'
                        ? lang === 'ru'
                          ? '☠ Пропасть Реактора'
                          : '☠ Reactor Pit'
                        : inspectedTile.terrain === 'vent'
                        ? lang === 'ru'
                          ? '🔥 Термальный Люк'
                          : '🔥 Thermal Vent'
                        : inspectedTile.terrain === 'charger'
                        ? lang === 'ru'
                          ? '⚡ Зарядная Плита'
                          : '⚡ Charger Pad'
                        : inspectedTile.terrain === 'pillar'
                        ? lang === 'ru'
                          ? '🧱 Стальная Колонна'
                          : '🧱 Steel Pillar'
                        : lang === 'ru'
                        ? 'Свободная клетка'
                        : 'Open Floor'}
                    </strong>
                    <p>
                      {inspectedTile.terrain === 'pit'
                        ? lang === 'ru'
                          ? 'Сброс обычного врага сюда = мгновенное уничтожение (боссу 12 урона).'
                          : 'Pushing a regular enemy here = instant kill (12 dmg to Boss).'
                        : inspectedTile.terrain === 'vent'
                        ? lang === 'ru'
                          ? 'Наносит 3 урона при толчке на клетку или в конце хода.'
                          : 'Deals 3 burn dmg when pushed onto or ending turn here.'
                        : inspectedTile.terrain === 'charger'
                        ? lang === 'ru'
                          ? 'Старт хода Ядра: +1 Энергия. Реле на этой клетке: +2 к урону Дуги!'
                          : 'Core starts turn here: +1 Energy. Relay placed here: +2 Arc dmg!'
                        : inspectedTile.terrain === 'pillar'
                        ? lang === 'ru'
                          ? 'Блокирует выстрелы; удар врага о колонну даёт +3 урона столкновения.'
                          : 'Blocks line shots; slamming enemies into it deals +3 Slam dmg.'
                        : lang === 'ru'
                        ? 'Подходит для перемещения Ядра и установки Энерго-Реле.'
                        : 'Walkable tile and valid for deploying Arc Relays.'}
                    </p>
                  </div>
                ) : (
                  <p className="inspect-muted">
                    {lang === 'ru'
                      ? 'Наведите курсор на любую клетку, врага или узел на арене.'
                      : 'Hover any tile, enemy, or Relay node on the grid.'}
                  </p>
                )}
              </div>

              <div className="pile-row">
                <button type="button" className="pile-btn" onClick={() => setDeckModal('draw')}>
                  📥 {lang === 'ru' ? 'Добор' : 'Draw'}: <strong>{combat.drawPile.length}</strong>
                </button>
                <button type="button" className="pile-btn" onClick={() => setDeckModal('discard')}>
                  📤 {lang === 'ru' ? 'Сброс' : 'Discard'}: <strong>{combat.discardPile.length}</strong>
                </button>
              </div>

              <div className="combat-log">
                <div className="box-title">{lang === 'ru' ? 'ЖУРНАЛ БОЯ' : 'COMBAT LOG'}</div>
                <div className="log-list">
                  {combat.log
                    .slice(-7)
                    .reverse()
                    .map((line, i) => (
                      <div key={i} className="log-line">
                        {line}
                      </div>
                    ))}
                </div>
              </div>
            </aside>
          </div>

          <section className="hand-tray">
            {combat.hand.map((card, idx) => {
              const cost = getCardCost(card, combat, run.relicIds);
              const playable = combat.phase === 'player' && combat.player.energy >= cost;
              return (
                <CardView
                  key={card.uid}
                  card={card}
                  cost={cost}
                  lang={lang}
                  selected={selectedCardUid === card.uid}
                  playable={playable}
                  hotkey={idx + 1}
                  onClick={() => handleCardClick(card.uid)}
                  onDoubleClick={() => {
                    if (getCardDef(card).target === 'none' && playable) {
                      handlePlaySelectedCard({ x: combat.player.x, y: combat.player.y }, card.uid);
                    }
                  }}
                />
              );
            })}
          </section>
        </div>
      )}

      {/* === REWARD SCREEN === */}
      {run.screen === 'reward' && run.reward && (
        <RewardScreen
          run={run}
          lang={lang}
          onPickCard={(defId) => {
            sound.playClick();
            setRun((r) =>
              r && r.reward
                ? {
                    ...r,
                    deck: [...r.deck, { uid: nextUid('card'), defId, upgraded: false }],
                    reward: { ...r.reward, cardPicked: true },
                  }
                : r
            );
          }}
          onSkipCard={() => {
            sound.playClick();
            setRun((r) =>
              r && r.reward
                ? { ...r, scrap: r.scrap + 20, reward: { ...r.reward, cardPicked: true } }
                : r
            );
          }}
          onPickRelic={(relicId) => {
            sound.playShield();
            setRun((r) =>
              r && r.reward
                ? {
                    ...r,
                    relicIds: [...r.relicIds, relicId],
                    reward: { ...r.reward, relicPicked: true },
                  }
                : r
            );
          }}
          onContinue={() => {
            sound.playClick();
            setRun((r) => (r ? proceedAfterReward(r) : null));
          }}
        />
      )}

      {/* === WORKSHOP SCREEN === */}
      {run.screen === 'workshop' && (
        <WorkshopScreen
          run={run}
          lang={lang}
          onHeal={() => {
            sound.playShield();
            setRun((r) =>
              r
                ? {
                    ...r,
                    hp: Math.min(r.maxHp, r.hp + Math.round(r.maxHp * 0.35)),
                    workshopUsed: true,
                  }
                : null
            );
          }}
          onUpgradeCard={(uid) => {
            sound.playVictory();
            setRun((r) =>
              r
                ? {
                    ...r,
                    deck: r.deck.map((c) => (c.uid === uid ? { ...c, upgraded: true } : c)),
                    workshopUsed: true,
                  }
                : null
            );
          }}
          onPurgeCard={(uid) => {
            sound.playClick();
            setRun((r) =>
              r
                ? {
                    ...r,
                    deck: r.deck.filter((c) => c.uid !== uid),
                    workshopUsed: true,
                  }
                : null
            );
          }}
          onLeave={() => {
            sound.playClick();
            setRun((r) => (r ? { ...r, screen: 'map' } : null));
          }}
        />
      )}

      {/* === SHOP SCREEN === */}
      {run.screen === 'shop' && (
        <ShopScreen
          run={run}
          lang={lang}
          onBuyItem={(itemId) => {
            setRun((r) => {
              if (!r || !r.shopItems) return r;
              const item = r.shopItems.find((i) => i.id === itemId);
              if (!item || item.sold || r.scrap < item.price) return r;
              sound.playClick();
              const next: RunState = structuredClone(r);
              next.scrap -= item.price;
              const slot = next.shopItems!.find((i) => i.id === itemId)!;
              slot.sold = true;
              if (item.kind === 'card' && item.defId) {
                next.deck.push({ uid: nextUid('card'), defId: item.defId, upgraded: false });
              } else if (item.kind === 'relic' && item.defId) {
                next.relicIds.push(item.defId);
              } else if (item.kind === 'heal') {
                next.hp = Math.min(next.maxHp, next.hp + 14);
              }
              return next;
            });
          }}
          onBuyPurge={(itemId, cardUid) => {
            setRun((r) => {
              if (!r || !r.shopItems) return r;
              const item = r.shopItems.find((i) => i.id === itemId);
              if (!item || item.sold || r.scrap < item.price) return r;
              sound.playClick();
              const next: RunState = structuredClone(r);
              next.scrap -= item.price;
              next.shopItems!.find((i) => i.id === itemId)!.sold = true;
              next.deck = next.deck.filter((c) => c.uid !== cardUid);
              return next;
            });
          }}
          onLeave={() => {
            sound.playClick();
            setRun((r) => (r ? { ...r, screen: 'map', shopItems: null } : null));
          }}
        />
      )}

      {/* === EVENT SCREEN === */}
      {run.screen === 'event' && (
        <EventScreen
          run={run}
          lang={lang}
          onChoose={(choiceId) => {
            sound.playClick();
            const res = resolveEventChoice(run, choiceId);
            if (res.bonusShards > 0) {
              setMeta((m) => ({ ...m, shards: m.shards + res.bonusShards }));
            }
            setRun(res.run);
          }}
          onLeave={() => {
            sound.playClick();
            setRun((r) => (r ? { ...r, screen: 'map', activeEventId: null } : null));
          }}
        />
      )}

      {/* === RUN SUMMARY SCREEN === */}
      {run.screen === 'summary' && (
        <SummaryScreen
          run={run}
          shardsEarned={lastRunShards}
          lang={lang}
          onNewRun={() => startNewRun(run.pilotId, run.overdrive)}
          onOpenLab={() => setScreen('lab')}
          onTitle={() => {
            setRun(null);
            setScreen('title');
          }}
        />
      )}

      {/* === DECK / PILE MODAL === */}
      {deckModal && (
        <DeckModal
          title={
            deckModal === 'deck'
              ? lang === 'ru'
                ? 'Полная колода'
                : 'Full Deck'
              : deckModal === 'draw'
              ? lang === 'ru'
                ? 'Стопка добора'
                : 'Draw Pile'
              : lang === 'ru'
              ? 'Стопка сброса'
              : 'Discard Pile'
          }
          cards={
            deckModal === 'deck'
              ? run.deck
              : deckModal === 'draw'
              ? combat?.drawPile ?? []
              : combat?.discardPile ?? []
          }
          lang={lang}
          onClose={() => setDeckModal(null)}
        />
      )}
    </div>
  );
}
