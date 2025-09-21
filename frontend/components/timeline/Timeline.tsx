import React from 'react';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { View, Text, LayoutChangeEvent, Image, ScrollView } from 'react-native';
import { Overlay } from '@/redux/overlaySlice';
import OverlayTimeline from './OverlayTimeline';
import { styles } from '@/styles/timeline';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useAppSelector } from '@/redux/hooks';
import { RootState } from '@/redux/store';

type TimelineProps = {
  overlays: Overlay[];
  baseUri?: string;
  seek: (seconds: number) => void;
};

export default function Timeline({ overlays, baseUri, seek }: TimelineProps) {
  const { currentTime, duration } = useAppSelector((s: RootState) => s.player);
  const [width, setWidth] = React.useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Decide duration to render. Fallback to 30s if unknown.
  const durationUsed = React.useMemo(() => (duration && duration > 0 ? duration : 30), [duration]);

  // Compute px/second so that total base length stays within ~3x viewport width
  const SCALE = React.useMemo(() => {
    if (!width || durationUsed <= 0) return 60; // default before layout
    const maxScaleToCap = (3 * width) / durationUsed; // px/s so that dur*scale <= 3*width
    return Math.min(60, Math.max(10, maxScaleToCap));
  }, [width, durationUsed]);

  // ScrollView content width (px)
  const totalPx = Math.max(width, durationUsed * SCALE);
  const spacer = width/2;
  const contentTotalWidth = spacer + totalPx + spacer;

  const scrollRef = React.useRef<ScrollView | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const lastSyncRef = React.useRef(0);
  const isMomentumScrolling = React.useRef(false);

  // Scroll to origin once layout is known so 0s aligns with the centered playhead
  React.useEffect(() => {
    if (!width) return;
    // Center the origin (t=0) under the playhead: scrollX = spacer - width/2
    const x = Math.max(0, spacer - width / 2);
    scrollRef.current?.scrollTo({ x, animated: false });
  }, [width, spacer]);

  // Throttled auto-scroll to keep playhead centered on current time when not dragging
  React.useEffect(() => {
    if (!width || isDragging || isMomentumScrolling.current) return;

    // Auto-scroll to keep the current time centered
    const desiredX = spacer + (currentTime * SCALE) - (width / 2);
    scrollRef.current?.scrollTo({ x: desiredX, animated: false });

  }, [currentTime, width, isDragging, SCALE, spacer]);

  // generate thumbnails for base video
  const [thumbs, setThumbs] = React.useState<string[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!baseUri) { setThumbs([]); return; }
      const thumbWidth = 48;
      const totalPx = durationUsed * SCALE;
      const count = Math.max(1, Math.ceil(totalPx / thumbWidth));
      const interval = durationUsed / count;
      const next: string[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const t = i * interval;
          const { uri } = await VideoThumbnails.getThumbnailAsync(baseUri, { time: Math.max(0, t * 1000) });
          if (cancelled) return;
          next.push(uri);
        } catch (e) {
          console.error("Error generating base video thumbnail:", e);
        }
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => { cancelled = true; };
  }, [baseUri, durationUsed, SCALE]);

  const contentHeight = 64 + Math.max(0, overlays.length) * 36; // 64 for taller base row
  const lastSeekRef = React.useRef(0);

  const scrollX = React.useRef(0);
  const onGestureEvent = (event:any) => {
      if (event.nativeEvent.state === State.ACTIVE) {
          scrollRef.current?.scrollTo({ x: scrollX.current - event.nativeEvent.translationX, animated: false });
      }
  };
  const onHandlerStateChange = (event:any) => {
      if (event.nativeEvent.oldState === State.ACTIVE) {
          scrollX.current = scrollX.current - event.nativeEvent.translationX;
      }
      if (event.nativeEvent.state === State.BEGAN) {
          setIsDragging(true);
          isMomentumScrolling.current = false;
      }
      if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.FAILED || event.nativeEvent.state === State.CANCELLED) {
          setIsDragging(false);
      }
  };

  return (
    <View style={styles.timelineContainer} onLayout={onLayout}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <ScrollView
          horizontal
          ref={scrollRef}
          scrollEnabled={false}
          onScroll={(e) => {
            if (!isDragging) {
              scrollX.current = e.nativeEvent.contentOffset.x;
            }
            if (isDragging || isMomentumScrolling.current) {
              const x = e.nativeEvent.contentOffset.x;
              const time = Math.max(0, (x + width / 2 - spacer) / SCALE);
              const now = Date.now();
              if (now - lastSeekRef.current > 80) {
                lastSeekRef.current = now;
                seek(time);
              }
            }
          }}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={{ width: contentTotalWidth, height: contentHeight }}
        >
          <View style={{ width: contentTotalWidth }}>
            <View style={[styles.track, { position: 'absolute', left: spacer, top: 0, width: totalPx, height: contentHeight, overflow: 'hidden' }]}>
              {baseUri ? (
                <View style={{ position: 'absolute', left: 0, top: 8 + overlays.length * 36, height: 48, flexDirection: 'row' }}>
                  {thumbs.length > 0 ? (
                    thumbs.map((uri, i) => (
                      <Image key={i} source={{ uri }} style={{ width: 64, height: 48, marginRight: 2, borderRadius: 4 }} />
                    ))
                  ) : (
                    <View style={{ width: durationUsed * SCALE, height: 48, backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: 6, borderWidth: 2, borderColor: '#8b5cf6' }} />
                  )}
                </View>
              ) : null}

              {overlays.map((overlay, index) => (
                <OverlayTimeline
                  key={overlay.id}
                  overlay={overlay}
                  scale={SCALE}
                  rowIndex={overlays.length - 1 - index}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </PanGestureHandler>

      {/* Playhead indicator (on top, centered relative to container) */}
      <View style={styles.indicator} />

      {/* Audio row */}
      {/* <View style={styles.audioRow}>
        <Ionicons name="musical-notes-outline" size={16} color="#6b7280" />
        <Text style={styles.audioText}>Add Audio</Text>
      </View> */}
    </View>
  );
}
