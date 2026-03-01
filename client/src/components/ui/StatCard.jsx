import React, { useState, useEffect, useRef } from 'react';

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(animate);
      else prevValue.current = end;
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

const colorMap = {
  amber:  { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
  blue:   { accent: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.15)' },
  green:  { accent: '#1B2A72', bg: 'rgba(27,42,114,0.08)', border: 'rgba(27,42,114,0.15)' },
  purple: { accent: '#a855f7', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.15)' },
  red:    { accent: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.15)' },
  cyan:   { accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)',  border: 'rgba(6,182,212,0.15)' },
};

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'amber', suffix = '' }) {
  const c = colorMap[color] || colorMap.amber;

  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</p>
        {Icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
          >
            <Icon size={20} style={{ color: c.accent }} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{ color: c.accent }}>
        {typeof value === 'number' ? (
          <><AnimatedNumber value={value} />{suffix}</>
        ) : (
          <span className="text-xl">{value}{suffix}</span>
        )}
      </p>
      {subtitle && (
        <p className="text-sm text-gray-400 mt-1.5 font-medium">{subtitle}</p>
      )}
    </div>
  );
}
