'use strict';
/* Marko am Schauinsland – Schritt 1: Gerüst, Loop, Steuerung, Parallax, Timer, Albert
   Schritt 2: Hindernisse und Zeitstrafen */

// =====================================================================
// Konfiguration
// =====================================================================
const W = 320, H = 180;
const STEP = 1 / 60;                                 // fixed timestep

const REAL_DURATION = 90;                            // Sekunden Realzeit ...
const GAME_DURATION = 40 * 60;                       // ... entsprechen 40 Spielminuten
const TIME_SCALE = GAME_DURATION / REAL_DURATION;    // Spielsekunden pro Realsekunde
const TRACK_LEN = 12000;                             // Meter bis zum Gipfel

const CHECKPOINTS = [
  { name: 'Günterstal', at: 0.15 },
  { name: 'Horben',     at: 0.42 },
  { name: 'Kappel',     at: 0.70 },
  { name: 'Gipfel',     at: 1.00 },
];

// Marko: Die Höchstgeschwindigkeit wirkt großzügig (Ankunft bei ~36:30) ...
const MARKO_VMAX = TRACK_LEN / 82;                   // m pro Realsekunde
// ... aber eine unsichtbare "Gegenwind-Linie" kommt frühestens bei 40:01 oben an.
// Marko kann sie nie überholen, damit ist 40:00 mathematisch unmöglich.
const GUARD_ARRIVAL = REAL_DURATION + 0.05;
const CADENCE_FULL = 6.5;                            // Tritte pro Sekunde für Vollgas
const ACCEL = 1.6, DECEL = 0.8;

// Albert
const ALBERT_TARGET = (38 * 60 + 30) / TIME_SCALE;   // 38:30 in Realsekunden
const ALBERT_BASE = TRACK_LEN / ALBERT_TARGET;       // m pro Realsekunde
const GAP_REF = TRACK_LEN / (38 * 60 + 30);          // m pro Spielsekunde (Umrechnung Abstand -> Sekunden)
const GAP_MIN = 0.3;                                 // Spielsekunden – näher kommt Marko nie

// Hindernisse: kommen von rechts in Markos Spur. cow/hiker/pothole/sign_umleitung
// kosten bei Kollision Tempo + eine Zeitstrafe; ebike_opa überholt nie, fährt nur vor Marko;
// (kostenlos, aber Albert kommentiert). Albert selbst wird nie geprüft – ihn
// trifft nie ein Hindernis ("die Kühe weichen ihm aus").
const OBSTACLE_PENALTY = { cow: 10, hiker: 6, pothole: 8, sign_umleitung: 12 };  // Spielsekunden
const OBSTACLE_TRIGGER = { cow: 'hit_cow', hiker: 'hit_hiker', pothole: 'hit_pothole', sign_umleitung: 'marko_stürzt' };
const OBSTACLE_TYPES = Object.keys(OBSTACLE_PENALTY);
const OVERTAKE_TYPES = ['ebike_opa'];             // fährt vor Marko, überholt nie, wird nur langsam eingeholt
// Mindestabstand zweier Hindernisse in Metern, an Markos Höchsttempo bemessen –
// so bleibt bei jedem Tempo genug Reaktionszeit zum Ausweichen (nie zwei direkt hintereinander).
const OBSTACLE_GAP_MIN = MARKO_VMAX * 1.6;
const OBSTACLE_GAP_EXTRA = MARKO_VMAX * 1.3;
const OBSTACLE_HALF = { cow: 0.5, hiker: 0.3, pothole: 0.45, sign_umleitung: 0.3 };  // halbe Breite in Spuren (±1 = Straßenrand)
const MARKO_HALF = 0.15;
// E-Bike-Modus (Leertaste halten): Zusatztempo ohne Tippen. Der Guard gilt weiter.
const MODES = ['AUS', 'ECO', 'TOUR', 'SPORT', 'TURBO'];
const MODE_BOOST = [0, 0.08, 0.15, 0.25, 0.35];      // Zusatztempo (der Guard cappt trotzdem)
const MODE_DRAIN = [0, 2.5, 5, 11, 20];              // Akku in % pro Sekunde (TURBO: ~5 s)
const MODE_SHAME = [0, 1, 2, 4, 8];                  // PEINLICH pro Sekunde
const MODE_COLOR = ['#8a8a8a', '#3c3', '#3a7bff', '#f90', '#f33'];
const MODE_KEYS = ['aus', 'eco', 'tour', 'sport', 'turbo'];
const SHAME_SWITCH = 10;                             // PEINLICH pro Umschalten
const MOTOR_RECHARGE = 40;                           // Sekunden von 0 auf 100 % (nur in AUS)
const MSG_TIME = 2;
const MOTOR_PENALTY = 30;                            // Spielsekunden (+0:30)
const PEN_SHOW = 1.3, TOAST_TIME = 3;

// Lenken: Kurven drücken Marko nach außen, Abseits der Straße (|x| > 1) bremst
const STEER_RATE = 2.4;                              // Spuren pro Sekunde bei vollem Tempo
const CENTRIF_K = 10;
const OFFROAD_MUL = 0.45, X_MAX = 2.2;
const EBIKE_SPEED = 65;                              // m pro Realsekunde
const HIT_BLINK_TIME = 0.6;
const SHAKE_TIME = 0.35;

// Sprechblasen
const BUBBLE_TIME = 2.6;
const SPEECH_COOLDOWN = 5;

// Darstellung: Pseudo-3D (Blick vom Lenker). Sichtmeter = Streckenmeter * VIS.
const VIS = 0.5;               // dämpft das Tempogefühl (Marko fährt real ~130 m/s)
const HOR = 66;                // Horizont-Zeile
const CAM_H = 1.3;             // Augenhöhe in Sichtmetern
const FOCAL = 430;             // Brennweite in px
const ROAD_HW = 3.0;           // halbe Straßenbreite in Metern
const ALBERT_MIN_PX = 12;      // Albert bleibt in der Ferne als Figur erkennbar
const DRAW_D = 260;            // Sichtweite in Sichtmetern
const BAR_X = 74, BAR_W = 236, BAR_Y = 6;

const BEST_KEY = 'marko-schauinsland-bestzeit';

// Rage-Bait-Events: jedes genau einmal pro Run, ausgelöst an festen Streckenpunkten (in Metern)
const MAX_RESULT = 41 * 60 + 30;                     // Ergebnis liegt immer zwischen 40:01 und 41:30

const SHORTCUT_POS = 0.25 * TRACK_LEN;               // 1. Fake-Abkürzung
const SHORTCUT_ZONE = 140;                           // m vor dem Schild, in denen nach links lenken = abbiegen
const SC_SPEED = 160;                                // Scroll-px/s auf dem Feldweg
const SC_DEAD = 260;                                 // Scroll-px bis zur Sackgasse
const SC_PENALTY = 180 / TIME_SCALE;                 // +3 Spielminuten in Realsekunden (6,75 s)
const SC_WAIT = SC_PENALTY - 2 * SC_DEAD / SC_SPEED; // Standzeit in der Sackgasse

const WIND_POS = 0.40 * TRACK_LEN;                   // 2. Rückenwind-Pickup
const BOOST_T = 3, BOOST_MUL = 1.6;
const HEAD_T = 4, HEAD_MUL = 0.5;

const GUST_POS = 0.58 * TRACK_LEN;                   // 3. Seitenwind-Böe: Lenkung 3 s vertauscht
const GUST_T = 3;

const GARMIN_POS = 0.82 * TRACK_LEN;                 // 4. Garmin-Akku
const GARMIN_DRAIN = 7, GARMIN_BLACK = 1, GARMIN_LOW = 2.5;

const FAKE_WIN_T = 89.7;                             // 5. Fake-Sieg ab 39:52 ...
const FAKE_WIN_POS = 0.965 * TRACK_LEN;              // ... wenn Marko praktisch oben ist
const FAKE_FLIP = 2.8, FAKE_END = 5.6;               // Sekunden im State FAKE_WIN

const APOC_T = 5.6;                                  // Dauer der Apokalypse-Szene (Sekunden)
const TICKER_TEXT = 'EILMELDUNG: Asteroid nähert sich. Experten: egal.';
const ARCH_NEAR = 120;                               // 6. ab hier (m) rückt der Zielbogen weg

// =====================================================================
// Canvas & Skalierung
// =====================================================================
const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const uiCanvas = document.getElementById('ui');
const u = uiCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() {
  let s = Math.min(innerWidth / W, innerHeight / H);
  if (s >= 2) s = Math.floor(s);                     // ganzzahlig = saubere Pixel
  stage.style.width = W * s + 'px';
  stage.style.height = H * s + 'px';
  const dpr = window.devicePixelRatio || 1;
  uiCanvas.width = Math.round(W * s * dpr);
  uiCanvas.height = Math.round(H * s * dpr);
  u.setTransform(uiCanvas.width / W, 0, 0, uiCanvas.height / H, 0, 0);
}
addEventListener('resize', resize);
resize();

// =====================================================================
// Hilfsfunktionen
// =====================================================================
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const mm = Math.floor(sec / 60), ss = sec % 60;
  return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}
const fmtNum = (v, d = 1) => v.toFixed(d).replace('.', ',');

function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

// Text auf der hochauflösenden UI-Ebene (Koordinaten wie im 320x180-Spiel)
function text(str, x, y, { size = 8, color = '#fff', align = 'left', shadow = true, bold = true } = {}) {
  u.font = `${bold ? 'bold ' : ''}${size}px "Courier New", monospace`;
  u.textAlign = align;
  u.textBaseline = 'top';
  if (shadow) { u.fillStyle = 'rgba(0,0,0,0.85)'; u.fillText(str, x + 0.7, y + 0.7); u.fillText(str, x + 0.7, y); u.fillText(str, x, y + 0.7); }
  u.fillStyle = color;
  u.fillText(str, x, y);
}

// =====================================================================
// Sound (WebAudio Chiptune-Beeps)
// =====================================================================
const Sfx = {
  ctx: null,
  muted: false,
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, { type = 'square', vol = 0.06, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },
  pedal(side) { this.tone(side === 'left' ? 180 : 215, 0.04, { type: 'triangle', vol: 0.06 }); },
  miss()      { this.tone(90, 0.07, { vol: 0.03 }); },
  jump()      { this.tone(300, 0.15, { slide: 400, vol: 0.05 }); },
  count()     { this.tone(440, 0.12); },
  go()        { this.tone(880, 0.35); },
  checkpoint(){ [523, 659, 784].forEach((f, i) => this.tone(f, 0.1, { delay: i * 0.08 })); },
  talk()      { for (let i = 0; i < 4; i++) this.tone(260 + Math.random() * 240, 0.05, { delay: i * 0.065, vol: 0.035 }); },
  end()       { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, { delay: i * 0.2, type: 'triangle', vol: 0.08 })); },
  modeBeep(n) { this.tone(260 + n * 130, 0.12, { type: 'square', vol: 0.05 }); },
  motor()     { this.tone(90 + Math.random() * 12, 0.1, { type: 'sawtooth', vol: 0.03 }); },
  boom()      { this.tone(70, 1.4, { slide: -40, type: 'sawtooth', vol: 0.12 }); this.tone(45, 1.8, { type: 'square', vol: 0.08, delay: 0.2 }); },
  pickup()    { [660, 880, 1175].forEach((f, i) => this.tone(f, 0.08, { delay: i * 0.05 })); },
  windDown()  { this.tone(400, 0.5, { slide: -300, type: 'sawtooth', vol: 0.05 }); },
  crash()     { this.tone(140, 0.3, { slide: -100, type: 'sawtooth', vol: 0.08 }); },
  alert()     { [988, 740].forEach((f, i) => this.tone(f, 0.1, { delay: i * 0.12, vol: 0.05 })); },
  lowBat()    { this.tone(1200, 0.06, { vol: 0.05 }); },
  fanfare()   { [523, 523, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, { delay: i * 0.1, vol: 0.07 })); },
  scratch()   { this.tone(900, 0.25, { slide: -800, type: 'sawtooth', vol: 0.07 }); this.tone(120, 0.5, { delay: 0.3, type: 'triangle', vol: 0.09 }); },
};

