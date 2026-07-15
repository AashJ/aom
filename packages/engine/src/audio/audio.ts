import {
  GOD_RA,
  GOD_ZEUS,
  NEUTRAL_OWNER,
  TYPE_BARRACKS,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_HOUSE,
  TYPE_MILITIA,
  TYPE_TOWN_CENTER,
  TYPE_TREE,
  TYPE_VILLAGER,
  UNIT_TYPES,
  type RenderSnapshot,
} from "@aom/sim";
import {
  AUDIO_CUES,
  CULTURE_MUSIC_TRACKS,
  EGYPTIAN_VILLAGER_CUES,
  MUSIC_TRACKS,
  type AudioCue,
} from "./assets";

const BATTLE_HOLD_MS = 20_000;
const AMBIENT_MIN_MS = 9_000;
const AMBIENT_SPREAD_MS = 8_000;

type CommandMarkerKind = 1 | 2 | 3 | 4;
type MusicPhase = "battle" | "culture" | "peaceful";

interface EntityAudioState {
  buildProgress: number;
  hp: number;
  owner: number;
  type: number;
  visible: boolean;
  x: number;
  z: number;
}

export interface GameAudio {
  acknowledge(
    kind: CommandMarkerKind,
    selectedX: number,
    selectedZ: number,
    resourceType?: number,
  ): void;
  dispose(): void;
  matchEnd(won: boolean): void;
  setActive(active: boolean): void;
  sync(
    snapshot: RenderSnapshot,
    selfPlayerId: number,
    listenerX: number,
    listenerZ: number,
    viewDirX: number,
    viewDirZ: number,
  ): void;
  uiClick(): void;
}

