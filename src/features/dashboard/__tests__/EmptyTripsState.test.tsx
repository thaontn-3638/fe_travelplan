import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../i18n';
import { EmptyTripsState } from '../components/EmptyTripsState';

describe('EmptyTripsState', () => {
  it('renders the no-trips title and description', () => {
    render(<EmptyTripsState />);

    expect(screen.getByText('No trips yet')).toBeTruthy();
    expect(
      screen.getByText('Your planned trips will show up here once trip management ships in a later sprint.'),
    ).toBeTruthy();
  });
});