// =====================================================================
// Eingabe: Tastatur + Touch/Maus. Ergebnis sind Aktionen in einer Queue.
// =====================================================================
const actions = [];
let isTouch = false;

const KEYMAP = {
  KeyA: 'left', KeyD: 'right',                       // abwechselnd = treten
  Space: 'confirm', Enter: 'confirm',
  KeyR: 'restart',
  KeyM: 'mute',
};
const steerKeys = { left: false, right: false };     // Pfeiltasten gehalten = lenken

addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    e.preventDefault();
    Sfx.unlock();
    steerKeys[e.code === 'ArrowLeft' ? 'left' : 'right'] = true;
    if (!e.repeat) actions.push('confirm');          // "Beliebige Taste zum Start"
    return;
  }
  if (e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); if (!e.repeat) actions.push('mode'); }   // Motormodus durchschalten
  if (e.metaKey || e.ctrlKey || e.altKey || /^(Shift|Control|Alt|Meta|F\d+|Tab)/.test(e.code)) return;
  const act = KEYMAP[e.code] || 'confirm';
  e.preventDefault();
  if (e.repeat) return;                              // gedrückt halten zählt nicht
  Sfx.unlock();
  if (act === 'mute') { Sfx.muted = !Sfx.muted; return; }
  actions.push(act);
});
addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft') steerKeys.left = false;
  if (e.code === 'ArrowRight') steerKeys.right = false;
});

// Touch ist vorerst nicht belegt; ein Klick/Tippen startet nur das Spiel
addEventListener('pointerdown', (e) => {
  Sfx.unlock();
  actions.push('confirm');
  e.preventDefault();
}, { passive: false });
addEventListener('contextmenu', (e) => e.preventDefault());

// =====================================================================
// Sprites: Billboards (64x64, Boden unten mittig) in der Pseudo-3D-Straße.
// Alle PNGs werden vorab geladen (Preloader im LOADING-Zustand). Die Frame-Größe
// kommt immer aus img.height (Frames liegen nebeneinander, Breite = Höhe).
// Gezeichnet wird skaliert nach Entfernung, ohne Glättung (nearest neighbor).
// Das Schlagloch (pothole) ist nie ein PNG, sondern eine per Code gezeichnete,
// perspektivisch skalierte dunkle Ellipse.
// =====================================================================
const ASSET_FILES = {};
// Animierte Figuren: je zwei Frames <name>_1 / <name>_2; sign_front und marko_ride (Titel-Streifen) statisch
for (const n of ['albert_back', 'ebike_back', 'hiker_back', 'cow_front']) {
  ASSET_FILES[n + '_1'] = n + '_1.png';
  ASSET_FILES[n + '_2'] = n + '_2.png';
}
ASSET_FILES.sign_front = 'sign_front.png';
ASSET_FILES.marko_ride = 'marko_ride.png';
for (const n of ['tree', 'tree_burning', 'meteor', 'tower', 'banana', 'marko_cry', 'albert_chair']) ASSET_FILES[n] = n + '.png';
// crack.png und pothole.png werden nie geladen: Risse und Schlaglöcher zeichnet der Code
// Umschaltzeit der beiden Frames in Sekunden (Albert wird mit seinem Tempo schneller)
const ANIM_PERIOD = { albert_back: 0.15, ebike_back: 0.15, hiker_back: 0.3, cow_front: 0.3 };
const BILLBOARD_H = { banana: 1.0, meteor: 5, tower: 20,  albert_back: 2.1, ebike_back: 2.1, hiker_back: 2.0, cow_front: 2.2, sign_front: 2.6 };  // Höhe in Sichtmetern
const SPRITE_OF = { cow: 'cow_front', hiker: 'hiker_back', sign_umleitung: 'sign_front', ebike_opa: 'ebike_back' };
const FALLBACK_COLOR = { albert_back: '#27d', ebike_back: '#888', hiker_back: '#7a5b3a', cow_front: '#eee', sign_front: '#f2d34a' };

const IMAGES = {};
let assetsToLoad = 0, assetsLoaded = 0;
for (const [name, file] of Object.entries(ASSET_FILES)) {
  assetsToLoad++;
  const img = new Image();
  img.onload = img.onerror = () => { assetsLoaded++; };   // onerror zählt auch, damit ein fehlendes PNG nicht ewig blockiert
  img.src = `assets/${file}`;
  IMAGES[name] = img;
}
function assetsReady() { return assetsLoaded >= assetsToLoad; }

// Zeichnet ein Billboard mit Größe s (px) und Anker unten mittig bei (x, yBase).
// phase schaltet bei Figuren die beiden Frames um (gerade/ungerade); fehlt ein Frame,
// wird der andere weiterverwendet. Dazu ±1 px Auf und Ab im selben Takt.
function drawBillboard(name, x, yBase, s, phase = 0) {
  s = Math.round(s);
  if (s < 2) return;
  const ok = (im) => im && im.complete && im.naturalWidth;
  const want = Math.floor(phase) % 2;
  const f1 = IMAGES[name + '_' + (want + 1)], f2 = IMAGES[name + '_' + (2 - want)];
  const animated = !!(IMAGES[name + '_1'] || IMAGES[name + '_2']);
  const img = ok(f1) ? f1 : ok(f2) ? f2 : IMAGES[name];
  x = Math.round(x); yBase = Math.round(yBase) + (animated ? (want ? -1 : 1) : 0);
  if (ok(img)) {
    const fh = img.height;                                         // Frame-Größe aus der Bildhöhe
    const frames = animated ? 1 : Math.max(1, Math.round(img.width / fh));   // Streifen (marko_ride) nur ohne _1/_2
    const fr = animated ? 0 : Math.floor(phase) % frames;
    ctx.drawImage(img, fr * fh, 0, fh, fh, x - Math.round(s / 2), yBase - s, s, s);
  } else {                                                         // Notnagel, falls ein PNG fehlt
    px(x - Math.round(s * 0.3), yBase - s, Math.round(s * 0.6), s, FALLBACK_COLOR[name] || '#f0f');
  }
}

// Schlagloch: dunkle Ellipse flach auf der Straße (Tiefe perspektivisch gestaucht)
function drawPothole(x, y, k) {
  const rx = Math.max(1, 1.1 * k), ry = Math.max(1, 0.35 * camH * k * k / FOCAL);
  ctx.fillStyle = '#0d0a07';
  ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a2015';
  ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), rx * 0.7, ry * 0.65, 0, 0, Math.PI * 2); ctx.fill();
}

function drawTree(x, y, h, dark) {
  h = Math.round(h);
  if (h < 3) return;
  x = Math.round(x); y = Math.round(y);
  const c = dark ? '#163a24' : '#1f4d2e', c2 = dark ? '#1d4a2d' : '#27613a';
  const trunk = Math.max(1, Math.round(h * 0.12));
  const tw = Math.max(1, Math.round(h * 0.03));
  px(x - tw, y - trunk, tw * 2, trunk, '#4a2f1a');
  const th = h - trunk;
  for (let i = 0; i < th; i++) {
    const t = i / th, tier = (t * 4) % 1;
    const w = Math.max(1, Math.round((0.05 + t * 0.2 - tier * 0.05) * h));
    px(x - w, y - trunk - th + i, w * 2, 1, tier > 0.8 ? c2 : c);
  }
}

// =====================================================================
// Spielzustand
// =====================================================================
let m, a, race;                       // Marko, Albert, Rennen
const world = { bg: 0 };
const confetti = [];
const speech = { text: '', timer: 0, cooldown: 0, last: {} };

function resetRace() {
  m = { hr: 140, bat: 100, mode: 0, motorOn: false, x: 0, steer: 0, pos: 0, speed: 0, cadence: 0, lastSide: null, lastStrokeT: -10, y: 0, vy: 0, phase: 0, guarded: false, windMul: 1, stun: 0, hitT: 0, shake: 0 };
  a = { anim: 0, x: 0, pos: GAP_REF * 5, speed: 0, finished: false, look: 0, lookIn: rand(3, 6), phase: 0 };
  race = {
    t: 0, countdown: 3,
    passed: CHECKPOINTS.map(() => false),
    targetGap: 5, teaseIn: rand(10, 16), tease: 0,
    result: null,
    obs: makeObstacles(),
    shame: 0, motorFlag: false, msg: null, grin: 0, pulsIn: 20,
    pens: [], toast: null, penTotal: 0, meteors: makeMeteors(),
    fakeWin: false,
    fake: { base: 0, flipped: false, spawn: 0 },
    // Rage-Bait-Events, jedes läuft einmal: idle -> (aktive Phasen) -> done
    ev: {
      sc:     { phase: 'idle', t: 0, dx: 0 },          // idle | in | wait | out | done
      wind:   { phase: 'idle', t: 0 },                 // idle | boost | head | done
      gust:   { phase: 'idle', t: 0 },                 // idle | on | done
      garmin: { phase: 'idle', t: 0, bat: 100, beep: 99 }, // idle | drain | black | low | done
    },
  };
  confetti.length = 0;
  speech.text = ''; speech.timer = 0; speech.cooldown = 0;
  world.bg = 0;
}

function loadBest() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } }
function saveBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* egal */ } }

// =====================================================================
// Albert spricht
// =====================================================================
function say(trigger, force = false, vars = {}) {
  if (!force && speech.cooldown > 0) return false;
  const pool = (typeof LINES !== 'undefined' && LINES[trigger]) || [];
  if (!pool.length) return false;
  let idx = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && idx === speech.last[trigger]) idx = (idx + 1) % pool.length;
  speech.last[trigger] = idx;
  speech.text = pool[idx].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  speech.timer = BUBBLE_TIME;
  speech.cooldown = SPEECH_COOLDOWN;
  a.look = Math.max(a.look, 1.2);                  // beim Reden dreht er sich um
  Sfx.talk();
  return true;
}

// =====================================================================
// Marko
// =====================================================================
function stroke(side) {
  if (side === m.lastSide) {                        // zweimal dieselbe Seite: verschluckt
    m.cadence *= 0.7;
    Sfx.miss();
    return;
  }
  const dt = race.t - m.lastStrokeT;
  m.lastStrokeT = race.t;
  m.lastSide = side;
  if (dt > 0) m.cadence = m.cadence * 0.6 + Math.min(14, 1 / dt) * 0.4;
  Sfx.pedal(side);
}

// Hindernisse entlang der Strecke (mit Mindestabstand, nie in der Nähe der Events)
function makeObstacles() {
  const out = [];
  const avoid = [SHORTCUT_POS, WIND_POS, GUST_POS, GARMIN_POS];
  let pos = 700;
  while (true) {
    pos += OBSTACLE_GAP_MIN + Math.random() * OBSTACLE_GAP_EXTRA;
    if (pos >= TRACK_LEN * 0.94) break;
    if (avoid.some((e) => Math.abs(e - pos) < 250)) continue;
    const type = Math.random() < 0.18 ? 'ebike_opa' : OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    out.push({ type, pos, done: false, active: false, lat: type === 'ebike_opa' ? 0.55 : rand(-0.8, 0.8) });
  }
  return out;
}

const fmtPen = (sec) => '+' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
function addPenalty(sec) { race.pens.push({ txt: fmtPen(sec), t: 0 }); race.penTotal += sec; }

