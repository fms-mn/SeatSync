import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './components';

describe('accessible UI states', () => {
  it('renders an informative empty state', () => {
    render(<MemoryRouter><EmptyState title="No upcoming shows" text="Browse the catalog." /></MemoryRouter>);
    expect(screen.getByRole('heading', {name:'No upcoming shows'})).toBeInTheDocument();
    expect(screen.getByText('Browse the catalog.')).toBeInTheDocument();
  });
});
