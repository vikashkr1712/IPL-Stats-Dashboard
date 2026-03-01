import React, { useState } from 'react';
import { getTeamInfo } from '../../utils/teamLogos';

/**
 * Renders a team logo image with fallback to colored abbreviation circle.
 * @param {string} team - Team name
 * @param {number} size - Size in pixels (default 32)
 * @param {object} style - Additional inline styles
 */
export default function TeamLogo({ team, size = 32, style = {} }) {
  const info = getTeamInfo(team);
  const [imgError, setImgError] = useState(false);

  if (info.logo && !imgError) {
    const isLocal = info.logo.startsWith('/');
    return (
      <img
        src={info.logo}
        alt={info.abbr}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: '50%',
          border: isLocal ? `2px solid ${info.color}` : 'none',
          background: isLocal ? '#fff' : 'transparent',
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  // Fallback: colored circle with abbreviation
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: info.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: Math.max(size * 0.3, 9),
        letterSpacing: '0.01em',
        flexShrink: 0,
        ...style,
      }}
    >
      {info.abbr}
    </div>
  );
}