// Motormodus durchschalten: peinlicher Kommentar mitten im Bild, Beep, Albert dreht sich grinsend um
function showMode(key) {
  const pool = (typeof ebike_lines !== 'undefined' && ebike_lines[key]) || [];
  if (pool.length) race.msg = { t: 0, txt: pool[Math.floor(Math.random() * pool.length)], key };
}

function cycleMode() {
  const next = (m.mode + 1) % MODES.length;
  if (next > 0 && m.bat <= 0) { m.mode = 0; showMode('leer'); Sfx.modeBeep(0); }
  else { m.mode = next; showMode(MODE_KEYS[next]); Sfx.modeBeep(next); }
  race.shame = Math.min(100, race.shame + SHAME_SWITCH);
  race.grin = 1.4;
  say('ebike_albert', true);
}

function hitObstacle(o) {
  Sfx.crash();
  addPenalty(OBSTACLE_PENALTY[o.type]);
  m.speed *= 0.25;
  m.stun = OBSTACLE_PENALTY[o.type] / TIME_SCALE;       // Zeitstrafe: so lange fast Stillstand
  m.hitT = HIT_BLINK_TIME;
  m.shake = SHAKE_TIME;
  say(OBSTACLE_TRIGGER[o.type], true);
}

function updateObstacles(dt) {
  for (const o of race.obs) {
    if (o.done) continue;
    if (OVERTAKE_TYPES.includes(o.type)) {
      if (!o.active && (o.pos - m.pos) * VIS < DRAW_D) o.active = true;
      if (o.active) o.pos += EBIKE_SPEED * dt;           // fährt vor Marko, überholt nie
    }
    if (o.pos <= m.pos) {
      o.done = true;
      if (OVERTAKE_TYPES.includes(o.type)) say('ebike');
      else {
        const lat = o.lat + (o.type === 'hiker' ? 0.2 * Math.sin(stateTime * 1.3 + o.pos) : 0);   // wie beim Zeichnen
        if (Math.abs(lat - m.x) < OBSTACLE_HALF[o.type] + MARKO_HALF) hitObstacle(o);
      }
    }
  }
}

// Streckenabschnitt: 0 Günterstal (Ticker), 1 Horben (orange + Meteore), 2 Kappel (brennende Tannen), 3 Serpentinen (Erdbeben)
function section() { const f = m.pos / TRACK_LEN; return f < 0.15 ? 0 : f < 0.42 ? 1 : f < 0.70 ? 2 : 3; }
function quakeAmp() {
  if (state === 'APOCALYPSE') return Math.min(5, stateTime * 1.2);
  return state === 'PLAY' && section() === 3 ? 0.8 + Math.abs(Math.sin(stateTime * 1.7)) * 1.2 : 0;
}

function makeMeteors() {
  const out = [];
  for (let pos = TRACK_LEN * 0.15; pos < TRACK_LEN * 0.97; pos += 120 + Math.random() * 160) {
    out.push({ pos, lat: (Math.random() < 0.5 ? -1 : 1) * (1.7 + Math.random() * 2.2), f0: null });
  }
  return out;
}

function scActive() { return ['in', 'wait', 'out'].includes(race.ev.sc.phase); }

function updateMarko(dt) {
  // Herzfrequenz steigt mit dem Tempo (140-195); bei Dauer-Puls lacht Albert gelegentlich
  m.hr += (140 + 55 * clamp(m.speed / MARKO_VMAX, 0, 1) - m.hr) * Math.min(1, dt * 0.8);
  if (m.hr >= 185 && (race.pulsIn -= dt) <= 0) { say('puls'); race.pulsIn = 22; }
  m.hitT = Math.max(0, m.hitT - dt);
  m.shake = Math.max(0, m.shake - dt);
  m.stun = Math.max(0, m.stun - dt);

  // Auf dem Feldweg der Fake-Abkürzung: Zeit läuft weiter, Position nicht
  if (scActive()) {
    m.cadence = 0; m.speed = 0; m.steer = 0;
    m.x *= Math.max(0, 1 - 4 * dt);
    if (race.ev.sc.phase !== 'wait') m.phase += SC_SPEED * dt * 0.09;
    return;
  }

  // E-Bike: Akku sinkt je nach Modus, lädt in AUS langsam nach; PEINLICH füllt sich bei Nutzung
  const live = m.mode > 0 && m.bat > 0;
  if (m.mode > 0) {
    m.bat = Math.max(0, m.bat - MODE_DRAIN[m.mode] * dt);
    race.shame = Math.min(100, race.shame + MODE_SHAME[m.mode] * dt);
    if (m.bat <= 0) { m.mode = 0; showMode('leer'); }
  } else {
    m.bat = Math.min(100, m.bat + 100 / MOTOR_RECHARGE * dt);
    race.shame = Math.max(0, race.shame - 0.8 * dt);
  }
  m.motorOn = live;
  if (race.shame >= 100 && !race.motorFlag) {                       // Strava erkennt das E-Bike (einmal pro Run)
    race.motorFlag = true;
    m.stun = Math.max(m.stun, MOTOR_PENALTY / TIME_SCALE);
    m.shake = SHAKE_TIME * 2;
    race.toast = { t: 0, head: 'STRAVA', body: 'E-Bike erkannt. Segment ungültig', sub: 'Zeitstrafe +0:30' };
    addPenalty(MOTOR_PENALTY);
    Sfx.alert();
    say('motor', true);
  }

  // Trittfrequenz fällt ab, wenn nicht getreten wird
  const since = race.t - m.lastStrokeT;
  if (since > 1.5) m.cadence = 0;
  else if (since > 0) m.cadence = Math.min(m.cadence, 1 / since);

  const target = MARKO_VMAX * Math.pow(Math.min(1, m.cadence / CADENCE_FULL), 0.4) * (live ? 1 + MODE_BOOST[m.mode] : 1) * m.windMul * (m.stun > 0 ? 0.15 : 1) * (Math.abs(m.x) > 1 ? OFFROAD_MUL : 1);
  m.speed += (target - m.speed) * (target > m.speed ? ACCEL : DECEL) * dt;

  // Unsichtbare Gegenwind-Linie: weich abbremsen, hart begrenzen
  const guardRate = TRACK_LEN / GUARD_ARRIVAL;
  const guardPos = guardRate * race.t;
  const cap = Math.max(0, guardRate + (guardPos - m.pos) * 1.5);
  m.guarded = m.speed > cap;
  if (m.guarded) m.speed = cap;
  const newPos = Math.min(m.pos + m.speed * dt, guardPos, TRACK_LEN - 1);
  m.speed = (newPos - m.pos) / dt;                  // Tempo = tatsächliche Bewegung
  m.pos = newPos;

  // Lenken: Pfeiltasten (bei Strava-Sperre tot); Kurven drücken nach außen
  const steerIn = ((steerKeys.right ? 1 : 0) - (steerKeys.left ? 1 : 0)) * (race.ev.gust.phase === 'on' ? -1 : 1);
  m.steer += (steerIn - m.steer) * Math.min(1, dt * 10);
  const vVis = m.speed * VIS;
  const push = curveAt(m.pos * VIS + 12) * vVis * CENTRIF_K;
  m.x = clamp(m.x + (m.steer * STEER_RATE * (0.35 + 0.65 * Math.min(1, vVis / 40)) - push) * dt, -X_MAX, X_MAX);
  m.phase += m.speed * dt * 0.09;
  updateObstacles(dt);

  // Checkpoints
  CHECKPOINTS.forEach((cp, i) => {
    if (!race.passed[i] && m.pos >= cp.at * TRACK_LEN) {
      race.passed[i] = true;
      Sfx.checkpoint();
      say('checkpoint', true, { ort: cp.name });
    }
  });
}

// =====================================================================
// Albert: Rubber-Banding
// =====================================================================
function gapSeconds() { return (a.pos - m.pos) / GAP_REF; }

function updateAlbert(dt) {
  a.look = Math.max(0, a.look - dt);
  a.lookIn -= dt;
  if (a.lookIn <= 0) { a.look = Math.max(a.look, 0.9); a.lookIn = rand(4, 8); }
  if (a.finished) return;
  a.anim += dt / 0.15 * clamp(a.speed / ALBERT_BASE, 0.6, 2.2);       // schneller Beinwechsel, wenn er beschleunigt

  // Ziel-Abstand pendelt zwischen 3 und 8 Spielsekunden.
  // Ab und zu lässt Albert Marko fast ran ("tease") und zieht dann weg.
  race.teaseIn -= dt;
  if (race.tease > 0) {
    race.tease -= dt;
    if (race.tease > 1.2) race.targetGap += (0.6 - race.targetGap) * Math.min(1, dt * 2);
    else race.targetGap = 8;                         // und tschüss
  } else {
    const goal = 5.5 + 2.5 * Math.sin(race.t * 0.35);
    race.targetGap += (goal - race.targetGap) * Math.min(1, dt * 0.8);
    if (race.teaseIn <= 0) { race.tease = 5.5; race.teaseIn = rand(12, 20); }
  }

  const gap = gapSeconds();
  let desired = m.speed + (race.targetGap - gap) * GAP_REF / 0.8;
  desired = clamp(desired, ALBERT_BASE * 0.35, ALBERT_BASE * 2.2);

  // Schlussphase: Albert zieht weg und kommt pünktlich bei 38:30 oben an
  if (a.pos > TRACK_LEN * 0.9) {
    const need = (TRACK_LEN - a.pos) / Math.max(0.3, ALBERT_TARGET - race.t);
    desired = Math.max(desired, Math.min(need, ALBERT_BASE * 3));
  }

  a.speed += (desired - a.speed) * Math.min(1, dt * 5);
  a.pos += a.speed * dt;

  // Überholen ist nicht vorgesehen.
  const minPos = m.pos + GAP_MIN * GAP_REF;
  if (a.pos < minPos) { a.pos = minPos; a.speed = Math.max(a.speed, m.speed); }

  if (a.pos >= TRACK_LEN) { a.pos = TRACK_LEN; a.finished = true; }
  a.phase += a.speed * dt * 0.09;

  // Albert schlängelt sich elegant durch die Spur und weicht Hindernissen aus
  const pv = a.pos * VIS;
  let target = 0.45 * Math.sin(pv / 37) + 0.2 * Math.sin(pv / 17 + 1);
  for (const o of race.obs) {
    const dd = o.pos - a.pos;
    if (o.done || o.type === 'ebike_opa' || dd < -10 || dd > 80) continue;
    target = o.lat + (o.lat > 0 ? -0.75 : 0.75);
    break;
  }
  a.x += (clamp(target, -0.8, 0.8) - a.x) * Math.min(1, dt * 3);

  if (gapSeconds() < 2) say('aufholen');
}

