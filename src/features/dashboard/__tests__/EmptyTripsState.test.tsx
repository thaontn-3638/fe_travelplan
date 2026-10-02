import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../i18n';
import { EmptyTripsState } from '../components/EmptyTripsState';

describe('EmptyTripsState', () => {
  it('renders the no-trips title and description', () => {
    render(<EmptyTripsState />);

    expect(screen.getByText('No trips yet')).toBeTruthy();
    expect(screen.getByText('Create your first trip to start planning your itinerary.')).toBeTruthy();
  });
});