export function createGameAudio(majorGod = GOD_ZEUS): GameAudio {
  const context = new AudioContext();
  const masterGain = context.createGain();
  const effectsGain = context.createGain();
  const interfaceGain = context.createGain();
  const voicesGain = context.createGain();
  const bufferCache = new Map<string, Promise<AudioBuffer>>();
  const cueActiveCounts = new Map<AudioCue, number>();
  const cueVariation = new Map<AudioCue, number>();
  const activeSources = new Set<AudioBufferSourceNode>();
  let entities = new Map<number, EntityAudioState>();
  let active = false;
  let disposed = false;
  let initialized = false;
  let unlocked = false;
  let unlockPromise: Promise<void> | null = null;
  let lastSelectedId = -1;
  let listenerX = 0;
  let listenerZ = 0;
  let listenerRightX = 1;
  let listenerRightZ = 0;
  let ambientTimer = 0;
  let battleUntil = 0;
  let musicPhase: MusicPhase = "culture";
  let peacefulTrack = 0;
  let battleTrack = 0;
  const villagerCues =
    majorGod === GOD_RA ? { ...AUDIO_CUES, ...EGYPTIAN_VILLAGER_CUES } : AUDIO_CUES;
  const cultureMusic =
    majorGod === GOD_RA ? CULTURE_MUSIC_TRACKS.egyptian : CULTURE_MUSIC_TRACKS.greek;

  masterGain.gain.value = 0.8;
  effectsGain.gain.value = 0.78;
  interfaceGain.gain.value = 0.7;
  voicesGain.gain.value = 0.9;
  effectsGain.connect(masterGain);
  interfaceGain.connect(masterGain);
  voicesGain.connect(masterGain);
  masterGain.connect(context.destination);

  const music = new Audio();
  music.preload = "metadata";
  music.volume = 0.34;

  function bufferFor(url: string): Promise<AudioBuffer> {
    let buffer = bufferCache.get(url);

    if (!buffer) {
      buffer = fetch(url).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load audio ${url}: ${response.status}`);
        }

        return context.decodeAudioData(await response.arrayBuffer());
      });
      bufferCache.set(url, buffer);
    }

    return buffer;
  }

  function nextFile(cue: AudioCue): string {
    const index = cueVariation.get(cue) ?? 0;

    cueVariation.set(cue, index + 1);
    return cue.files[index % cue.files.length]!;
  }

  function stopEffects(): void {
    for (const source of activeSources) {
      source.stop();
    }

    activeSources.clear();
    cueActiveCounts.clear();
  }

  function playCue(cue: AudioCue, destination: AudioNode, x?: number, z?: number): void {
    if (!active || disposed || cue.files.length === 0) {
      return;
    }

    const activeCount = cueActiveCounts.get(cue) ?? 0;

    if (activeCount >= cue.maxVoices) {
      return;
    }

    cueActiveCounts.set(cue, activeCount + 1);
    const url = nextFile(cue);

    void unlock()
      .then(() => bufferFor(url))
      .then((buffer) => {
        if (!active || disposed) {
          cueActiveCounts.set(cue, Math.max(0, (cueActiveCounts.get(cue) ?? 1) - 1));
          return;
        }

        const source = context.createBufferSource();
        const gain = context.createGain();

        source.buffer = buffer;
        gain.gain.value = cue.volume;
        source.connect(gain);

        if (x === undefined || z === undefined) {
          gain.connect(destination);
        } else {
          const dx = x - listenerX;
          const dz = z - listenerZ;
          const distance = Math.sqrt(dx * dx + dz * dz);
          const panner = context.createStereoPanner();

          panner.pan.value = Math.max(
            -1,
            Math.min(1, (dx * listenerRightX + dz * listenerRightZ) / 22),
          );
          gain.gain.value *= Math.max(0.12, 1 - distance / 72);
          gain.connect(panner);
          panner.connect(destination);
        }

        source.addEventListener(
          "ended",
          () => {
            activeSources.delete(source);
            cueActiveCounts.set(cue, Math.max(0, (cueActiveCounts.get(cue) ?? 1) - 1));
          },
          { once: true },
        );
        activeSources.add(source);
        source.start();
      })
      .catch((error: unknown) => {
        cueActiveCounts.set(cue, Math.max(0, (cueActiveCounts.get(cue) ?? 1) - 1));
        console.warn("Unable to play game audio.", error);
      });
  }

  function musicUrlForPhase(): string {
    if (musicPhase === "culture") {
      return cultureMusic;
    }

    if (musicPhase === "battle") {
      const url = MUSIC_TRACKS.battle[battleTrack % MUSIC_TRACKS.battle.length]!;

      battleTrack += 1;
      return url;
    }

    const url = MUSIC_TRACKS.peaceful[peacefulTrack % MUSIC_TRACKS.peaceful.length]!;

    peacefulTrack += 1;
    return url;
  }

  function playNextMusicTrack(): void {
    if (!active || !unlocked || disposed) {
      return;
    }

    if (musicPhase === "battle" && performance.now() >= battleUntil) {
      musicPhase = "peaceful";
    } else if (musicPhase === "culture") {
      musicPhase = "peaceful";
    }

    music.src = musicUrlForPhase();
    music.currentTime = 0;
    music.volume = musicPhase === "battle" ? 0.38 : 0.34;
    void music.play().catch((error: unknown) => {
      console.warn("Unable to play game music.", error);
    });
  }

  function startMusic(): void {
    if (!active || !unlocked || disposed) {
      return;
    }

    if (musicPhase === "battle" && performance.now() >= battleUntil) {
      musicPhase = "peaceful";
    }

    if (music.src === "") {
      music.src = musicUrlForPhase();
      music.currentTime = 0;
    }

    void music.play().catch((error: unknown) => {
      console.warn("Unable to play game music.", error);
    });
  }

  function scheduleAmbient(): void {
    window.clearTimeout(ambientTimer);

    if (!active || !unlocked || disposed) {
      return;
    }

    const delay = AMBIENT_MIN_MS + Math.random() * AMBIENT_SPREAD_MS;

    ambientTimer = window.setTimeout(() => {
      playCue(AUDIO_CUES.ambient, effectsGain);
      scheduleAmbient();
    }, delay);
  }

  function preloadEffects(): void {
    for (const cue of Object.values(villagerCues)) {
      for (const url of cue.files) {
        void bufferFor(url).catch(() => undefined);
      }
    }
  }

  function removeUnlockListeners(): void {
    window.removeEventListener("pointerdown", onInteraction, true);
    window.removeEventListener("keydown", onInteraction, true);
  }

  function unlock(): Promise<void> {
    if (unlocked || disposed) {
      return Promise.resolve();
    }

    if (!unlockPromise) {
      unlockPromise = context
        .resume()
        .then(() => {
          if (disposed) {
            return;
          }

          if (context.state !== "running") {
            throw new Error("Audio playback is still locked by the browser.");
          }

          unlocked = true;
          removeUnlockListeners();
          startMusic();
          preloadEffects();
          scheduleAmbient();
        })
        .finally(() => {
          unlockPromise = null;
        });
    }

    return unlockPromise;
  }

  function onInteraction(): void {
    void unlock().catch(() => undefined);
  }

  function enterBattle(): void {
    battleUntil = Math.max(battleUntil, performance.now() + BATTLE_HOLD_MS);

    if (musicPhase === "battle") {
      return;
    }

    musicPhase = "battle";

    if (!unlocked) {
      return;
    }

    music.pause();
    music.src = musicUrlForPhase();
    music.currentTime = 0;
    music.volume = 0.38;
    void music.play().catch((error: unknown) => {
      console.warn("Unable to play battle music.", error);
    });
  }

  function playBuildingCue(type: number, x: number, z: number): void {
    if (type === TYPE_TOWN_CENTER) {
      playCue(AUDIO_CUES.settlement, effectsGain, x, z);
    } else if (type === TYPE_HOUSE) {
      playCue(AUDIO_CUES.house, effectsGain, x, z);
    } else if (type === TYPE_BARRACKS) {
      playCue(AUDIO_CUES.barracks, effectsGain, x, z);
    }
  }

  function playGatherCue(type: number, x: number, z: number): void {
    if (type === TYPE_TREE) {
      playCue(AUDIO_CUES.chop, effectsGain, x, z);
    } else if (type === TYPE_GOLD_MINE) {
      playCue(AUDIO_CUES.mine, effectsGain, x, z);
    } else if (type === TYPE_BERRY) {
      playCue(AUDIO_CUES.forage, effectsGain, x, z);
    }
  }

  function playSelectionCue(type: number, x: number, z: number): void {
    if (type === TYPE_VILLAGER) {
      playCue(villagerCues.villagerSelect, voicesGain, x, z);
      return;
    }

    if (type === TYPE_MILITIA) {
      playCue(AUDIO_CUES.villagerSelect, voicesGain, x, z);
      return;
    }

    playBuildingCue(type, x, z);
  }

  function playRemovalCue(state: EntityAudioState): void {
    if (!state.visible) {
      return;
    }

    if (state.type === TYPE_TREE) {
      playCue(AUDIO_CUES.chop, effectsGain, state.x, state.z);
      playCue(AUDIO_CUES.treeFall, effectsGain, state.x, state.z);
      return;
    }

    if (state.type === TYPE_BERRY || state.type === TYPE_GOLD_MINE) {
      playGatherCue(state.type, state.x, state.z);
      return;
    }

    if (state.type === TYPE_VILLAGER || state.type === TYPE_MILITIA) {
      playCue(AUDIO_CUES.maleDeath, voicesGain, state.x, state.z);
      enterBattle();
      return;
    }

    if (UNIT_TYPES[state.type]!.footprint > 0) {
      playCue(AUDIO_CUES.buildingDeath, effectsGain, state.x, state.z);
      enterBattle();
    }
  }

  function sync(
    snapshot: RenderSnapshot,
    selfPlayerId: number,
    nextListenerX: number,
    nextListenerZ: number,
    viewDirX: number,
    viewDirZ: number,
  ): void {
    listenerX = nextListenerX;
    listenerZ = nextListenerZ;
    const viewLength = Math.sqrt(viewDirX * viewDirX + viewDirZ * viewDirZ);

    if (viewLength > 0) {
      listenerRightX = -viewDirZ / viewLength;
      listenerRightZ = viewDirX / viewLength;
    }

    const nextEntities = new Map<number, EntityAudioState>();
    let selectedId = -1;
    let selectedType = -1;
    let selectedX = 0;
    let selectedZ = 0;

    for (let i = 0; i < snapshot.count; i += 1) {
      const id = snapshot.ids[i]!;
      const type = snapshot.unitType[i]!;
      const state: EntityAudioState = {
        buildProgress: snapshot.buildProgress[i]!,
        hp: snapshot.hp[i]!,
        owner: snapshot.owner[i]!,
        type,
        visible: snapshot.visible[i] === 1,
        x: snapshot.posX[i]!,
        z: snapshot.posZ[i]!,
      };
      const previous = entities.get(id);

      nextEntities.set(id, state);

      if (selectedId === -1 && snapshot.selected[i] === 1) {
        selectedId = id;
        selectedType = type;
        selectedX = state.x;
        selectedZ = state.z;
      }

      if (!initialized || !state.visible) {
        continue;
      }

      if (!previous) {
        if (state.owner === selfPlayerId && type === TYPE_VILLAGER) {
          playCue(AUDIO_CUES.villagerCreate, voicesGain, state.x, state.z);
        } else if (state.owner === selfPlayerId && type === TYPE_MILITIA) {
          playCue(AUDIO_CUES.militaryCreate, voicesGain, state.x, state.z);
        }

        continue;
      }

      if (state.hp < previous.hp) {
        if (UNIT_TYPES[type]!.resource >= 0) {
          playGatherCue(type, state.x, state.z);
        } else {
          playCue(AUDIO_CUES.swordSwing, effectsGain, state.x, state.z);
          playCue(
            UNIT_TYPES[type]!.footprint > 0 ? AUDIO_CUES.woodHit : AUDIO_CUES.fleshHit,
            effectsGain,
            state.x,
            state.z,
          );

          if (state.owner !== NEUTRAL_OWNER) {
            enterBattle();
          }
        }
      }

      if (state.buildProgress > previous.buildProgress) {
        playCue(AUDIO_CUES.build, effectsGain, state.x, state.z);

        const buildTicks = UNIT_TYPES[type]!.buildTicks;

        if (previous.buildProgress < buildTicks && state.buildProgress >= buildTicks) {
          playBuildingCue(type, state.x, state.z);
        }
      }
    }

    if (initialized) {
      for (const [id, state] of entities) {
        if (!nextEntities.has(id)) {
          playRemovalCue(state);
        }
      }
    }

    if (selectedId !== lastSelectedId) {
      lastSelectedId = selectedId;

      if (selectedId !== -1) {
        playSelectionCue(selectedType, selectedX, selectedZ);
      }
    }

    entities = nextEntities;
    initialized = true;
  }

  function acknowledge(
    kind: CommandMarkerKind,
    selectedX: number,
    selectedZ: number,
    resourceType?: number,
  ): void {
    let cue = villagerCues.villagerAcknowledge;

    if (kind === 2) {
      cue = villagerCues.villagerAttack;
    } else if (kind === 3 && resourceType === TYPE_TREE) {
      cue = villagerCues.villagerLumber;
    } else if (kind === 3 && resourceType === TYPE_GOLD_MINE) {
      cue = villagerCues.villagerMine;
    } else if (kind === 3 && resourceType === TYPE_BERRY) {
      cue = villagerCues.villagerForage;
    } else if (kind === 4) {
      cue = villagerCues.villagerRepair;
    }

    playCue(cue, voicesGain, selectedX, selectedZ);
  }

  function setActive(nextActive: boolean): void {
    active = nextActive;

    if (!active) {
      window.clearTimeout(ambientTimer);
      music.pause();
      stopEffects();
      return;
    }

    startMusic();
    scheduleAmbient();
  }

  function dispose(): void {
    if (disposed) {
      return;
    }

    disposed = true;
    active = false;
    removeUnlockListeners();
    window.clearTimeout(ambientTimer);
    music.pause();
    music.removeAttribute("src");
    music.load();
    stopEffects();
    void context.close();
  }

  music.addEventListener("ended", playNextMusicTrack);
  window.addEventListener("pointerdown", onInteraction, true);
  window.addEventListener("keydown", onInteraction, true);

  return {
    acknowledge,
    dispose,
    matchEnd(won: boolean): void {
      playCue(won ? AUDIO_CUES.victory : AUDIO_CUES.defeat, interfaceGain);
      music.volume = 0.12;
    },
    setActive,
    sync,
    uiClick(): void {
      playCue(AUDIO_CUES.interfaceClick, interfaceGain);
    },
  };
}