// =====================================================================
// Rage-Bait-Events (jedes einmal pro Run, an festen Streckenpunkten)
// Gibt die Aktionen zurück, die Marko noch ausführen darf (Eingabe kann blockiert sein).
// =====================================================================
function updateEvents(dt, acts) {
  const ev = race.ev;
  let blocked = false;

  // 1. Fake-Abkürzung: Nach links über den Straßenrand lenken (Schild) = abbiegen -> Sackgasse, +3 Min
  const sc = ev.sc;
  if (sc.phase === 'idle') {
    if (m.pos > SHORTCUT_POS + 10) sc.phase = 'done';             // vorbeigefahren
    else if (m.pos > SHORTCUT_POS - SHORTCUT_ZONE && m.x < -1.1) { sc.phase = 'in'; sc.t = 0; Sfx.jump(); addPenalty(180); }   // links ab
  } else if (sc.phase !== 'done') {
    sc.t += dt;
    if (sc.phase === 'in') {
      sc.dx = Math.min(SC_DEAD, sc.dx + SC_SPEED * dt);
      if (sc.dx >= SC_DEAD) { sc.phase = 'wait'; sc.t = 0; Sfx.crash(); say('abkuerzung', true); }
    } else if (sc.phase === 'wait') {
      if (sc.t >= SC_WAIT) sc.phase = 'out';
    } else {
      sc.dx = Math.max(0, sc.dx - SC_SPEED * dt);
      if (sc.dx <= 0) sc.phase = 'done';
    }
    blocked = true;
  }

  // 2. Rückenwind-Pickup: 3 s Boost, dann 4 s Gegenwind (halbes Tempo)
  const w = ev.wind;
  if (w.phase === 'idle') {
    if (m.pos >= WIND_POS) { w.phase = 'boost'; w.t = 0; Sfx.pickup(); say('sehrSchnell', true); }
  } else if (w.phase !== 'done') {
    w.t += dt;
    if (w.phase === 'boost' && w.t >= BOOST_T) { w.phase = 'head'; w.t = 0; Sfx.windDown(); say('gebremst', true); }
    else if (w.phase === 'head' && w.t >= HEAD_T) w.phase = 'done';
  }
  m.windMul = w.phase === 'boost' ? BOOST_MUL : w.phase === 'head' ? HEAD_MUL : 1;

  // 3. Seitenwind-Böe: die Lenkung ist 3 s vertauscht (links = rechts)
  const s = ev.gust;
  if (s.phase === 'idle') {
    if (m.pos >= GUST_POS) {
      s.phase = 'on'; s.t = 0; Sfx.alert(); say('gust', true);
      race.toast = { t: 0, head: 'WARNUNG', body: 'Seitenwind! Lenkung vertauscht', sub: 'Viel Spaß, Marko.' };
    }
  } else if (s.phase === 'on') {
    s.t += dt;
    if (s.t >= GUST_T) s.phase = 'done';
  }

  // 4. Garmin-Akku: sinkt auf 1 %, dann 1 s schwarz
  const g = ev.garmin;
  if (g.phase === 'idle') {
    if (m.pos >= GARMIN_POS) { g.phase = 'drain'; g.t = 0; g.bat = 100; }
  } else if (g.phase === 'drain') {
    g.t += dt;
    g.bat = 100 - 99 * Math.min(1, g.t / GARMIN_DRAIN);
    if (g.bat < 20 && Math.floor(g.bat / 4) !== g.beep) { g.beep = Math.floor(g.bat / 4); Sfx.lowBat(); }
    if (g.t >= GARMIN_DRAIN) { g.phase = 'black'; g.t = 0; g.bat = 1; }
  } else if (g.phase === 'black') {
    g.t += dt;
    if (g.t >= GARMIN_BLACK) { g.phase = 'low'; g.t = 0; say('garmin', true); }
  } else if (g.phase === 'low') {
    g.t += dt;
    if (g.t >= GARMIN_LOW) g.phase = 'done';
  }

  return blocked ? [] : acts;
}

// =====================================================================
// Rennen beenden (Platzhalter bis zur Apokalypse)
// =====================================================================
function finishRace() {
  // Hochrechnung bei gleichem Durchschnittstempo. Immer zwischen 40:01 und 41:30.
  const projReal = REAL_DURATION * TRACK_LEN / Math.max(1, m.pos);
  let proj = clamp(Math.ceil(projReal * TIME_SCALE), GAME_DURATION + 1, MAX_RESULT);
  if (race.fakeWin) proj = GAME_DURATION + 1;                    // der Timer ist auf 40:01 gesprungen
  proj += race.penTotal;                                         // Zeitstrafen kommen obendrauf
  const best = loadBest();
  const isBest = !best || proj < best;
  if (isBest) saveBest(proj);
  race.result = { proj, best: isBest ? proj : best, isBest, missing: TRACK_LEN - m.pos };
  Sfx.end();
}

// =====================================================================
// State Machine
// =====================================================================
let state = 'TITLE';
let stateTime = 0;

function setState(name) {
  state = name;
  stateTime = 0;
  if (States[name].enter) States[name].enter();
}

const States = {
  // Preloader: Das Spiel startet erst, wenn alle PNGs aus assets/ geladen sind
  // (oder ihr Laden fehlgeschlagen ist – dann greift der Platzhalter-Fallback).
  LOADING: {
    update() {
      if (assetsReady() && stateTime > 0.15) setState('TITLE');
    },
    draw() {
      px(0, 0, W, H, '#0e1a12');
      text('Lädt...', W / 2, 78, { size: 10, align: 'center', color: '#fff' });
      const bw = 120, pct = assetsToLoad ? assetsLoaded / assetsToLoad : 1;
      const bx = Math.round(W / 2 - bw / 2);
      px(bx, 94, bw, 4, '#223');
      px(bx, 94, Math.round(bw * pct), 4, '#ff5');
    },
  },

  TITLE: {
    enter() { resetRace(); },
    update(dt, acts) {
      m.pos += 40 * dt; m.speed = 40;                          // Kamera rollt im Hintergrund
      updateWorld(dt);
      if (acts.length && stateTime > 0.3) setState('PLAY');
    },
    draw() {
      drawScene();
      drawTitle();
    },
  },

  PLAY: {
    enter() { resetRace(); },
    update(dt, acts) {
      speech.timer = Math.max(0, speech.timer - dt);
      speech.cooldown = Math.max(0, speech.cooldown - dt);

      if (race.countdown > 0) {
        const before = Math.ceil(race.countdown);
        race.countdown -= dt;
        const after = Math.ceil(race.countdown);
        if (before === 3 && stateTime < dt * 1.5) Sfx.count();
        if (after !== before && after > 0) Sfx.count();
        if (race.countdown <= 0) { Sfx.go(); say('start', true); }
        return;
      }

      race.t += dt;
      race.pens.forEach((q) => { q.t += dt; });
      race.pens = race.pens.filter((q) => q.t < PEN_SHOW);
      if (race.toast && (race.toast.t += dt) > TOAST_TIME) race.toast = null;
      if (race.msg && (race.msg.t += dt) > MSG_TIME) race.msg = null;
      race.grin = Math.max(0, race.grin - dt);
      for (const act of updateEvents(dt, acts)) {
        if (act === 'left' || act === 'right') stroke(act);
        else if (act === 'mode') cycleMode();
      }
      updateMarko(dt);
      updateAlbert(dt);
      updateWorld(dt);

      // 5. Fake-Sieg: Marko ist (fast) oben, die Uhr zeigt 39:5x
      if (race.t >= FAKE_WIN_T && m.pos >= FAKE_WIN_POS) { race.fakeWin = true; setState('FAKE_WIN'); }
      else if (race.t >= REAL_DURATION) setState('APOCALYPSE');
    },
    draw() {
      drawScene();
      drawCockpit();
      drawEventFx();
      drawTicker();
      drawBubble();
      drawHud();
      drawEventHud();
      drawModeMsg();
      drawHints();
      if (race.countdown > 0) drawCountdown();
      else if (race.t < 1) text('LOS!', W / 2, 60, { size: 22, color: '#ff5', align: 'center' });
    },
  },

  // Marko glaubt kurz, er hätte es geschafft: Konfetti, "NEUE BESTZEIT!", dann springt der Timer auf 40:01.
  FAKE_WIN: {
    enter() {
      race.fake = { base: Math.min(GAME_DURATION - 1, Math.floor(race.t * TIME_SCALE)), flipped: false, spawn: 0 };
      spawnConfetti(120);
      Sfx.fanfare();
    },
    update(dt) {
      speech.timer = Math.max(0, speech.timer - dt);
      speech.cooldown = Math.max(0, speech.cooldown - dt);
      m.speed *= Math.max(0, 1 - 1.5 * dt);                       // Marko rollt aus
      m.pos = Math.min(TRACK_LEN - 1, m.pos + m.speed * dt);
      m.phase += m.speed * dt * 0.09;
      updateWorld(dt);
      updateAlbert(dt);
      updateConfetti(dt);
      const f = race.fake;
      if (!f.flipped) {
        f.spawn += dt;
        if (f.spawn > 0.05) { f.spawn = 0; spawnConfetti(3); }
        if (stateTime >= FAKE_FLIP) { f.flipped = true; Sfx.scratch(); say('fakeSieg', true); }
      }
      if (stateTime >= FAKE_END) setState('APOCALYPSE');
    },
    draw() {
      drawScene();
      drawCockpit();
      drawBubble();
      drawHud();
      drawConfetti();
      drawFakeWinBanner();
    },
  },

  // 40:00: Himmel rot, großer Meteor kommt auf Marko zu (Zeitlupe, Beben), dann wird alles weiß.
  APOCALYPSE: {
    enter() { finishRace(); Sfx.boom(); },
    update(dt) {
      const sd = dt * 0.3;                                          // Zeitlupe
      m.speed *= Math.max(0, 1 - 1.2 * sd);
      m.pos = Math.min(TRACK_LEN - 1, m.pos + m.speed * sd);
      m.phase += m.speed * sd * 0.09;
      m.steer *= 0.9;
      updateWorld(sd);
      if (stateTime >= APOC_T) setState('GAMEOVER');
    },
    draw() {
      drawScene();
      drawCockpit();
      drawHud();
      const f = clamp((stateTime - (APOC_T - 1.4)) / 1.4, 0, 1);
      if (f > 0) { ctx.globalAlpha = f; px(0, 0, W, H, '#fff'); ctx.globalAlpha = 1; u.clearRect(0, 0, W, H); }
    },
  },

  GAMEOVER: {
    update(dt, acts) {
      if (acts.length && stateTime > 1.2) setState('PLAY');
    },
    draw() {
      drawGameOver();
    },
  },
};

// =====================================================================
// Zeichnen: Pseudo-3D-Straße (Blick vom Lenker) + Billboards
// Sichtmeter = Streckenmeter * VIS. Zeile y unter dem Horizont entspricht der
// Entfernung d = camH * FOCAL / (y - HOR). Kurven verschieben die Straße seitlich.
// =====================================================================
const HILL_PERIOD = 640;
const farHills = new Array(HILL_PERIOD);
for (let x = 0; x < HILL_PERIOD; x++) {
  const t = (x / HILL_PERIOD) * Math.PI * 2;
  farHills[x] = Math.round(28 + 12 * Math.sin(t * 2) + 7 * Math.sin(t * 5 + 1) + 3 * Math.sin(t * 13 + 2));
}
const SKY = ['#4f9be0', '#5da6e6', '#6cb1eb', '#7cbcef', '#8dc6f2', '#a0d0f4', '#b6dbf5'];

const rowD = new Float32Array(H + 1);       // Entfernung je Bildzeile
const rowLat = new Float32Array(H + 1);     // seitliche Straßenverschiebung (m) je Bildzeile
let camH = CAM_H;
let camX = 0;                               // Markos seitliche Position in Metern

// Krümmung der Straße (1/m) an Sichtposition p. Die Strecke wird abschnittsweise kurviger:
// Günterstal (sanft) -> Horben -> Kappel -> Serpentinen (enge Wechselkurven). Am Start gerade.
function curveAt(p) {
  const frac = clamp(p / (TRACK_LEN * VIS), 0, 1);
  const gain = 0.35 + 1.25 * frac;
  let c = 0.0009 * (Math.sin(p / 380) + 0.7 * Math.sin(p / 137 + 2));
  const ser = clamp((frac - 0.68) / 0.06, 0, 1);                 // ab ~70 %: Serpentinen
  c = c * (1 - 0.5 * ser) + ser * 0.0011 * Math.sin(p / 70);
  return Math.min(1, p / 400) * gain * c;
}

function updateWorld(dt) {
  // Hintergrund dreht sich mit der Kurve
  world.bg += FOCAL * curveAt(m.pos * VIS + 25) * m.speed * VIS * dt - m.steer * 20 * dt;
}

