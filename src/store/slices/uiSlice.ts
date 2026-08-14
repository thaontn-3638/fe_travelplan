import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { theme } from '../../theme';

interface UiState {
  isSidebarOpen: boolean;
  searchQuery: string;
}

function getInitialSidebarOpen(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.innerWidth >= theme.breakpoints.values.md;
}

const initialState: UiState = {
  isSidebarOpen: getInitialSidebarOpen(),
  searchQuery: '',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
  },
});

export const { toggleSidebar, setSearchQuery } = uiSlice.actions;
export default uiSlice.reducer;
