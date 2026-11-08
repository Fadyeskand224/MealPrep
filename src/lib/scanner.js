// Camera barcode scanning. Frames are decoded on the device: video never leaves the phone.
// Uses the browser's built-in BarcodeDetector where it exists (Android Chrome); everywhere else
// (iPhone Safari) it loads the ZXing decoder on demand, so it costs nothing until you scan.

export class ScannerError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // 'unsupported' | 'denied' | 'busy' | 'error'
  }
}

const WANTED = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new ScannerError('unsupported', 'This browser cannot use the camera here.');
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (e) {
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw new ScannerError('denied', 'Camera access was blocked.');
    if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') throw new ScannerError('unsupported', 'No camera was found.');
    if (e.name === 'NotReadableError') throw new ScannerError('busy', 'The camera is being used by another app.');
    throw new ScannerError('error', 'Could not start the camera.');
  }
}

/**
 * Starts scanning. Creates its own <video> inside `container` so one scan session can never switch off
 * another one's camera view (React may start, stop and restart a scanner in quick succession).
 * Calls onCode(rawText) for every successful decode (the caller dedupes).
 * Returns { stop, torch } where torch is null or { toggle(on) }.
 */
export async function startScanner(container, onCode) {
  const stream = await openCamera();
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-label', 'Camera view');
  video.muted = true;
  container.prepend(video);
  const [track] = stream.getVideoTracks();
  let stopped = false;
  let timer = 0;
  let controls = null;

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    try { controls?.stop(); } catch { /* already stopped */ }
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    video.remove();
  };

  const torch = track?.getCapabilities?.().torch
    ? { toggle: (on) => track.applyConstraints({ advanced: [{ torch: !!on }] }) }
    : null;

  try {
    // Engine 1: the browser's own detector.
    if ('BarcodeDetector' in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const formats = WANTED.filter((f) => supported.includes(f));
        if (formats.length) {
          const detector = new window.BarcodeDetector({ formats });
          video.srcObject = stream;
          await video.play();
          const loop = async () => {
            if (stopped) return;
            try {
              if (video.readyState >= 2 && !document.hidden) {
                const found = await detector.detect(video);
                if (found[0]?.rawValue) onCode(found[0].rawValue);
              }
            } catch { /* a bad frame is fine, try the next one */ }
            timer = setTimeout(loop, 120);
          };
          loop();
          return { stop, torch, engine: 'native' };
        }
      } catch { /* fall through to ZXing */ }
    }

    // Engine 2: ZXing, fetched only now.
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);
    const hints = new Map([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
      [DecodeHintType.TRY_HARDER, true],
    ]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
    controls = await reader.decodeFromStream(stream, video, (result) => {
      if (!stopped && result) onCode(result.getText());
    });
    if (stopped) controls.stop();
    return { stop, torch, engine: 'zxing' };
  } catch (e) {
    stop();
    throw e instanceof ScannerError ? e : new ScannerError('error', 'Could not start the scanner.');
  }
}