function computeRoad() {
  camH = CAM_H;
  camX = m.x * ROAD_HW;
  const base = m.pos * VIS;
  let dd = 0, lat = 0, prev = 0;
  for (let y = H - 1; y > HOR; y--) {
    const d = camH * FOCAL / (y - HOR);
    const step = d - prev; prev = d;
    dd += curveAt(base + d) * step;
    lat += dd * step;
    rowD[y] = d; rowLat[y] = lat;
  }
}

// Bildpunkt eines Bodenpunkts: seitlich latM Meter von der Straßenmitte, Entfernung d
function groundPoint(latM, d) {
  const k = FOCAL / d;
  const yf = HOR + camH * k;
  const idx = clamp(Math.round(yf), HOR + 1, H - 1);
  return { k, y: yf, x: W / 2 + (rowLat[idx] + latM - camX) * k };
}

// Tageszeit: heller Morgen -> wärmer bis zum Gipfel -> bei der Apokalypse dunkelrot
const SKY_WARM = ['#5f86c8', '#7d93d0', '#c79ab0', '#e8a67e', '#f2b57a', '#f6c68a', '#f9d79f'];
const SKY_FIRE = ['#7a2a2a', '#a8402a', '#d0602a', '#e8802c', '#f09a3a', '#f6b04a', '#f9c260'];
const SKY_DOOM = ['#1c0303', '#2c0605', '#420a07', '#5a1209', '#70200c', '#842e10', '#963c14'];
function lerpColor(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const ch = (sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return '#' + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('');
}
function doomLevel() { return state === 'APOCALYPSE' || state === 'GAMEOVER' ? Math.min(1, stateTime / 1.5) : 0; }

function drawBackground() {
  const warm = clamp(m.pos / TRACK_LEN, 0, 1), doom = doomLevel();
  const fire = clamp((m.pos / TRACK_LEN - 0.15) / 0.3, 0, 1) * 0.85;      // ab Horben orange
  SKY.forEach((c, i) => px(0, i * 10, W, 10, lerpColor(lerpColor(lerpColor(c, SKY_WARM[i], warm), SKY_FIRE[i], fire), SKY_DOOM[i], doom)));
  const sun = lerpColor('#fff3b0', '#ff9a50', warm);
  px(262, 22 + Math.round(warm * 20), 12, 12, sun);
  px(260, 24 + Math.round(warm * 20), 16, 8, sun);
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 97 - world.bg * 0.15 - stateTime * 2) % 420 + 420) % 420 - 50;
    const cy = 16 + (i * 23) % 30;
    px(cx, cy, 26, 4, '#fff');
    px(cx + 5, cy - 3, 13, 3, '#fff');
  }
  const farC = lerpColor(lerpColor('#5a7f9a', '#8a7a98', warm), '#4a2418', doom), midC = lerpColor(lerpColor('#3f6a5c', '#4f5f58', warm), '#2a1410', doom);
  const fo = Math.floor(world.bg * 0.3);
  for (let x = 0; x < W; x++) {
    const h = Math.round(farHills[(x + fo) % HILL_PERIOD] * 0.8);
    px(x, HOR + 1 - h, 1, h, farC);
  }
  const mo = Math.floor(world.bg * 0.7);
  for (let x = 0; x < W; x++) {
    const h = Math.round(farHills[(x * 2 + mo + 200) % HILL_PERIOD] * 0.45);
    px(x, HOR + 1 - h, 1, h, midC);
  }
  px(0, HOR - 2, W, 3, '#24502f');
}

function renderRoad() {
  const base = m.pos * VIS, qw = quakeAmp() * 0.8;
  const dirt = race.ev.sc.dx > 0;
  for (let y = HOR + 1; y < H; y++) {
    const d = rowD[y], p = base + d, k = FOCAL / d;
    const stripe = Math.floor(p / 6) % 2 === 0;
    const cx = W / 2 + (rowLat[y] - camX) * k + (qw ? Math.round(Math.sin(y * 0.5 + stateTime * 18) * qw) : 0), hw = ROAD_HW * k, kerb = Math.max(1, 0.4 * k);
    px(0, y, W, 1, dirt ? (stripe ? '#4d7a2e' : '#477229') : (stripe ? '#3f7d34' : '#488a3a'));
    px(Math.round(cx - hw - kerb), y, Math.round(kerb), 1, stripe ? '#e33' : '#fff');
    px(Math.round(cx + hw), y, Math.round(kerb), 1, stripe ? '#e33' : '#fff');
    px(Math.round(cx - hw), y, Math.round(hw * 2), 1, dirt ? (stripe ? '#8a6a45' : '#80613f') : (stripe ? '#5a5b60' : '#55565b'));
    if (!dirt && Math.floor(p / 5) % 2 === 0) px(Math.round(cx - 0.06 * k), y, Math.max(1, Math.round(0.12 * k)), 1, '#e8e8e8');
  }
}

// Billboard-Helfer: Sprite in Spur lat (-1..1 = Straßenbreite), Entfernung d
// Animationsphase aus der Zeit (jede Figur mit eigenem Versatz, damit nicht alle im Gleichschritt laufen)
function animPhase(name, seed) { return stateTime / (ANIM_PERIOD[name] || 1) + (seed % 7); }

function bbSprite(name, lat, d, phase = 0, hm = BILLBOARD_H[name], minPx = 0) {
  const g = groundPoint(lat * ROAD_HW, d);
  drawBillboard(name, g.x, g.y, Math.max(minPx, hm * g.k), phase);
}

function signBoard(g, latM, label, w, color) {
  // Schild am Straßenrand: Pfosten + Tafel (Text auf der UI-Ebene)
  const x = Math.round(g.x), y = Math.round(g.y), k = g.k;
  px(x - Math.max(1, Math.round(0.07 * k)), y - Math.round(3 * k), Math.max(1, Math.round(0.14 * k)), Math.round(3 * k), '#6b4b2a');
  px(x - Math.round(w * k / 2), y - Math.round(3.4 * k), Math.round(w * k), Math.round(1.1 * k), color);
  const size = Math.min(14, 0.62 * k);
  if (size >= 4) text(label, x, y - 3.4 * k + 0.55 * k - size * 0.5, { size, color: '#3a2a00', align: 'center', shadow: false });
}

function drawArch3d(d) {
  const g = groundPoint(0, d), k = g.k;
  const x = Math.round(g.x), y = Math.round(g.y);
  const pw = Math.max(1, Math.round(0.3 * k));
  const lx = Math.round(x - 3.45 * k), rx = Math.round(x + 3.45 * k);
  px(lx - pw, y - Math.round(4.8 * k), pw * 2, Math.round(4.8 * k), '#ddd');
  px(rx - pw, y - Math.round(4.8 * k), pw * 2, Math.round(4.8 * k), '#ddd');
  const top = y - Math.round(4.8 * k), bh = Math.max(2, Math.round(0.9 * k));
  px(lx - pw, top, rx - lx + pw * 2, bh, '#e33');
  const n = 12, cw = (rx - lx + pw * 2) / n, ch = Math.max(1, Math.round(0.3 * k));
  for (let i = 0; i < n; i++) px(Math.round(lx - pw + i * cw), top + bh, Math.ceil(cw), ch, i % 2 ? '#fff' : '#111');
  const size = Math.min(40, 0.8 * k);
  if (size >= 4) text('ZIEL', x, top + bh / 2 - size * 0.45, { size, align: 'center', shadow: false });
}

function drawBarrier(d) {                                          // Absperrung der Sackgasse
  const g = groundPoint(0, d), k = g.k, y = Math.round(g.y);
  const left = Math.round(g.x - ROAD_HW * k), w = Math.round(2 * ROAD_HW * k), n = 8, sw = w / n;
  px(left, y - Math.round(1.6 * k), Math.max(1, Math.round(0.2 * k)), Math.round(1.6 * k), '#5a3d22');
  px(left + w - Math.max(1, Math.round(0.2 * k)), y - Math.round(1.6 * k), Math.max(1, Math.round(0.2 * k)), Math.round(1.6 * k), '#5a3d22');
  for (let i = 0; i < n; i++) {
    px(Math.round(left + i * sw), y - Math.round(1.25 * k), Math.ceil(sw), Math.max(1, Math.round(0.35 * k)), i % 2 ? '#fff' : '#e33');
    px(Math.round(left + i * sw), y - Math.round(0.7 * k), Math.ceil(sw), Math.max(1, Math.round(0.35 * k)), i % 2 ? '#e33' : '#fff');
  }
  const bw = Math.round(3.4 * k), bx = Math.round(g.x - bw / 2), by = y - Math.round(2.6 * k), bh = Math.max(2, Math.round(0.8 * k));
  px(bx, by, bw, bh, '#fff');
  px(bx, by, bw, 1, '#c00');
  px(bx, by + bh - 1, bw, 1, '#c00');
  const size = Math.min(14, 0.55 * k);
  if (size >= 4) text('SACKGASSE', g.x, by + bh / 2 - size * 0.45, { size, color: '#c00', align: 'center', shadow: false });
}

function archD() {
  if (state === 'FAKE_WIN') {
    if (!race.fake.flipped) return 80 - Math.min(1, stateTime / 1.3) * 78;        // Marko fährt drunter durch
    return 25 + (stateTime - FAKE_FLIP) * 25;                                     // und er haut wieder ab
  }
  const rem = TRACK_LEN - m.pos;
  if (rem >= ARCH_NEAR) return rem * VIS;
  return ARCH_NEAR * VIS * (1 + 0.35 * (1 - rem / ARCH_NEAR)) + Math.sin(stateTime * 7) * 0.5;   // je näher, desto weiter weg
}

