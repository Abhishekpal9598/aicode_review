import React from 'react';

export default function ScoreRing({ score = 100, size = 110, strokeWidth = 8 }) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  let strokeColor = '#10b981'; // emerald
  let textColor = 'text-emerald-400';
  let badgeText = 'Excellent';

  if (normalizedScore < 50) {
    strokeColor = '#f43f5e'; // rose
    textColor = 'text-rose-400';
    badgeText = 'Needs Work';
  } else if (normalizedScore < 80) {
    strokeColor = '#f59e0b'; // amber
    textColor = 'text-amber-400';
    badgeText = 'Fair';
  }

  return (
    <div
      data-testid="score-ring"
      className="flex flex-col items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div className="relative flex items-center justify-center">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          role="img"
          aria-label={`Score: ${normalizedScore} out of 100`}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated score progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            data-testid="score-value"
            className={`text-2xl font-black tracking-tight ${textColor}`}
          >
            {normalizedScore}
          </span>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            / 100
          </span>
        </div>
      </div>
      <span className={`text-xs font-semibold mt-1.5 ${textColor}`}>
        {badgeText}
      </span>
    </div>
  );
}
