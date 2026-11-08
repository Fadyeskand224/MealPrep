import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Sheet } from './ui';
import { api } from '../lib/api';
import { normalizeScan } from '../lib/barcodeFormat';
import { pantryNameFor } from '../lib/productMatch';
import { startScanner } from '../lib/scanner';
import { MAX_PANTRY } from '../lib/store';

const SAME_CODE_COOLDOWN = 4000; // a barcode stays in view for a while; only count it once

let nextId = 1;

/**
 * Full-screen-ish scanner. Every product read by the camera is added to the pantry straight away;
 * the list underneath lets you fix a name or undo, and expiration dates are set later in the pantry.
 */
export default function ScanSheet({ pantry, onAdd, onRemove, onRename, onClose }) {
  const viewRef = useRef(null); // the scanner adds its own <video> in here
  const scannerRef = useRef(null);
  const recent = useRef(new Map()); // code -> time last handled
  const [status, setStatus] = useState('starting'); // starting | scanning | denied | unsupported | busy | error
  const [rows, setRows] = useState([]);              // newest first
  const [announce, setAnnounce] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [manual, setManual] = useState('');
  const pantryRef = useRef(pantry);
  pantryRef.current = pantry;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const patch = useCallback((id, changes) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...changes } : x))), []);

  /** Adds `name` to the pantry unless it's already there or the pantry is full. Returns the row state. */
  const addName = useCallback((name) => {
    if (pantryRef.current.includes(name)) return 'had';
    if (pantryRef.current.length >= MAX_PANTRY) return 'full';
    onAdd(name);
    return 'added';
  }, [onAdd]);

  const handleCode = useCallback(async (raw) => {
    const code = normalizeScan(raw);
    if (!code) return; // a misread frame; keep scanning
    const now = Date.now();
    if (now - (recent.current.get(code) || 0) < SAME_CODE_COOLDOWN) return;
    recent.current.set(code, now);
    navigator.vibrate?.(40);

    const id = nextId++;
    setRows((r) => [{ id, code, state: 'looking', name: '', label: 'Looking up…' }, ...r]);
    try {
      const res = await api(`/barcode/${code}`);
      if (res.found) {
        const { name } = pantryNameFor(res.product);
        const label = [res.product.brands.split(',')[0], res.product.name || res.product.genericName].filter(Boolean).join(' · ');
        if (!name) {
          patch(id, { state: 'unnamed', name: '', label, note: 'Found the product but not a name. Type one to add it.' });
        } else {
          const state = addName(name);
          patch(id, { state, name, label });
          setAnnounce(state === 'added' ? `Added ${name}` : state === 'had' ? `${name} is already in your pantry` : 'Pantry is full');
        }
      } else {
        patch(id, { state: 'unnamed', name: '', label: `Barcode ${code}`, note: 'Not in the product database. Type a name to add it.' });
        setAnnounce('Product not found. Type a name to add it.');
      }
    } catch (e) {
      recent.current.delete(code); // let them retry the same barcode right away
      patch(id, { state: 'unnamed', name: '', label: `Barcode ${code}`, note: e.status === 0 ? 'You are offline. Type a name to add it.' : 'Lookup unavailable. Type a name to add it.' });
    }
  }, [addName, patch]);

  // Latest handler without restarting the camera every time state changes.
  const handlerRef = useRef(handleCode);
  handlerRef.current = handleCode;

  useEffect(() => {
    let cancelled = false;
    startScanner(viewRef.current, (c) => handlerRef.current(c))
      .then((s) => {
        if (cancelled) s.stop();
        else { scannerRef.current = s; setStatus('scanning'); }
      })
      .catch((e) => !cancelled && setStatus(e.kind || 'error'));
    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current = null;
    };
  }, []);

  const toggleTorch = async () => {
    try {
      await scannerRef.current?.torch?.toggle(!torchOn);
      setTorchOn(!torchOn);
    } catch { /* torch not available on this camera */ }
  };

  // Always reads the row's latest state, so a blur that follows Enter/Add can never commit it twice.
  const nameRow = (id, value) => {
    const row = rowsRef.current.find((x) => x.id === id);
    const name = value.trim().toLowerCase().slice(0, 60);
    if (!row || !name) return;
    if (row.state === 'unnamed') {
      const state = addName(name);
      patch(id, { state, name });
      setAnnounce(state === 'added' ? `Added ${name}` : state === 'had' ? `${name} is already in your pantry` : 'Pantry is full');
    } else if (row.state === 'added' && name !== row.name) {
      onRename(row.name, name);
      patch(id, { name });
      setAnnounce(`Renamed to ${name}`);
    }
  };

  const removeRow = (row) => {
    if (row.state === 'added') onRemove(row.name); // undo
    setRows((r) => r.filter((x) => x.id !== row.id));
  };

  const submitManual = (e) => {
    e.preventDefault();
    const text = manual.trim();
    if (!text) return;
    setManual('');
    const code = normalizeScan(text);
    if (code) {
      recent.current.delete(code);
      handleCode(code);
    } else if (/^\d+$/.test(text.replace(/\s+/g, ''))) {
      setAnnounce('That barcode number does not look right. Check the digits.');
    } else {
      const name = text.toLowerCase().slice(0, 60);
      const state = addName(name);
      setRows((r) => [{ id: nextId++, code: '', state, name, label: 'Typed by you' }, ...r]);
    }
  };

  const added = rows.filter((r) => r.state === 'added').length;
  const close = () => onClose(added);
  const problem = { denied: 'Camera access is blocked. Allow it in your browser settings to scan, or type items below.', unsupported: 'This device or browser can’t scan here. You can still type a barcode number or item name below.', busy: 'The camera is busy in another app. Close it and reopen the scanner.', error: 'The scanner couldn’t start. You can still type a barcode number or item name below.' }[status];

  return (
    <Sheet title="Scan barcodes" onClose={close}>
      <div className="sheet-body scan">
        <div className="eyebrow">Add to pantry</div>
        <h2>Scan barcodes</h2>
        <p className="muted">Point the camera at the barcode on the back of each product. Each one is added instantly. You can set expiration dates afterwards.</p>

        <div className={`scan-view ${status}`}>
          <div className="scan-video" ref={viewRef} />
          {status === 'scanning' && (
            <>
              <div className="scan-frame" aria-hidden="true"><span /></div>
              {scannerRef.current?.torch && (
                <button className={`scan-torch ${torchOn ? 'on' : ''}`} onClick={toggleTorch} aria-pressed={torchOn} aria-label="Toggle flashlight">
                  <Icon name="flash" size={20} />
                </button>
              )}
            </>
          )}
          {status === 'starting' && <div className="scan-msg"><div className="spinner" /> Starting camera…</div>}
          {problem && <div className="scan-msg" role="alert">{problem}</div>}
        </div>

        <form className="scan-manual" onSubmit={submitManual}>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Type a barcode number or item name"
            aria-label="Type a barcode number or item name"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={60}
          />
          <button className="btn btn-ghost" type="submit">Add</button>
        </form>

        <div className="sr-only" role="status" aria-live="polite">{announce}</div>

        {pantry.length >= MAX_PANTRY && <p className="form-error">Your pantry is full ({MAX_PANTRY} items). Remove some to add more.</p>}

        {rows.length > 0 && (
          <>
            <h3>This session <small>({added} added)</small></h3>
            <ul className="scan-list">
              {rows.map((row) => (
                <li key={row.id} className={`scan-row ${row.state}`}>
                  <span className="scan-state" aria-hidden="true">
                    {row.state === 'looking' ? <span className="spinner dark" /> : row.state === 'added' ? '✓' : row.state === 'had' ? '=' : row.state === 'full' ? '!' : '?'}
                  </span>
                  <div className="scan-main">
                    <small>{row.label}</small>
                    {row.state === 'looking' ? null : row.state === 'had' || row.state === 'full' ? (
                      <b>{row.name} <em>{row.state === 'had' ? 'already in your pantry' : 'pantry full'}</em></b>
                    ) : (
                      <form
                        className="scan-name"
                        onSubmit={(e) => {
                          e.preventDefault();
                          nameRow(row.id, e.currentTarget.elements.itemName.value);
                          document.activeElement?.blur?.();
                        }}
                      >
                        <input
                          key={`${row.id}-${row.state}`}
                          name="itemName"
                          defaultValue={row.name}
                          placeholder="Name this item"
                          aria-label={row.state === 'added' ? `Name for ${row.name}` : 'Name this item'}
                          maxLength={60}
                          autoCapitalize="none"
                          autoFocus={row.state === 'unnamed'}
                          enterKeyHint="done"
                          onBlur={(e) => nameRow(row.id, e.target.value)}
                        />
                        {row.state === 'unnamed' && <button className="btn btn-primary btn-sm" type="submit">Add</button>}
                      </form>
                    )}
                    {row.note && row.state === 'unnamed' && <small className="scan-note">{row.note}</small>}
                  </div>
                  <button className="pitem-x" onClick={() => removeRow(row)} aria-label={row.state === 'added' ? `Undo ${row.name}` : 'Dismiss'}>✕</button>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="muted fine">
          Product data from <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer noopener">Open Food Facts</a> (ODbL). The camera image stays on your device.
        </p>
      </div>
      <div className="scan-actions">
        <button className="btn btn-primary btn-block" onClick={close}>
          {added > 0 ? `Done · ${added} added` : 'Done'}
        </button>
      </div>
    </Sheet>
  );
}
