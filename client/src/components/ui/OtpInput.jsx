import { useEffect, useRef } from 'react';

/** Six single-digit boxes with auto-advance, backspace and paste support. */
export default function OtpInput({ value, onChange, onComplete, disabled, error }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  useEffect(() => { refs.current[0]?.focus(); }, []);
  // After a failed attempt the boxes are cleared and re-enabled: put the cursor back in the first one.
  useEffect(() => { if (!disabled && value === '') refs.current[0]?.focus(); }, [disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (next) => {
    const v = next.replace(/\D/g, '').slice(0, 6);
    onChange(v);
    if (v.length === 6) onComplete?.(v);
  };

  const onInput = (i, e) => {
    const d = e.target.value.replace(/\D/g, '');
    if (!d) return;
    if (d.length > 1) { set(value.slice(0, i) + d); refs.current[Math.min(i + d.length, 5)]?.focus(); return; }
    set(value.slice(0, i) + d + value.slice(i + 1));
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const onKey = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) set(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) { set(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus(); }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  const onPaste = (e) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!t) return;
    e.preventDefault();
    set(t);
    refs.current[Math.min(t.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input
          key={i} ref={(el) => { refs.current[i] = el; }} value={d} disabled={disabled}
          inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={6} aria-label={`Digit ${i + 1}`}
          onChange={(e) => onInput(i, e)} onKeyDown={(e) => onKey(i, e)} onPaste={onPaste} onFocus={(e) => e.target.select()}
          className={`input !h-14 !w-full !px-0 text-center text-2xl font-bold ${error ? '!border-secondary' : ''}`}
        />
      ))}
    </div>
  );
}