// Sammelt alle Billboards mit Entfernung; gezeichnet wird von hinten nach vorn
function collectBillboards(items) {
  const base = m.pos * VIS, ev = race.ev, sc = ev.sc;
  const add = (d, fn, max = DRAW_D) => { if (d > 2.2 && d < max) items.push({ d, fn }); };

  // Tannen am Straßenrand
  const TS = 16, i0 = Math.floor(base / TS);
  for (let i = i0 + 1; i < i0 + DRAW_D / TS + 1; i++) {
    for (const side of [-1, 1]) {
      const seed = i * 2 + (side > 0 ? 1 : 0);
      if (hash(seed + 900) > 0.75) continue;
      const d = i * TS + hash(seed) * TS * 0.6 - base;
      const latM = side * (ROAD_HW + 1.8 + hash(seed + 500) * 6);
      const hm = 5 + hash(seed + 77) * 4, dark = hash(seed + 31) > 0.5;
      const burning = i * TS / VIS / TRACK_LEN > 0.42 && hash(seed + 55) > 0.35;   // ab Kappel brennen viele Tannen
      add(d, (dd) => {
        const g = groundPoint(latM, dd), tex = IMAGES[burning ? 'tree_burning' : 'tree'];
        if (tex && tex.complete && tex.naturalWidth) drawBillboard(burning ? 'tree_burning' : 'tree', g.x, g.y, hm * g.k * 1.1);
        else drawTree(g.x, g.y, hm * g.k, dark);
      });
    }
  }

  // Checkpoint-Schilder
  CHECKPOINTS.forEach((cp) => add((cp.at * TRACK_LEN - m.pos) * VIS, (dd) => {
    signBoard(groundPoint(-(ROAD_HW + 1.4), dd), 0, cp.name, 3.2, '#f2d34a');
  }));

  // 1. Fake-Abkürzung: Schild links, davor Links ab = abbiegen
  if (sc.phase === 'idle') {
    add((SHORTCUT_POS - m.pos) * VIS, (dd) => {
      bbSprite('sign_front', -1.5, dd);
      const g = groundPoint(-1.5 * ROAD_HW, dd), k = g.k;
      const w = 4.2, x = Math.round(g.x), y = Math.round(g.y - 2.7 * k);
      px(x - Math.round(w * k / 2), y - Math.round(1.1 * k), Math.round(w * k), Math.round(1.1 * k), '#f2d34a');
      px(x - Math.round(w * k / 2), y - Math.round(1.1 * k), Math.round(w * k), 1, '#111');
      const size = Math.min(14, 0.5 * k);
      if (size >= 4) {
        text('ABKÜRZUNG -2 MIN', g.x, y - 0.55 * k - size * 0.45, { size, color: '#111', align: 'center', shadow: false });
        if (dd < 70) text('Links ab = abbiegen', g.x, g.y + 2, { size: Math.min(8, 0.3 * k), color: '#ffd', align: 'center' });
      }
    });
  }
  // Sackgasse: Absperrung kommt näher (rückwärts rollend wieder weg)
  if (sc.dx > 0) add(6 + (SC_DEAD - sc.dx) * 0.5, drawBarrier);

  // 2. Rückenwind-Pickup schwebt über der Straße
  if (ev.wind.phase === 'idle') {
    add((WIND_POS - m.pos) * VIS, (dd) => {
      const g = groundPoint(0, dd), k = g.k, r = 0.55 * k + Math.sin(stateTime * 5) * 0.05 * k;
      const x = Math.round(g.x), y = Math.round(g.y - 1.5 * k);
      const rr = Math.max(1, Math.round(r));
      px(x - Math.round(rr * 0.7), y - rr, Math.round(rr * 1.4), rr * 2, '#2bd');
      px(x - rr, y - Math.round(rr * 0.7), rr * 2, Math.round(rr * 1.4), '#2bd');
      const L = Math.max(1, Math.round(rr * 0.12));
      px(x - Math.round(rr * 0.6), y - Math.round(rr * 0.35), Math.round(rr * 1.1), L, '#fff');
      px(x - Math.round(rr * 0.3), y, Math.round(rr * 1.1), L, '#fff');
      px(x - Math.round(rr * 0.6), y + Math.round(rr * 0.35), Math.round(rr * 0.9), L, '#fff');
    });
  }

  // Hindernisse und E-Bike-Opa
  for (const o of race.obs) {
    if (o.done && o.type !== 'ebike_opa') continue;
    const d = (o.pos - m.pos) * VIS;
    if (o.type === 'pothole') add(d, (dd) => { const g = groundPoint(o.lat * ROAD_HW, dd); drawPothole(g.x, g.y, g.k); });
    else if (o.type === 'hiker') add(d, (dd) => bbSprite('hiker_back', o.lat + 0.2 * Math.sin(stateTime * 1.3 + o.pos), dd, animPhase('hiker_back', o.pos)));
    else if (o.type === 'ebike_opa') add(d, (dd) => bbSprite('ebike_back', o.lat, dd, animPhase('ebike_back', o.pos)));
    else add(d, (dd) => bbSprite(SPRITE_OF[o.type], o.lat, dd, animPhase(SPRITE_OF[o.type], o.pos)));
  }

  // Albert vor Marko
  if (state !== 'TITLE') add(Math.max(2.6, (a.pos - m.pos) * VIS), (dd) => bbSprite('albert_back', a.x, dd, a.anim, BILLBOARD_H.albert_back, ALBERT_MIN_PX));

  // 6. Zielbogen
  add(archD(), drawArch3d);

  // Gipfelturm am Horizont (ab den Serpentinen sichtbar)
  if (m.pos / TRACK_LEN > 0.45) add((TRACK_LEN + 40 - m.pos) * VIS, (dd) => bbSprite('tower', 2.4, dd), 1500);

  // Meteore neben der Straße (ab Horben): fallen herab und schlagen ein
  for (const o of race.meteors) {
    const d = (o.pos - m.pos) * VIS;
    if (d < 0 || d > 150) continue;
    add(d, (dd) => {
      if (o.f0 === null) o.f0 = stateTime;
      const g = groundPoint(o.lat * ROAD_HW, dd), p = clamp((stateTime - o.f0) / 1.1, 0, 1);
      const lift = (1 - p) * (1 - p) * 26 * g.k, size = BILLBOARD_H.meteor * g.k * 0.7;
      if (p < 1) {
        ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ffb050'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(Math.round(g.x), Math.round(g.y - lift - size / 2)); ctx.lineTo(Math.round(g.x + 40), Math.round(g.y - lift - size / 2 - 60)); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (stateTime - o.f0 < 1.4) {
        const fl = Math.round(size * 0.9);                       // Einschlag-Blitz
        ctx.globalAlpha = 0.8 * (1 - (stateTime - o.f0 - 1.1) / 0.3); px(Math.round(g.x - fl / 2), Math.round(g.y - fl), fl, fl, '#ffd070'); ctx.globalAlpha = 1;
      }
      drawBillboard('meteor', g.x, g.y - lift, size);
    });
  }
  // Der große Meteor kommt auf Marko zu
  if (state === 'APOCALYPSE') {
    const d = Math.max(3, 140 - clamp(stateTime / (APOC_T - 1), 0, 1) * 137);
    add(d, (dd) => {
      const g = groundPoint(0, dd), lift = dd / 140 * 30 * g.k;
      drawBillboard('meteor', g.x, g.y - lift, 8 * g.k);
    });
  }
}

function drawScene() {
  ctx.save();
  ctx.translate(0, Math.round(Math.sin(stateTime * 2.4) * 0.7));        // Atmung wippt das Bild minimal
  const qa = quakeAmp();
  if (qa > 0) ctx.translate(Math.round(rand(-qa, qa)), Math.round(rand(-qa, qa)));
  else if (state === 'PLAY' && m.shake > 0) ctx.translate(Math.round(rand(-2, 2)), Math.round(rand(-2, 2)));
  else if (state === 'PLAY' && Math.abs(m.x) > 1 && m.speed > 5) ctx.translate(0, Math.round(rand(-1, 1)));   // Rumpelpiste
  computeRoad();
  drawBackground();
  renderRoad();
  const items = [];
  collectBillboards(items);
  items.sort((p, q) => q.d - p.d);
  for (const it of items) it.fn(it.d);
  ctx.restore();
  const doom = doomLevel();
  if (doom > 0) { ctx.globalAlpha = 0.5 * doom; px(0, 0, W, H, '#5a0000'); ctx.globalAlpha = 1; }
  drawSpeedLines();
  drawSweatAndVignette();
  if (m.hitT > 0 && Math.floor(m.hitT * 20) % 2 === 0) { ctx.globalAlpha = 0.3; px(0, 0, W, H, '#f00'); ctx.globalAlpha = 1; }
}

// Leichte Vignette und Schweißtropfen, die bei hohem Tempo übers Bild laufen
let vignette = null;
function drawSweatAndVignette() {
  if (!vignette) {
    vignette = ctx.createRadialGradient(W / 2, H / 2, 70, W / 2, H / 2, 200);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
  }
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  const f = m.speed / MARKO_VMAX;
  if (f < 0.8 || state === 'GAMEOVER') return;
  ctx.globalAlpha = 0.75;
  for (let i = 0; i < 5; i++) {
    const x = 18 + Math.floor(hash(i + 40) * 284), y = Math.floor((stateTime * (30 + hash(i) * 30) + hash(i + 3) * 160) % 170);
    px(x, y, 1, 3, '#bfe4ff'); px(x, y + 3, 1, 1, '#fff');
  }
  ctx.globalAlpha = 1;
}

// Geschwindigkeitslinien am Bildrand bei hohem Tempo
function drawSpeedLines() {
  const f = m.speed / MARKO_VMAX;
  if (f < 0.7 || state === 'GAMEOVER') return;
  ctx.globalAlpha = Math.min(0.5, (f - 0.7) / 0.3 * 0.5);
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, p = (stateTime * 3 + i * 0.37) % 1;
    const len = 12 + Math.floor(hash(i + 5) * 24), y = 30 + Math.floor(hash(i) * 110);
    const x = side < 0 ? Math.round(p * 70 - 10) : Math.round(W - p * 70 + 10 - len);
    px(x, y, len, 1, '#fff');
  }
  ctx.globalAlpha = 1;
}

const slopeAt = (pos) => 5 + 3.5 * Math.sin(pos / 900) + 1.5 * Math.sin(pos / 310);   // Steigung in %

// Lenkerband mit diagonaler Wicklung (zwei abwechselnde Grautöne)
function tape(x, y, w, h) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(x + xx, y + yy, 1, 1, ((xx + yy) >> 1) % 2 ? '#2a2a2e' : '#4a4a50');
}

