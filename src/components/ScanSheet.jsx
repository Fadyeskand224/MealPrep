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
export default function ScanSheet({ pantry, qty, onAdd, onUndo, onRename, onClose }) {
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
  const qtyRef = useRef(qty);
  qtyRef.current = qty;

  const patch = useCallback((id, changes) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...changes } : x))), []);

  /**
   * Adds `name` to the pantry. Something already there gets one more (quantity goes up) and the pantry
   * cap is respected. Returns the row state: 'added' | 'more' | 'full', plus the quantity after adding.
   */
  const addName = useCallback((name, nutrition = null) => {
    const items = pantryRef.current;
    if (items.includes(name)) {
      onAdd(name, { qty: 1, nutrition });
      return { state: 'more', count: (qtyRef.current[name] || 1) + 1 };
    }
    if (items.length >= MAX_PANTRY) return { state: 'full', count: 0 };
    onAdd(name, { qty: 1, nutrition });
    return { state: 'added', count: 1 };
  }, [onAdd]);

  const announceFor = (state, name, count) =>
    state === 'added' ? `Added ${name}` : state === 'more' ? `${name}: quantity is now ${count}` : 'Pantry is full';

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
        const nutrition = res.product.nutrition ? { ...res.product.nutrition, label } : null;
        if (!name) {
          patch(id, { state: 'unnamed', name: '', label, nutrition, note: 'Found the product but not a name. Type one to add it.' });
        } else {
          const { state, count } = addName(name, nutrition);
          patch(id, { state, name, label, count, nutrition });
          setAnnounce(announceFor(state, name, count));
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
      const { state, count } = addName(name, row.nutrition || null);
      patch(id, { state, name, count });
      setAnnounce(announceFor(state, name, count));
    } else if (row.state === 'added' && name !== row.name) {
      onRename(row.name, name);
      patch(id, { name });
      setAnnounce(`Renamed to ${name}`);
    }
  };

  const removeRow = (row) => {
    if (row.state === 'added' || row.state === 'more') onUndo(row.name); // one fewer, or removed if it was the only one
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
      const { state, count } = addName(name);
      setRows((r) => [{ id: nextId++, code: '', state, name, count, label: 'Typed by you' }, ...r]);
      setAnnounce(announceFor(state, name, count));
    }
  };

  const newItems = rows.filter((r) => r.state === 'added').length;                   // items that were not in the pantry before
  const scanned = rows.filter((r) => r.state === 'added' || r.state === 'more').length;
  const close = () => onClose(newItems);
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
            <h3>This session <small>({scanned} scanned)</small></h3>
            <ul className="scan-list">
              {rows.map((row) => (
                <li key={row.id} className={`scan-row ${row.state}`}>
                  <span className="scan-state" aria-hidden="true">
                    {row.state === 'looking' ? <span className="spinner dark" /> : row.state === 'added' ? '✓' : row.state === 'more' ? '+' : row.state === 'full' ? '!' : '?'}
                  </span>
                  <div className="scan-main">
                    <small>{row.label}</small>
                    {row.state === 'looking' ? null : row.state === 'more' || row.state === 'full' ? (
                      <b>{row.name} <em>{row.state === 'more' ? `quantity is now ${row.count}` : 'pantry full'}</em></b>
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
                    {row.nutrition && (row.state === 'added' || row.state === 'more') && (
                      <small className="scan-nutri">📊 {row.nutrition.kcal} kcal · P {row.nutrition.protein} · C {row.nutrition.carbs} · F {row.nutrition.fat} per 100 g, saved for your meal macros</small>
                    )}
                  </div>
                  <button className="pitem-x" onClick={() => removeRow(row)} aria-label={row.state === 'added' || row.state === 'more' ? `Undo ${row.name}` : 'Dismiss'}>✕</button>
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
          {scanned > 0 ? `Done · ${scanned} scanned` : 'Done'}
        </button>
      </div>
    </Sheet>
  );
}
