import { Icon } from './ui';

/** Banner for pantry items that are expired or close to expiring. Renders nothing when all is well. */
export default function ExpiryAlert({ items, onClick }) {
  if (!items.length) return null;
  const expired = items.filter((i) => i.status === 'expired').length;
  const shown = items.slice(0, 3).map((i) => `${i.name} (${i.label.replace(/^Expires /, '').replace(/^Expired /, 'expired ')})`);
  const more = items.length - shown.length;

  const body = (
    <>
      <span className="alert-ico"><Icon name="alert" size={22} /></span>
      <span className="alert-text">
        <b>
          {items.length} pantry {items.length === 1 ? 'item needs' : 'items need'} attention
          {expired > 0 && ` · ${expired} expired`}
        </b>
        <small>{shown.join(', ')}{more > 0 ? ` +${more} more` : ''}</small>
      </span>
      {onClick && <span className="chev">›</span>}
    </>
  );

  return onClick ? (
    <button className={`expiry-alert ${expired ? 'danger' : ''}`} onClick={onClick}>{body}</button>
  ) : (
    <div className={`expiry-alert ${expired ? 'danger' : ''}`} role="alert">{body}</div>
  );
}
