import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

const initialState: PlayerState = {
  currentTime: 0,
  duration: 0,
  isPlaying: false,
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setPlayerState: (state, action: PayloadAction<Partial<PlayerState>>) => {
      if (action.payload.currentTime !== undefined) {
        state.currentTime = action.payload.currentTime;
      }
      if (action.payload.duration !== undefined) {
        state.duration = action.payload.duration;
      }
      if (action.payload.isPlaying !== undefined) {
        state.isPlaying = action.payload.isPlaying;
      }
    },
  },
});

export const { setPlayerState } = playerSlice.actions;
export default playerSlice.reducer;
