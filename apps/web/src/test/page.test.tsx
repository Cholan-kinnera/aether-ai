import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import HomePage from '../app/page';

describe('HomePage Component', () => {
  it('renders the main heading and branding', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/AETHER/);
    expect(screen.getByText(/Urban Air Quality Intelligence/)).toBeInTheDocument();
  });

  it('renders all six core product modules', () => {
    render(<HomePage />);
    const expectedModules = [
      'AQI Intelligence',
      'GenAI Air Quality Copilot',
      'Smart Daily Routine Planner',
      'Indoor Air Optimizer',
      'Sustainable Action Simulator',
      'Family Protection Dashboard',
    ];

    for (const title of expectedModules) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('includes accessible section heading for assistive technologies', () => {
    render(<HomePage />);
    const modulesSection = screen.getByRole('region', { name: /core product modules/i });
    expect(modulesSection).toBeInTheDocument();
  });
});
