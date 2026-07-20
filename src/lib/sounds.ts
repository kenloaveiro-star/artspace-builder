let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

const createOscillator = (
  frequency: number,
  duration: number,
  type: OscillatorType = 'square',
  volume: number = 0.1
): void => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Audio not supported');
  }
};

export const playTap = (): void => {
  createOscillator(800, 0.05, 'square', 0.05);
};

export const playSuccess = (): void => {
  createOscillator(523, 0.1, 'sine', 0.08);
  setTimeout(() => createOscillator(659, 0.1, 'sine', 0.08), 100);
  setTimeout(() => createOscillator(784, 0.15, 'sine', 0.08), 200);
};

export const playError = (): void => {
  createOscillator(200, 0.2, 'sawtooth', 0.05);
};

export const playGameOver = (): void => {
  createOscillator(400, 0.15, 'sine', 0.08);
  setTimeout(() => createOscillator(300, 0.15, 'sine', 0.08), 150);
  setTimeout(() => createOscillator(200, 0.3, 'sine', 0.08), 300);
};

export const playPoint = (): void => {
  createOscillator(880, 0.08, 'sine', 0.05);
};

export const playMove = (): void => {
  createOscillator(440, 0.03, 'square', 0.03);
};

export const playNewRecord = (): void => {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => createOscillator(freq, 0.15, 'sine', 0.1), i * 120);
  });
};