// Lenker (First-Person, Pixel-Look): Ober- und Unterlenker mit Lenkerband, Hoods + Bremshebel,
// gelbe Handschuhe, Vorbau mit Schrauben, Gabel, Vorderrad mit Speichen-Flimmern, Garmin-Computer.
// Kippt beim Lenken (~8°), wippt ±1 px im Takt der Tritte, vibriert bei Tempo, Rumpelpiste, Treffern.
function drawCockpit() {
  const sinceTap = race.t - m.lastStrokeT;
  const bob = sinceTap < 0.12 ? (m.lastSide === 'left' ? 1 : -1) : 0;
  let jx = 0, jy = 0;
  if (m.speed > MARKO_VMAX * 0.75) { jx += Math.round(rand(-0.6, 0.6)); jy += Math.round(rand(-0.6, 0.6)); }
  if (m.shake > 0 || quakeAmp() > 0 || (Math.abs(m.x) > 1 && m.speed > 5)) { jx += Math.round(rand(-2, 2)); jy += Math.round(rand(-1, 1)); }
  const tilt = m.steer * 0.14;
  const ox = Math.round(W / 2 + jx), oy = 160 + bob + jy;
  const gar = race.ev.garmin, flicker = (gar.phase === 'black' || gar.phase === 'low') && Math.floor(stateTime * 14) % 3 === 0;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(tilt);
  // Vorderrad: Reifen, Felge, Speichen (flimmern mit dem Tempo)
  ctx.strokeStyle = '#111'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, 58, 50, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#a8a8b0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 58, 45, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.55; ctx.strokeStyle = '#c8c8d0';
  for (let k = 0; k < 12; k++) {
    const ang = m.phase * 2.5 + k * Math.PI / 6;
    ctx.beginPath(); ctx.moveTo(Math.cos(ang) * 8, 58 + Math.sin(ang) * 8); ctx.lineTo(Math.cos(ang) * 45, 58 + Math.sin(ang) * 45); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Gabel und Steuerrohr
  px(-19, 2, 4, 34, '#1c1c20'); px(15, 2, 4, 34, '#1c1c20');
  px(-19, 0, 38, 4, '#2a2a30'); px(-19, 0, 38, 1, '#4a4a58');
  px(-3, -8, 6, 14, '#30303a'); px(-3, -8, 1, 14, '#4a4a58');
  // Vorbau mit Schrauben
  px(-7, -16, 14, 9, '#6a6a72'); px(-7, -16, 14, 1, '#b0b0b8'); px(-7, -8, 14, 1, '#3a3a40');
  for (const [bx, by] of [[-5, -14], [3, -14], [-5, -11], [3, -11]]) { px(bx, by, 2, 2, '#26262a'); px(bx, by, 1, 1, '#8a8a92'); }
  // Oberlenker mit Lenkerband
  tape(-34, -22, 68, 6);
  // Unterlenker-Bögen: vom Oberlenker nach vorn/unten, dann zurück zur Mitte
  for (let n = 0; n < 16; n++) {
    const t = n / 15, ex = Math.round(2 + 6 * Math.sin(Math.PI * t) - 5 * t * t * t);
    px(-34 - ex, -20 + n, 4, 1, n % 2 ? '#2a2a2e' : '#4a4a50');
    px(30 + ex, -20 + n, 4, 1, n % 2 ? '#4a4a50' : '#2a2a2e');
  }
  // Hoods + Bremshebel
  for (const side of [-1, 1]) {
    const hx = side < 0 ? -36 : 24;
    px(hx + 2, -32, 10, 12, '#202024'); px(hx + 2, -32, 10, 1, '#3a3a40');
    px(side < 0 ? -35 : 33, -18, 2, 18, '#9a9aa2'); px(side < 0 ? -35 : 33, -18, 1, 18, '#d0d0d8');
    // gelbe Handschuhe
    px(hx, -36, 14, 14, '#ffd400'); px(hx, -36, 14, 2, '#fff2a0');
    px(hx, -29, 14, 1, '#e6b800'); px(hx, -26, 14, 1, '#c9a200'); px(hx, -23, 14, 1, '#c9a200');
    px(hx + (side < 0 ? 12 : 0), -35, 2, 12, '#c9a200');
  }
  // Garmin: Gehäuse mit Tasten, grünliches Display
  px(-6, -20, 12, 4, '#444');
  px(-32, -60, 64, 41, '#101014'); px(-32, -60, 64, 1, '#3a3a44'); px(-32, -19, 64, 1, '#05050a');
  for (const by of [-52, -43]) { px(-34, by, 2, 6, '#555'); px(32, by, 2, 6, '#555'); }
  px(-29, -57, 58, 32, flicker ? '#2b3328' : '#a8bda0');
  if (!flicker) {
    const bat = clamp(gar.bat, 0, 100);                           // Akku-Symbol
    px(13, -55, 14, 7, '#1a2418'); px(27, -53, 2, 3, '#1a2418');
    px(14, -54, Math.max(0, Math.round(12 * bat / 100)), 5, bat < 20 ? '#c22' : '#a8bda0');
    px(14, -54, 12, 5, 'rgba(0,0,0,0)');
    const hrHot = m.hr >= 190 && Math.floor(stateTime * 5) % 2 === 0;           // Herz
    px(2, -43, 2, 1, hrHot ? '#c00' : '#2a3a28'); px(5, -43, 2, 1, hrHot ? '#c00' : '#2a3a28'); px(2, -42, 5, 2, hrHot ? '#c00' : '#2a3a28'); px(3, -40, 3, 1, hrHot ? '#c00' : '#2a3a28'); px(4, -39, 1, 1, hrHot ? '#c00' : '#2a3a28');
    px(-27, -42, 1, 1, '#2a3a28'); px(-28, -41, 3, 1, '#2a3a28'); px(-29, -40, 5, 1, '#2a3a28');   // Steigungs-Dreieck
    px(11, -34, 18, 8, MODE_COLOR[m.mode]);                                    // Modus-Chip
    px(11, -34, 18, 1, 'rgba(255,255,255,0.4)');
  }
  ctx.restore();

  if (!flicker) {                                                   // Display-Texte (Rotation von Hand)
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const at = (x, y) => ({ x: Math.round(ox + x * c - y * sn), y: Math.round(oy + x * sn + y * c) });
    const T = (str, x, y, o) => { const q = at(x, y); text(str, q.x, q.y, { shadow: false, color: '#142014', ...o }); };
    T(fmtNum(m.speed / TIME_SCALE * 3.6, 0), -27, -57, { size: 13 });
    T('km/h', -11, -49, { size: 4.5 });
    T(fmtNum(slopeAt(m.pos), 1) + '%', -22, -43, { size: 6 });
    const hrHot = m.hr >= 190;
    T(String(Math.round(m.hr)), 8, -43, { size: 6, color: hrHot && Math.floor(stateTime * 5) % 2 === 0 ? '#c00' : '#142014' });
    T('Gipfel ' + fmtNum(Math.max(0, TRACK_LEN - m.pos) / 1000, 1) + 'km', -27, -32, { size: 5 });
    T(MODES[m.mode], 20, -33, { size: 4.5, color: m.mode === 3 ? '#111' : '#fff', align: 'center' });
  }
}

// Ticker in Günterstal
function drawTicker() {
  if (section() !== 0 || race.countdown > 0) return;
  px(0, 29, W, 9, 'rgba(160,0,0,0.85)');
  u.font = 'bold 6px "Courier New", monospace';
  const tw = u.measureText(TICKER_TEXT).width;
  const x = W - ((race.t * 45) % (tw + W));
  text(TICKER_TEXT, Math.round(x), 30.5, { size: 6, color: '#fff', shadow: false });
}

function drawEventFx() {
  const w = race.ev.wind;
  if (w.phase !== 'boost' && w.phase !== 'head') return;
  ctx.globalAlpha = 0.6;
  if (w.phase === 'boost') {                                       // Fahrtwind-Linien vom Horizont nach außen
    ctx.strokeStyle = '#cfe'; ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const ang = hash(i) * Math.PI * 2, r0 = ((stateTime * 1.8 + i * 0.137) % 1);
      const r1 = r0 + 0.12;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(ang) * r0 * 190, HOR + 20 + Math.sin(ang) * r0 * 120);
      ctx.lineTo(W / 2 + Math.cos(ang) * r1 * 190, HOR + 20 + Math.sin(ang) * r1 * 120);
      ctx.stroke();
    }
  } else {                                                         // Gegenwind: Böen von rechts
    for (let i = 0; i < 10; i++) {
      const x = (((i * 53 - stateTime * 300) % (W + 60)) + W + 60) % (W + 60) - 30;
      px(Math.round(x), 30 + (i * 17) % 120, 14 + (i * 7) % 12, 1, '#bbb');
    }
  }
  ctx.globalAlpha = 1;
}

// =====================================================================
// Sprechblase (Rahmen auf Pixel-Ebene, Text auf UI-Ebene)
// =====================================================================
const BUBBLE_FONT = 6, BUBBLE_LINE = 7, BUBBLE_MAXW = 104;

function wrapLines(str, maxW, fontSize = BUBBLE_FONT) {
  u.font = `bold ${fontSize}px "Courier New", monospace`;
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (u.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function albertScreen() {
  const g = groundPoint(a.x * ROAD_HW, Math.max(2.6, (a.pos - m.pos) * VIS));
  return { x: g.x, top: g.y - Math.max(ALBERT_MIN_PX, BILLBOARD_H.albert_back * g.k) };
}

function drawBubble() {
  if (speech.timer <= 0 || !speech.text) return;
  const lines = wrapLines(speech.text, BUBBLE_MAXW);
  u.font = `bold ${BUBBLE_FONT}px "Courier New", monospace`;
  const tw = Math.max(...lines.map((l) => u.measureText(l).width));
  const bw = Math.ceil(tw) + 8, bh = lines.length * BUBBLE_LINE + 5;

  const al = albertScreen();
  let ax = al.x;
  const offscreen = ax > W - 8;
  ax = clamp(ax, 8, W - 8);
  const bx = Math.round(clamp(ax - bw / 2, 2, W - bw - 2));
  const by = Math.round(clamp(al.top - 8 - bh, 68, 110));

  px(bx - 1, by - 1, bw + 2, bh + 2, '#111');
  px(bx, by, bw, bh, '#fff');
  if (offscreen) {
    // Albert ist außer Sicht: Pfeil nach rechts
    px(bx + bw + 1, by + 3, 2, 5, '#111');
    px(bx + bw + 3, by + 4, 1, 3, '#111');
  } else {
    const tx = Math.round(clamp(ax, bx + 4, bx + bw - 6));
    px(tx - 1, by + bh, 5, 1, '#111');
    px(tx, by + bh, 3, 1, '#fff');
    px(tx, by + bh + 1, 3, 1, '#111');
    px(tx + 1, by + bh + 1, 1, 1, '#fff');
    px(tx + 1, by + bh + 2, 1, 1, '#111');
  }
  lines.forEach((l, i) => text(l, bx + 4, by + 3 + i * BUBBLE_LINE, { size: BUBBLE_FONT, color: '#111', shadow: false }));
}

// =====================================================================
// Rage-Bait-Events: Zeichnen
// =====================================================================
const CONFETTI_COLORS = ['#f44', '#ff5', '#4af', '#5d5', '#f8f', '#fff'];

function spawnConfetti(n) {
  for (let i = 0; i < n; i++) {
    confetti.push({
      x: rand(0, W), y: rand(-50, -2), vx: rand(-25, 25), vy: rand(35, 85),
      w: 1 + Math.floor(rand(0, 3)), h: 2 + Math.floor(rand(0, 3)),
      c: CONFETTI_COLORS[Math.floor(rand(0, CONFETTI_COLORS.length))], ph: rand(0, 6.3),
    });
  }
}

function updateConfetti(dt) {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i];
    c.y += c.vy * dt;
    c.x += (c.vx + Math.sin(c.ph + stateTime * 5) * 14) * dt;
    if (c.y > H) confetti.splice(i, 1);
  }
}

function drawConfetti() {
  for (const c of confetti) px(Math.round(c.x), Math.round(c.y), c.w, c.h, c.c);
}

function fakeClock() {
  return race.fake.flipped ? fmtTime(GAME_DURATION + 1) : fmtTime(race.fake.base);
}

function drawFakeWinBanner() {
  const f = race.fake, t = stateTime;
  if (!f.flipped) {
    const pulse = 1 + 0.12 * Math.sin(t * 12);
    text('NEUE BESTZEIT!', W / 2, 38 - 2 * pulse, { size: Math.round(15 * pulse), color: '#ff5', align: 'center' });
    text(fakeClock(), W / 2, 66, { size: 26, color: '#fff', align: 'center' });
    text('Unter 40 Minuten!!', W / 2, 98, { size: 8, color: '#8f8', align: 'center' });
  } else {
    const shake = Math.max(0, 1 - (t - FAKE_FLIP) * 2) * 3;
    text('ZEIT KORRIGIERT', W / 2 + Math.sin(t * 60) * shake, 38, { size: 14, color: '#f44', align: 'center' });
    text(fakeClock(), W / 2 + Math.sin(t * 60) * shake, 66, { size: 26, color: '#f44', align: 'center' });
    text('(Zeitmessung hat sich verschoben.)', W / 2, 98, { size: 6, color: '#ddd', align: 'center' });
  }
}

// Overlays: Wind-Banner, +3 MIN, Strava-Popup, Garmin-Anzeige
function drawPopup(inK, outK, head, body, sub, bar) {
  const y = Math.round(-36 + (36 + 32) * Math.min(inK, outK));
  const x = 70, pw = 180, ph = 34;
  px(x - 1, y - 1, pw + 2, ph + 2, '#000');
  px(x, y, pw, ph, '#fff');
  px(x, y, pw, 10, '#fc4c02');
  text(head, x + 4, y + 2, { size: 6, color: '#fff', shadow: false });
  text(body, x + 4, y + 13, { size: 6.5, color: '#111', shadow: false });
  text(sub, x + 4, y + 23, { size: 4.5, color: '#666', shadow: false });
  if (bar > 0) px(x, y + ph - 2, Math.round(pw * bar), 2, '#fc4c02');
}

// Peinlicher Kommentar mitten im Bild (2 s, wackelt leicht)
function drawModeMsg() {
  const q = race.msg;
  if (q) {
    const fade = Math.min(1, (MSG_TIME - q.t) / 0.3), wob = Math.round(Math.sin(q.t * 40) * 1.2);
    const lines = wrapLines(q.txt, 196, 8), bh = lines.length * 10 + 8;
    const col = MODE_COLOR[Math.max(0, MODE_KEYS.indexOf(q.key))];
    u.globalAlpha = fade; ctx.globalAlpha = fade;
    px(W / 2 - 104 + wob, 66, 208, bh + 2, col); px(W / 2 - 103 + wob, 67, 206, bh, '#0a0a12');
    lines.forEach((l, i) => text(l, W / 2 + wob, 71 + i * 10, { size: 8, align: 'center', color: '#fff' }));
    u.globalAlpha = 1; ctx.globalAlpha = 1;
  }
  if (race.grin > 0) {                                              // Albert dreht sich um und grinst
    const al = albertScreen();
    text('(grinst)', al.x, al.top - 9, { size: 6, align: 'center', color: '#ffd' });
  }
}

