export function startBackgroundMusic(audioContext: AudioContext): () => void {
  const melody: Array<{ frequency: number; duration: number }> = [
    { frequency: 261.63, duration: 0.25 },
    { frequency: 329.63, duration: 0.25 },
    { frequency: 392.00, duration: 0.25 },
    { frequency: 523.25, duration: 0.25 },
    { frequency: 392.00, duration: 0.25 },
    { frequency: 329.63, duration: 0.25 },
    { frequency: 261.63, duration: 0.25 },
    { frequency: 329.63, duration: 0.25 },
  ];

  let currentTime = audioContext.currentTime;
  let timeoutId: NodeJS.Timeout | null = null;
  const oscillators: OscillatorNode[] = [];
  let isPlaying = true; // Flag to control playback loop

  const playNote = () => {
    if (!isPlaying || audioContext.state === 'closed') {
      console.log('Stopping playNote: AudioContext closed or playback stopped');
      return;
    }

    melody.forEach(note => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'square';
      oscillator.frequency.value = note.frequency;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      gainNode.gain.setValueAtTime(0.2, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + note.duration * 0.9);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + note.duration);

      oscillators.push(oscillator);
      currentTime += note.duration;
    });

    const durationMs = melody.reduce((sum, note) => sum + note.duration, 0) * 1000;
    timeoutId = setTimeout(playNote, durationMs);
  };

  // Start playback
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(err => console.error('Failed to resume AudioContext:', err));
  }
  playNote();

  // Cleanup function
  return () => {
    console.log('Cleaning up background music');
    isPlaying = false; // Stop the loop
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    oscillators.forEach(osc => {
      if (audioContext.state !== 'closed') {
        osc.stop();
        osc.disconnect();
      }
    });
    oscillators.length = 0;
  };
}

export function playCollectionSound(audioContext: AudioContext): void {
  if (audioContext.state === 'closed') {
    console.log('Skipping playCollectionSound: AudioContext closed');
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const frequencies = [261.63, 293.66, 329.63, 349.23, 392.00];
  const index = Math.floor(Math.random() * frequencies.length);
  oscillator.frequency.value = frequencies[index];
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.3);
}

export function playCrashSound(audioContext: AudioContext): void {
  if (audioContext.state === 'closed') {
    console.log('Skipping playCrashSound: AudioContext closed');
    return;
  }

  const noise = audioContext.createBufferSource();
  const bufferSize = audioContext.sampleRate * 0.5;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  noise.buffer = buffer;

  const gainNode = audioContext.createGain();
  noise.connect(gainNode);
  gainNode.connect(audioContext.destination);

  gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

  noise.start();
  noise.stop(audioContext.currentTime + 0.5);
}