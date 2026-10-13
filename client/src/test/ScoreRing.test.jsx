import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ScoreRing from '../components/ScoreRing';

describe('ScoreRing Component', () => {
  it('renders score value correctly', () => {
    render(<ScoreRing score={85} />);
    expect(screen.getByTestId('score-value')).toHaveTextContent('85');
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('renders fair rating badge when score is between 50 and 79', () => {
    render(<ScoreRing score={65} />);
    expect(screen.getByTestId('score-value')).toHaveTextContent('65');
    expect(screen.getByText('Fair')).toBeInTheDocument();
  });

  it('renders needs work rating badge when score is below 50', () => {
    render(<ScoreRing score={35} />);
    expect(screen.getByTestId('score-value')).toHaveTextContent('35');
    expect(screen.getByText('Needs Work')).toBeInTheDocument();
  });

  it('clamps scores above 100 or below 0', () => {
    const { rerender } = render(<ScoreRing score={150} />);
    expect(screen.getByTestId('score-value')).toHaveTextContent('100');

    rerender(<ScoreRing score={-20} />);
    expect(screen.getByTestId('score-value')).toHaveTextContent('0');
  });
});
