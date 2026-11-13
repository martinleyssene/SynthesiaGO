function buildLayout() {
  noteLayout = [];
  totalWhites = 0;
  for (let oct = START_OCTAVE; oct < START_OCTAVE + NUM_OCTAVES; oct++) {
    for (let n = 0; n < 12; n++) {
      const midi = (oct + 1) * 12 + n;
      const isBlack = [1, 3, 6, 8, 10].includes(n);
      noteLayout.push({ midi, isBlack, n, oct });
      if (!isBlack) totalWhites++;
    }
  }
}

function resizeAll() {
  const pw = window.innerWidth;
  pianoCanvas.width = pw;
  pianoCanvas.height = PIANO_H;
  pianoCanvas.style.width = pw + 'px';
  pianoCanvas.style.height = PIANO_H + 'px';
  document.getElementById('piano-wrapper').style.height = PIANO_H + 'px';
  whiteW = pw / totalWhites;
  blackW = whiteW * 0.6;
  blackH = PIANO_H * 0.6;
  let wi = 0;
  for (const note of noteLayout) {
    if (!note.isBlack) {
      note.x = wi * whiteW;
      note.w = whiteW;
      wi++;
    }
  }
  for (let i = 0; i < noteLayout.length; i++) {
    const note = noteLayout[i];
    if (note.isBlack) {
      const prev = noteLayout[i - 1];
      note.x = prev.x + prev.w - blackW / 2;
      note.w = blackW;
    }
  }
  const fz = document.getElementById('fall-zone');
  gridCanvas.width = fz.offsetWidth;
  gridCanvas.height = fz.offsetHeight;
  drawGrid();
  drawPiano();
}

function drawGrid() {
  const W = gridCanvas.width;
  const H = gridCanvas.height;
  gridCtx.clearRect(0, 0, W, H);
  for (const note of noteLayout) {
    if (!note.isBlack) {
      gridCtx.strokeStyle = '#ffffff08';
      gridCtx.lineWidth = 1;
      gridCtx.beginPath();
      gridCtx.moveTo(note.x, 0);
      gridCtx.lineTo(note.x, H);
      gridCtx.stroke();
    }
    if (note.n === 0) {
      gridCtx.fillStyle = '#ffffff18';
      gridCtx.font = '11px monospace';
      gridCtx.fillText('C' + note.oct, note.x + 2, H - 6);
    }
  }
}

function drawPiano() {
  const ctx = pianoCtx;
  const W = pianoCanvas.width;
  const H = pianoCanvas.height;
  ctx.clearRect(0, 0, W, H);
  for (const note of noteLayout) {
    if (note.isBlack) continue;
    const on = activeKeys.has(note.midi);
    ctx.fillStyle = on ? '#ffe060' : '#f0f0f0';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(note.x + 1, 0, note.w - 2, H - 2, [0, 0, 4, 4]);
    ctx.fill();
    ctx.stroke();
    if (note.n === 0) {
      ctx.fillStyle = on ? '#333' : '#999';
      ctx.font = `bold ${Math.max(9, whiteW * 0.45)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('C' + note.oct, note.x + note.w / 2, H - 8);
    }
  }
  for (const note of noteLayout) {
    if (!note.isBlack) continue;
    const on = activeKeys.has(note.midi);
    const grad = ctx.createLinearGradient(note.x, 0, note.x, blackH);
    if (on) {
      grad.addColorStop(0, '#ffd000');
      grad.addColorStop(1, '#997700');
    } else {
      grad.addColorStop(0, '#1a1a1a');
      grad.addColorStop(1, '#111');
    }
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(note.x, 0, note.w, blackH, [0, 0, 3, 3]);
    ctx.fill();
    ctx.stroke();
  }
}

function drawEditor() {
  if (!editorCtx) return;
  const W = editorCanvas.width;
  const H = editorCanvas.height;
  editorCtx.clearRect(0, 0, W, H);

  for (let i = 0; i < NUM_OCTAVES * 12; i++) {
    const y = i * EDITOR_ROW_H;
    const midi = (START_OCTAVE + NUM_OCTAVES + 1) * 12 - 1 - i;
    const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);
    editorCtx.fillStyle = isBlack ? '#0e0e16' : '#12121c';
    editorCtx.fillRect(EDITOR_PIANO_W, y, W - EDITOR_PIANO_W, EDITOR_ROW_H);

    editorCtx.strokeStyle = '#1a1a28';
    editorCtx.lineWidth = 1;
    editorCtx.beginPath();
    editorCtx.moveTo(EDITOR_PIANO_W, y);
    editorCtx.lineTo(W, y);
    editorCtx.stroke();

    const noteName = NOTE_NAMES[midi % 12];
    editorCtx.fillStyle = midi % 12 === 0 ? '#ffffff55' : '#ffffff22';
    editorCtx.font = '9px monospace';
    editorCtx.textAlign = 'right';
    editorCtx.fillText(noteName + (Math.floor(midi / 12) - 1), EDITOR_PIANO_W - 3, y + 13);
  }

  const maxTime = (editorCanvas.width - EDITOR_PIANO_W) / EDITOR_PX_S;
  for (let t = 0; t <= maxTime; t++) {
    const x = EDITOR_PIANO_W + t * EDITOR_PX_S;
    editorCtx.strokeStyle = t % 2 === 0 ? '#ffffff18' : '#ffffff08';
    editorCtx.lineWidth = 1;
    editorCtx.beginPath();
    editorCtx.moveTo(x, 0);
    editorCtx.lineTo(x, H);
    editorCtx.stroke();
    if (t % 2 === 0) {
      editorCtx.fillStyle = '#ffffff33';
      editorCtx.font = '9px monospace';
      editorCtx.textAlign = 'left';
      editorCtx.fillText(t + 's', x + 2, 10);
    }
  }

  editorNotes.forEach((note, idx) => {
    const row = midiToRow(note.midi);
    const x = EDITOR_PIANO_W + note.time * EDITOR_PX_S;
    const y = row * EDITOR_ROW_H;
    const w = Math.max(4, note.duration * EDITOR_PX_S - 2);
    const h = EDITOR_ROW_H - 2;
    const sel = editorSelected.has(idx);

    let color;
    if (note.color) {
      color = note.color;
    } else if (note.hand === 'left') {
      color = '#e8e800';
    } else if (note.hand === 'recorded') {
      color = '#44ddff';
    } else {
      color = '#e83060';
    }

    editorCtx.fillStyle = color;
    editorCtx.globalAlpha = sel ? 1 : 0.85;
    editorCtx.beginPath();
    editorCtx.roundRect(x, y + 1, w, h, 3);
    editorCtx.fill();
    editorCtx.globalAlpha = 1;

    if (sel) {
      editorCtx.strokeStyle = '#ffffff';
      editorCtx.lineWidth = 2;
      editorCtx.beginPath();
      editorCtx.roundRect(x, y + 1, w, h, 3);
      editorCtx.stroke();
    }

    if (w > 14) {
      editorCtx.fillStyle = '#000000aa';
      editorCtx.font = 'bold 9px sans-serif';
      editorCtx.textAlign = 'left';
      editorCtx.fillText(NOTE_NAMES[note.midi % 12], x + 3, y + 13);
    }
  });
}

function drawEditorPiano() {
  const ctx = editorPianoCtx;
  const W = editorPianoCanvas.width;
  const H = 80;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#13131a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff22';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Clique sur les notes pour les sélectionner • Glisse pour déplacer • Sélectionne puis 🎨 pour changer la couleur', W / 2, 45);
}
