import React from 'react'
import { View, TouchableOpacity, Pressable, Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/timeline';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { deleteOverlay, setActiveOverlay, Overlay, editOverlay } from '@/redux/overlaySlice';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { RootState } from '@/redux/store';

type OverlayTimelineProps = {
  overlay: Overlay;
  scale?: number; // pixels per second
  rowIndex?: number; // 0-based row index
};

export default function OverlayTimeline({ overlay, scale = 60, rowIndex = 0 }: OverlayTimelineProps) {
  const x = useSharedValue((overlay.timing.start ?? 0) * scale);
  const width = useSharedValue(((overlay.timing.end ?? 0) - (overlay.timing.start ?? 0)) * scale);
  const startX = useSharedValue(0);
  const startWidth = useSharedValue(0);

  const dispatch = useAppDispatch();
  const activeOverlayId = useAppSelector((state) => state.overlay.activeOverlayId);
  const { duration } = useAppSelector((s: RootState) => s.player);
  const isActive = activeOverlayId === overlay.id;

  // Thumbnail generation for videos
  const [thumbs, setThumbs] = React.useState<string[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (overlay.type !== 'video' || width.value <= 0) {
        setThumbs([]);
        return;
      }
      const duration = width.value / scale;
      const numThumbs = Math.max(1, Math.floor(width.value / 48)); // one thumb every 48px, at least 1
      const interval = duration / numThumbs;
      const next: string[] = [];
      for (let i = 0; i < numThumbs; i++) {
        try {
          const timeMs = i * interval * 1000;
          const { uri } = await VideoThumbnails.getThumbnailAsync(overlay.content, { time: timeMs });
          if (cancelled) return;
          next.push(uri);
        } catch (e) {
          console.error('Error generating overlay thumbnail:', e);
        }
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => { cancelled = true; };
  }, [overlay.content, overlay.type, width.value, scale]);

  // State for width to cause re-render for image sequence
  const [componentWidth, setComponentWidth] = React.useState(width.value);
  useAnimatedReaction(
    () => width.value,
    (currentWidth) => {
      runOnJS(setComponentWidth)(currentWidth);
    },
    [width]
  );

  const updateTiming = () => {
    const newStart = x.value / scale;
    const newEnd = (x.value + width.value) / scale;
    dispatch(editOverlay({ id: overlay.id, changes: { timing: { start: newStart, end: newEnd } } }));
  };

  // Drag gesture for the whole overlay
  const dragGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = x.value;
    })
    .onUpdate((event) => {
      const newX = startX.value + event.translationX;
      const newEnd = (newX + width.value) / scale;
      if (newX >= 0 && newEnd <= duration) {
        x.value = newX;
      }
    })
    .onEnd(() => {
      runOnJS(updateTiming)();
    });

  // Left handle resize
  const leftHandleGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = x.value;
      startWidth.value = width.value;
    })
    .onUpdate((event) => {
      const newWidth = startWidth.value - event.translationX;
      const newX = startX.value + event.translationX;
      if (newWidth > 20 && newX >= 0) { // prevent negative width and negative start
        width.value = newWidth;
        x.value = newX;
      }
    })
    .onEnd(() => {
      runOnJS(updateTiming)();
    });

  // Right handle resize
  const rightHandleGesture = Gesture.Pan()
    .onStart(() => {
      startWidth.value = width.value;
    })
    .onUpdate((event) => {
      const newWidth = startWidth.value + event.translationX;
      const newEnd = (x.value + newWidth) / scale;
      if (newWidth > 20 && newEnd <= duration) { // prevent negative width and exceeding duration
        width.value = newWidth;
      }
    })
    .onEnd(() => {
      runOnJS(updateTiming)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: width.value,
  }));

  function handleDelete() {
    dispatch(deleteOverlay(overlay.id));
  }

  function handlePress() {
    dispatch(setActiveOverlay(overlay.id));
  }

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View style={[styles.overlayTimeline, { top: 8 + rowIndex * 36 }, animatedStyle]}>
        <Pressable onPress={handlePress} style={{ flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
          {/* Render thumbnails for video overlays */}
          {overlay.type === 'video' && thumbs.length > 0 ? (
            thumbs.map((uri, i) => (
              <Image key={i} source={{ uri }} style={{ width: 48, height: 32 }} />
            ))
          ) : overlay.type === 'image' ? (
            Array.from({ length: Math.max(1, Math.floor(componentWidth / 48)) }).map((_, i) => (
                <Image key={i} source={{ uri: overlay.content }} style={{ width: 48, height: 32 }} />
            ))
          ) : (
            // Fallback for videos when thumbs are not ready
            <View style={{ flex: 1 }} />
          )}

          {isActive && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Left handle */}
          <GestureDetector gesture={leftHandleGesture}>
            <Animated.View style={styles.handleLeft} />
          </GestureDetector>

          {/* Right handle */}
          <GestureDetector gesture={rightHandleGesture}>
            <Animated.View style={styles.handleRight} />
          </GestureDetector>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}
