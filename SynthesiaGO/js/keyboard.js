function findNoteAt(x, y) {
  let found = null;
  for (const note of noteLayout) {
    if (note.isBlack && x >= note.x && x <= note.x + note.w && y <= blackH) {
      found = note;
      break;
    }
  }
  if (!found) {
    for (const note of noteLayout) {
      if (!note.isBlack && x >= note.x && x <= note.x + note.w) {
        found = note;
        break;
      }
    }
  }
  return found;
}

function initKeyboardControls() {
  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    const midi = KEY_MAP[e.key.toLowerCase()];
    if (midi != null) onNoteOn(midi, 80, 'keyboard');
  });

  document.addEventListener('keyup', e => {
    const midi = KEY_MAP[e.key.toLowerCase()];
    if (midi != null) onNoteOff(midi);
  });

  let mouseDown = false;
  let mouseCurrentMidi = null;

  pianoCanvas.addEventListener('mousedown', e => {
    mouseDown = true;
    const rect = pianoCanvas.getBoundingClientRect();
    const note = findNoteAt(e.clientX - rect.left, e.clientY - rect.top);
    if (note) {
      mouseCurrentMidi = note.midi;
      onNoteOn(note.midi, 80, 'click');
    }
  });

  pianoCanvas.addEventListener('mousemove', e => {
    if (!mouseDown) return;
    const rect = pianoCanvas.getBoundingClientRect();
    const note = findNoteAt(e.clientX - rect.left, e.clientY - rect.top);
    if (note && note.midi !== mouseCurrentMidi) {
      if (mouseCurrentMidi != null) onNoteOff(mouseCurrentMidi);
      mouseCurrentMidi = note.midi;
      onNoteOn(note.midi, 80, 'click');
    }
  });

  window.addEventListener('mouseup', () => {
    if (mouseCurrentMidi != null) onNoteOff(mouseCurrentMidi);
    mouseCurrentMidi = null;
    mouseDown = false;
  });

  pianoCanvas.addEventListener('mouseleave', () => {
    if (!mouseDown && mouseCurrentMidi != null) {
      onNoteOff(mouseCurrentMidi);
      mouseCurrentMidi = null;
    }
  });

  pianoCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    [...e.changedTouches].forEach(t => {
      const rect = pianoCanvas.getBoundingClientRect();
      const note = findNoteAt(t.clientX - rect.left, t.clientY - rect.top);
      if (note) {
        activeTouches[t.identifier] = note.midi;
        onNoteOn(note.midi, 80, 'touch');
      }
    });
  }, { passive: false });

  pianoCanvas.addEventListener('touchmove', e => {
    e.preventDefault();
    [...e.changedTouches].forEach(t => {
      const rect = pianoCanvas.getBoundingClientRect();
      const note = findNoteAt(t.clientX - rect.left, t.clientY - rect.top);
      const prevMidi = activeTouches[t.identifier];
      if (note && note.midi !== prevMidi) {
        if (prevMidi != null) onNoteOff(prevMidi);
        activeTouches[t.identifier] = note.midi;
        onNoteOn(note.midi, 80, 'touch');
      }
    });
  }, { passive: false });

  pianoCanvas.addEventListener('touchend', e => {
    e.preventDefault();
    [...e.changedTouches].forEach(t => {
      const midi = activeTouches[t.identifier];
      if (midi != null) onNoteOff(midi);
      delete activeTouches[t.identifier];
    });
  }, { passive: false });

  pianoCanvas.addEventListener('touchcancel', e => {
    e.preventDefault();
    [...e.changedTouches].forEach(t => {
      const midi = activeTouches[t.identifier];
      if (midi != null) onNoteOff(midi);
      delete activeTouches[t.identifier];
    });
  }, { passive: false });
}
