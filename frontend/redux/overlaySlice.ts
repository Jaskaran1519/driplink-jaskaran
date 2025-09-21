import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type OverlayType = "text" | "image" | "sticker" | "video";

export type Overlay = {
  id: string;
  type: OverlayType;
  content: string; // text content or image URL
  position: { x: number; y: number };
  size: { width: number; height: number };
  timing: { start: number; end: number };
};

export type OverlayState = {
  overlays: Overlay[];
  activeOverlayId: string | null;
};

const initialState: OverlayState = {
  overlays: [],
  activeOverlayId: null,
};

const overlaySlice = createSlice({
  name: "overlay",
  initialState,
  reducers: {
    addOverlay: (state, action: PayloadAction<Overlay>) => {
      state.overlays.push(action.payload);
    },
    deleteOverlay: (state, action: PayloadAction<string>) => {
      state.overlays = state.overlays.filter((o) => o.id !== action.payload);
      if (state.activeOverlayId === action.payload) {
        state.activeOverlayId = null;
      }
    },
    setActiveOverlay: (state, action: PayloadAction<string | null>) => {
      state.activeOverlayId = action.payload;
    },
    editOverlay: (
      state,
      action: PayloadAction<{ id: string; changes: Partial<Overlay> }>
    ) => {
      const overlay = state.overlays.find((o) => o.id === action.payload.id);
      if (overlay) {
        Object.assign(overlay, action.payload.changes);
      }
    },
  },
});

export const { addOverlay, deleteOverlay, setActiveOverlay, editOverlay } = overlaySlice.actions;
export default overlaySlice.reducer;
