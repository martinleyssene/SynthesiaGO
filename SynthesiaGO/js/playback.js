// Debug engine
console.log("PLAYBACK TEST 12345");
const DEBUG_ENGINE = false;let debugLastTime = performance.now();
let debugFrameCount = 0;
let debugFPS = 0;

// ===== Nouveau moteur des notes live (V1.3A.2) =====
let liveNotes = [];
let nextLiveNoteId = 1;

function getSongTime() {
  if (!playing || songStartTime === null) return 0;
  return (performance.now() - songStartTime) / 1000 / speedFactor;
}

function getLiveTime() {
  return performance.now() / 1000;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * CALCUL UNIFIÉ DE POSITION VERTICALE - FORMULE MATHÉMATIQUE UNIQUE
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Principe : Mouvement linéaire à vitesse constante PIXELS_PER_SECOND
 * 
 * Formule générale :
 *   Y(t) = Y₀ + v · (t - t₀)
 * 
 * où :
 *   Y(t)  = position à l'écran (pixels, 0 = haut, ↑ = vers bas)
 *   Y₀    = position initiale
 *   v     = vitesse en pixels/seconde (+ = chute, - = montée)
 *   t     = temps courant du morceau (secondes)
 *   t₀    = temps de démarrage de l'événement (secondes)
 * 
 * Cas appliqués :
 *   • Notes planifiées    : Y = -noteHeight + (t - tStart) · v  [chute]
 *   • Notes live actives  : Y = fallH - max(4, (t - tStart) · v) [étirement]
 *   • Notes live relâchées: Y = fallH - (t - tRelease) · v      [montée]
 * ═══════════════════════════════════════════════════════════════════
 */
function getNoteScreenY(songTime, note, fallH, PIXELS_PER_SECOND) {

    // Notes live : cette fonction n'est plus utilisée par le moteur live.
    // Elles sont entièrement animées dans loop().

    if (note.liveActive) {
        return fallH - 4;
    }

    // Notes planifiées

    return (
        -note.noteHeight
        + (songTime - note.startTime) * PIXELS_PER_SECOND
    );

}

function spawnNote(midi, hand = 'right', durationSec = 0.3) {
  const note = noteLayout.find(n => n.midi === midi);
  if (!note) return;
  const PIXELS_PER_SECOND = FALL_SPEED * speedFactor;
  const noteHeight = Math.max(18, durationSec * PIXELS_PER_SECOND);
  const el = document.createElement('div');
  el.className = 'note-block ' + hand;
  el.style.left = note.x + 2 + 'px';
  el.style.width = note.w - 4 + 'px';
  el.style.height = noteHeight + 'px';
  el.textContent = NOTE_NAMES[note.n];
  fallZone.appendChild(el);
  const songTime = getLiveTime();
  noteBlocks.push({ 
    el, midi, hand, 
    startTime: songTime, 
    noteHeight,
    releaseTime: null,
    liveActive: false,
    triggered: false 
  });
}

function loop(ts) {
  requestAnimationFrame(loop);
  
  const songTime = getSongTime();
  const fallH = fallZone.offsetHeight;
  const PIXELS_PER_SECOND = FALL_SPEED * speedFactor;
  
  if (DEBUG_ENGINE) {
    debugFrameCount++;
    const now = performance.now();
    const delta = now - debugLastTime;
    if (delta >= 1000) {
      debugFPS = Math.round((debugFrameCount * 1000) / delta);
      debugFrameCount = 0;
      debugLastTime = now;
    }
    const activeNotesCount = noteBlocks.length + Object.keys(liveNoteBlocks).length;
    document.getElementById('debug-fps-val').textContent = debugFPS.toString();
    document.getElementById('debug-time-val').textContent = songTime.toFixed(2);
    document.getElementById('debug-speed-val').textContent = Math.round(PIXELS_PER_SECOND).toString();
    document.getElementById('debug-notes-val').textContent = activeNotesCount.toString();
    document.getElementById('debug-panel').classList.add('visible');
  } else {
    document.getElementById('debug-panel').classList.remove('visible');
  }
  
  // ── NOTES PLANIFIÉES (MIDI / Démo) ──
  for (let i = noteBlocks.length - 1; i >= 0; i--) {
    const b = noteBlocks[i];
    const y = getNoteScreenY(songTime, b, fallH, PIXELS_PER_SECOND);
    b.el.style.top = y + 'px';
    
    if (y + b.noteHeight >= fallH && !b.triggered) {
      b.triggered = true;
      if (!rolandInput && soundEnabled && typeof playNote === "function") {
    playNote(b.midi, 80);
}
      activeKeys.add(b.midi);
      drawPiano();
      b.el.classList.add('hit');
    }
    
    if (y > fallH + 20) {
      activeKeys.delete(b.midi);
      drawPiano();
      b.el.remove();
      noteBlocks.splice(i, 1);
    }
  }
  
  // ── ORDONNANCEMENT DES NOTES FUTURES ──
  if (playing && songStartTime != null) {
    for (let i = scheduledEvents.length - 1; i >= 0; i--) {
      const ev = scheduledEvents[i];
      if (ev.time <= songTime) {
        spawnNote(ev.midi, ev.hand, ev.duration);
        scheduledEvents.splice(i, 1);
      }
    }
    if (scheduledEvents.length === 0 && noteBlocks.length === 0) {
      playing = false;
      setStatus('✅ Terminé');
    }
  }

  // ── NOTES EN DIRECT (Enregistrement / Jeu temps réel) ──

for (let i = liveNotes.length - 1; i >= 0; i--) {

    const note = liveNotes[i];
    const now = getLiveTime();

    if (!note.released) {

        const height = Math.max(
            4,
            (now - note.startTime) * PIXELS_PER_SECOND
        );

        note.el.style.height = height + "px";
        note.el.style.top = (fallH - height) + "px";

    } else {

        const elapsed = now - note.releaseTime;

        const top =
            (fallH - note.releaseHeight)
            - (elapsed * PIXELS_PER_SECOND);

        note.el.style.height =
            note.releaseHeight + "px";

        note.el.style.top =
            top + "px";

        if (top + note.releaseHeight < 0) {

            note.el.remove();
            liveNotes.splice(i, 1);

        }

    }

}

function spawnLiveNote(midi, source) {

    const layout = noteLayout.find(n => n.midi === midi);
    if (!layout) return;

    const fallH = fallZone.offsetHeight;
    const hand = midi < 60 ? "left" : "right";

    const el = document.createElement("div");

    el.className = "note-block " + hand + " live-note";
    el.style.left = (layout.x + 2) + "px";
    el.style.width = (layout.w - 4) + "px";
    el.style.height = "4px";
    el.style.top = (fallH - 4) + "px";

    el.textContent = NOTE_NAMES[layout.n];

    fallZone.appendChild(el);

    liveNotes.push({

        id: nextLiveNoteId++,

        midi: midi,

        el: el,

        startTime: getLiveTime(),

        released: false,

        releaseTime: null,

        releaseHeight: 4

    });

}

function releaseLiveNote(midi) {

    for (let i = 0; i < liveNotes.length; i++) {

        const note = liveNotes[i];

        if (note.midi !== midi) continue;

        if (note.released) continue;

        note.released = true;

        note.releaseTime = getLiveTime();

        note.releaseHeight =
            parseFloat(note.el.style.height) || 4;

        break;

    }

}

console.log("avant startSong");
function startSong() {
  if (scheduledEvents.length === 0) {
    runDemo();
    return;
  }
  playing = true;
  const fallDelay = fallZone.offsetHeight / (FALL_SPEED * speedFactor);
  songStartTime = performance.now() + fallDelay * 1000;
}

console.log("après startSong", typeof startSong);
console.log("startSong déclarée");
console.log("startSong déclarée", typeof startSong);

function stopSong() {
  playing = false;
  scheduledEvents = [];
  songStartTime = null;
  noteBlocks.forEach(b => b.el.remove());
  noteBlocks = [];
  for (const midi in liveNoteBlocks) {
    liveNoteBlocks[midi].el.remove();
}

liveNoteBlocks = {};
  activeKeys.clear();
  activeTouches = {};
  drawPiano();
  setStatus('Arrêté');
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

function playbackRecording() {
  if (!recordedSong) return;
  stopSong();
  scheduledEvents = [...recordedSong];
  const fallDelay = fallZone.offsetHeight / (FALL_SPEED * speedFactor);
  songStartTime = performance.now() + fallDelay * 1000;
  scheduledEvents = scheduledEvents.map(ev => ({ ...ev, time: ev.time + fallDelay / speedFactor }));
  playing = true;
  setStatus('▶ Relecture de ton enregistrement');
}

function runDemo() {
  stopSong();
  setStatus("🎵 Comptine d'un autre été");
  const bpm = 138,
    beat = 60 / bpm;
  const e = (t, midi, hand, dur) => ({ time: t * beat, midi, hand, duration: dur * beat });
  const left = [];
  for (let bar = 0; bar < 16; bar++) {
    const t = bar * 2;
    left.push(e(t + 0.0, 52, 'left', 0.45), e(t + 0.5, 55, 'left', 0.45), e(t + 1.0, 57, 'left', 0.45), e(t + 1.5, 55, 'left', 0.45));
  }
  const melody = [
    e(0, 64, 'right', 1), e(1, 67, 'right', 1), e(2, 69, 'right', 1), e(3, 67, 'right', 1),
    e(4, 64, 'right', 1), e(5, 67, 'right', 1), e(6, 69, 'right', 2),
    e(8, 69, 'right', 1), e(9, 71, 'right', 1), e(10, 72, 'right', 1), e(11, 71, 'right', 1),
    e(12, 69, 'right', 1), e(13, 67, 'right', 1), e(14, 64, 'right', 2),
    e(16, 64, 'right', 1), e(17, 62, 'right', 1), e(18, 60, 'right', 1), e(19, 62, 'right', 1),
    e(20, 64, 'right', 1), e(21, 65, 'right', 1), e(22, 67, 'right', 2),
    e(24, 67, 'right', 1), e(25, 69, 'right', 1), e(26, 71, 'right', 1), e(27, 72, 'right', 1),
    e(28, 74, 'right', 1), e(29, 72, 'right', 1), e(30, 71, 'right', 2),
  ];
  scheduledEvents = [...left, ...melody];
  const fallDelay = fallZone.offsetHeight / (FALL_SPEED * speedFactor);
  songStartTime = performance.now() + fallDelay * 1000;
  scheduledEvents = scheduledEvents.map(ev => ({ ...ev, time: ev.time + fallDelay / speedFactor }));
  playing = true;
  if (scoreEnabled) resetScore();
}

async function loadMidi(e) {
  const file = e.target.files[0];
  if (!file) return;
  setStatus('⏳ Lecture…');
  const buf = await file.arrayBuffer();
  try {
    const events = parseMidi(new Uint8Array(buf));
    stopSong();
    scheduledEvents = events;
    setStatus(`✅ ${file.name} — ${events.length} notes`);
    const fallDelay = fallZone.offsetHeight / (FALL_SPEED * speedFactor);
    songStartTime = performance.now() + fallDelay * 1000;
    scheduledEvents = scheduledEvents.map(ev => ({ ...ev, time: ev.time + fallDelay / speedFactor }));
    playing = true;
    if (scoreEnabled) resetScore();
  } catch (err) {
    setStatus('❌ Erreur MIDI : ' + err.message);
  }
}

function parseMidi(data) {
  let pos = 0;
  const read = n => { const s = data.slice(pos, pos + n); pos += n; return s; };
  const readInt = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 8) | data[pos++]; return v; };
  const readVLQ = () => { let v = 0, b; do { b = data[pos++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
  if (String.fromCharCode(...read(4)) !== 'MThd') throw new Error('Pas un fichier MIDI');
  readInt(4); readInt(2); const nt = readInt(2), tp = readInt(2);
  let tempo = 500000; const allNotes = [];
  for (let tr = 0; tr < nt; tr++) {
    if (pos >= data.length) break;
    const hdr = String.fromCharCode(...data.slice(pos, pos + 4)); pos += 4;
    if (hdr !== 'MTrk') break;
    const len = readInt(4), end = pos + len;
    let tick = 0, status = 0; const opens = {};
    while (pos < end) {
      tick += readVLQ();
      let b = data[pos];
      if (b & 0x80) { status = b; pos++; }
      const type = status >> 4, ch = status & 0xf;
      if (status === 0xff) {
        const mt = data[pos++], ml = readVLQ();
        if (mt === 0x51 && ml === 3) tempo = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
        pos += ml;
      } else if (type === 0xf) {
        pos += readVLQ();
      } else if (type === 9 && data[pos + 1] > 0) {
        const m = data[pos]; pos += 2; opens[m] = { tick, ch };
      } else if (type === 8 || (type === 9 && data[pos + 1] === 0)) {
        const m = data[pos]; pos += 2;
        if (opens[m]) {
          const { tick: st, ch: sch } = opens[m];
          allNotes.push({ time: (st / tp) * (tempo / 1e6), midi: m, duration: ((tick - st) / tp) * (tempo / 1e6), hand: sch === 0 ? 'right' : 'left' });
          delete opens[m];
        }
      } else { pos += [0xc0, 0xd0].includes(type << 4) ? 1 : 2; }
    }
    pos = end;
  }
  return allNotes.sort((a, b) => a.time - b.time);
}
}