import { configureStore } from "@reduxjs/toolkit";
import overlayReducer from './overlaySlice';
import playerReducer from './playerSlice';

export const store = configureStore({
  reducer: {
    overlay: overlayReducer,
    player: playerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