function drawEventHud() {
  const ev = race.ev, sc = ev.sc, w = ev.wind, g = ev.garmin;


  if (w.phase === 'boost') text('RÜCKENWIND!', W / 2, 44, { size: 11, color: '#6f6', align: 'center' });
  else if (w.phase === 'head') text('GEGENWIND! ' + fmtNum(HEAD_T - w.t) + ' s', W / 2, 44, { size: 11, color: '#f77', align: 'center' });

  if (race.toast) {
    const q = race.toast;
    drawPopup(Math.min(1, q.t / 0.2), Math.min(1, (TOAST_TIME - q.t) / 0.2), q.head, q.body, q.sub, 0);
  }

}

// =====================================================================
// HUD
// =====================================================================
function drawDot(x, y, color) {
  x = Math.round(x);
  px(x - 2, y - 1, 5, 3, '#000'); px(x - 1, y - 2, 3, 5, '#000');
  px(x - 1, y - 1, 3, 3, color);
}

function drawMarker(x, y, color, up) {
  x = Math.round(x);
  if (up) { px(x, y, 1, 1, color); px(x - 1, y + 1, 3, 1, color); px(x - 2, y + 2, 5, 1, color); }
  else { px(x - 2, y, 5, 1, color); px(x - 1, y + 1, 3, 1, color); px(x, y + 2, 1, 1, color); }
}

function drawHud() {
  // Timer (zählt von 40:00 runter)
  const remaining = Math.max(0, REAL_DURATION - race.t) * TIME_SCALE;
  const last = REAL_DURATION - race.t < 10;
  const blink = last && Math.floor(race.t * 4) % 2 === 0;
  px(0, 0, 66, 16, 'rgba(0,0,0,0.45)');
  if (state === 'FAKE_WIN') text(fakeClock(), 4, 2, { size: 13, color: race.fake.flipped ? '#f44' : '#ff5' });
  else text(fmtTime(Math.ceil(remaining)), 4, 2, { size: 13, color: blink ? '#f44' : remaining < 300 ? '#ff5' : '#fff' });

  // Fortschrittsbalken mit Checkpoints
  px(BAR_X - 2, 0, BAR_W + 6, 26, 'rgba(0,0,0,0.35)');
  px(BAR_X, BAR_Y, BAR_W, 3, '#222');
  px(BAR_X, BAR_Y, Math.round(BAR_W * m.pos / TRACK_LEN), 3, '#d33');
  CHECKPOINTS.forEach((cp, i) => {
    const x = Math.round(BAR_X + BAR_W * cp.at) - (cp.at >= 1 ? 1 : 0);
    px(x, BAR_Y - 2, 1, 7, race.passed[i] ? '#ff5' : '#ddd');
    const align = cp.at >= 1 ? 'right' : 'center';
    text(cp.name, x + (cp.at >= 1 ? 1 : 0), BAR_Y + 10, { size: 5, align, color: race.passed[i] ? '#ff5' : '#ddd' });
  });
  drawDot(BAR_X + BAR_W * a.pos / TRACK_LEN, BAR_Y + 1, '#4af');             // Albert: blauer Punkt
  drawDot(BAR_X + BAR_W * m.pos / TRACK_LEN, BAR_Y + 1, '#ffd400');          // Marko: gelber Punkt

  // Abstand zu Albert (mm:ss) im Pixelrahmen
  const g = Math.max(0, Math.round(gapSeconds()));
  const gapTxt = a.finished ? 'Albert: oben. Mit Kaffee.' : 'Albert +' + Math.floor(g / 60) + ':' + String(g % 60).padStart(2, '0');
  const bw = a.finished ? 114 : 78, bx0 = W - bw - 4, by0 = 38;
  px(bx0 - 2, by0 - 2, bw + 4, 15, '#8cf'); px(bx0 - 1, by0 - 1, bw + 2, 13, '#0a0f1c');
  text(gapTxt, bx0 + bw / 2, by0 + 1.5, { size: 7, align: 'center', color: '#8cf' });

  // Zeitstrafen: rote Zahlen, die kurz aufblitzen
  race.pens.forEach((q, i) => {
    if (Math.floor(q.t * 12) % 2 === 0 || q.t > 0.6) text(q.txt, 4, 19 + i * 10 - Math.round(q.t * 6), { size: 9, color: '#f33' });
  });

  // E-Bike-Akku und PEINLICH-Balken
  const bx = W - 70;
  const bar = (by, label, val, col, lc) => {
    text(label, bx - 3, by, { size: 5, align: 'right', color: lc });
    px(bx - 1, by - 1, 62, 8, '#111'); px(bx, by, 60, 6, '#333');
    px(bx, by, Math.round(60 * val / 100), 6, col);
  };
  bar(158, 'E-BIKE', m.bat, m.bat < 20 ? '#e33' : MODE_COLOR[m.mode] === '#8a8a8a' ? '#4c4' : MODE_COLOR[m.mode], m.mode ? '#ffd400' : '#ccc');
  const full = race.shame >= 100 && Math.floor(stateTime * 6) % 2 === 0;
  bar(168, 'PEINLICH', race.shame, full ? '#fff' : '#f4a', '#f9c');

  if (Sfx.muted) text('stumm (M)', W - 4, 56, { size: 5, align: 'right', color: '#ccc' });
}

function drawHints() {
  if (race.t >= 8) return;
  const alpha = Math.min(1, 8 - race.t);
  u.globalAlpha = alpha; ctx.globalAlpha = alpha;
  ['A / D tippen', '← → lenken', 'Leertaste = E-Bike (peinlich)'].forEach((t, i) => {
    const y = 138 + i * 11;
    px(0, y - 1, 124, 10, 'rgba(0,0,0,0.6)');
    text(t, 4, y + 0.5, { size: 6.5, color: '#ffd400' });
  });
  u.globalAlpha = 1; ctx.globalAlpha = 1;
}

function drawCountdown() {
  const n = Math.ceil(race.countdown);
  text(String(n), W / 2, 55, { size: 28, color: '#fff', align: 'center' });
}

const MISSION = 'Albert hat den Schauinsland in 38:30 geschafft und hat es dir beim Frühstück erzählt. ' +
  'Beweise, dass du es unter 40 Minuten schaffst. Was kann schon schiefgehen?';

// Tastenkappe im Pixel-Look (Kappe auf der Pixel-Ebene, Beschriftung auf der UI-Ebene)
function keycap(label, x, y, w = 13, h = 13, on = false) {
  px(x, y + 2, w, h, '#111');
  px(x, y, w, h, on ? '#ffd400' : '#e8e8ea');
  px(x + 1, y + 1, w - 2, 1, '#fff');
  px(x, y + h - 2, w, 2, on ? '#c9a200' : '#a9a9b0');
  text(label, x + w / 2, y + 2.5, { size: label.length > 2 ? 6 : 8, color: '#111', align: 'center', shadow: false });
}

function drawTitle() {
  px(0, 0, W, 132, 'rgba(10,20,15,0.8)');
  text('MARKO AM SCHAUINSLAND', W / 2, 5, { size: 14, color: '#ff5', align: 'center' });
  wrapLines(MISSION, 286, 6.5).forEach((l, i) => text(l, W / 2, 25 + i * 9, { size: 6.5, align: 'center', color: '#fff' }));

  // Steuerung als Tasten-Grafik
  const ky = 63, blink = Math.floor(stateTime * 3) % 2 === 0;
  keycap('A', 40, ky, 13, 13, blink); keycap('D', 56, ky, 13, 13, !blink);
  text('abwechselnd = treten', 54, ky + 18, { size: 5.5, align: 'center', color: '#ddd' });
  keycap('←', 142, ky); keycap('→', 158, ky);
  text('lenken', 156, ky + 18, { size: 5.5, align: 'center', color: '#ddd' });
  keycap('LEERTASTE', 226, ky, 62, 13);
  text('E-Bike (peinlich)', 257, ky + 18, { size: 5.5, align: 'center', color: '#ddd' });

  if (Math.floor(stateTime * 2) % 2 === 0) text('Beliebige Taste zum Start', W / 2, 100, { size: 8, align: 'center' });
  const best = loadBest();
  if (best) text('Deine Bestzeit: ' + fmtTime(best), W / 2, 116, { size: 6.5, align: 'center', color: '#8cf' });
  text('M = Ton aus/an', W - 4, 124, { size: 5, align: 'right', color: '#ccc' });

  // Marko fährt unten im Bild vorbei
  const mx = ((stateTime * 45) % (W + 100)) - 50;
  drawBillboard('marko_ride', mx, 178, 48, stateTime * 8);
}

function drawGameOver() {
  const r = race.result;
  for (let i = 0; i < 9; i++) px(0, i * 20, W, 20, lerpColor('#1c0303', '#8a2a10', i / 8));
  px(0, 150, W, 30, '#1a0a08');
  for (let i = 0; i < 30; i++) {                                    // Glut
    const y = (hash(i + 9) * 150 + stateTime * (14 + hash(i) * 26)) % 150;
    px(Math.round(hash(i) * W), Math.round(150 - y), 1, 1, '#ff9a50');
  }
  drawBillboard('marko_cry', 72, 164, 112);                         // Marko groß
  drawBillboard('albert_chair', 258, 164, 64);
  px(150, 76, 148, 26, '#111'); px(151, 77, 146, 24, '#fff');       // Albert-Sprechblase
  px(252, 102, 5, 1, '#111'); px(253, 102, 3, 1, '#fff'); px(254, 103, 1, 2, '#111');
  text('38:12.', 224, 79, { size: 6.5, color: '#111', align: 'center', shadow: false });
  text('Du hast aber nett gekämpft.', 224, 88, { size: 5.5, color: '#111', align: 'center', shadow: false });

  text('THE END OF THE WORLD', W / 2, 5, { size: 15, color: '#f44', align: 'center' });
  text('Markos Zeit: ' + fmtTime(r.proj), W / 2, 25, { size: 10, align: 'center', color: '#fff' });
  text(r.isBest ? 'Neue Bestzeit! (Trotzdem zu langsam.)' : 'Bestzeit: ' + fmtTime(r.best), W / 2, 39, { size: 6, align: 'center', color: '#8cf' });
  if (stateTime > 1.2 && Math.floor(stateTime * 2) % 2 === 0) text('R oder Tap = nochmal', W / 2, 164, { size: 7, align: 'center' });

  if (stateTime < 1) { ctx.globalAlpha = 1 - stateTime; px(0, 0, W, H, '#fff'); ctx.globalAlpha = 1; }   // kommt aus dem Weiß
}

// =====================================================================
// Game Loop (fixed timestep)
// =====================================================================
function update(dt) {
  const acts = actions.splice(0);
  if (acts.includes('restart') && state !== 'LOADING') { setState('PLAY'); return; }     // R = neu starten
  stateTime += dt;
  States[state].update(dt, acts);
}

function render() {
  u.clearRect(0, 0, W, H);
  States[state].draw();
  if (state === 'PLAY' && race.ev.garmin.phase === 'black') {      // 4. Garmin ist aus
    px(0, 0, W, H, '#000');
    u.clearRect(0, 0, W, H);
  }
}

let last = performance.now();
let acc = 0;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;                          // Tab war im Hintergrund
  acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}

setState('LOADING');
requestAnimationFrame(frame);
