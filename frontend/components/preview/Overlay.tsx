import React, { useContext, useMemo, useRef, useState } from "react"
import { View, Text, Image, StyleSheet, TextInput } from "react-native";
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
  TapGestureHandler,
} from "react-native-gesture-handler";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  Overlay as OverlayType,
  editOverlay,
  setActiveOverlay,
} from "@/redux/overlaySlice";
import { VideoView, useVideoPlayer } from "expo-video";

export type OverlayProps = {
  data: OverlayType;
  previewSize: { width: number; height: number };
};

function VideoOverlayContent({ uri, isPlaying, currentTime, startTime }: { uri: string, isPlaying: boolean, currentTime: number, startTime: number }) {
  const player = useVideoPlayer({ uri }, (player) => {
    player.pause();
  });

  React.useEffect(() => {
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying]);

  React.useEffect(() => {
    player.currentTime = currentTime - startTime;
  }, [currentTime, startTime]);

  return <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls={false} />;
}

export default function Overlay({ data, previewSize }: OverlayProps) {
  const dispatch = useAppDispatch();
  const { activeOverlayId } = useAppSelector((s) => s.overlay);
  const { currentTime, isPlaying } = useAppSelector((s) => s.player);

  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [dw, setDw] = useState(0);
  const [dh, setDh] = useState(0);

  const startPos = useRef({ x: (data.position.x / 100) * previewSize.width, y: (data.position.y / 100) * previewSize.height });
  const startSize = useRef({ w: (data.size.width / 100) * previewSize.width, h: (data.size.height / 100) * previewSize.height });

  const isActive = activeOverlayId === data.id;

  // ----- TAP HANDLER -----
  const onSingleTap = (event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      dispatch(setActiveOverlay(data.id));
    }
  };

  // ----- DRAG HANDLERS -----
  const onDrag = (e: PanGestureHandlerGestureEvent) => {
    const { translationX, translationY } = e.nativeEvent;
    setDx(translationX);
    setDy(translationY);
  };

  const onDragEnd = (e: PanGestureHandlerGestureEvent) => {
    if (e.nativeEvent.state === 5 /* END */ || e.nativeEvent.state === 3 /* CANCELLED */) {
      const wNow = (data.size.width / 100) * previewSize.width + dw;
      const hNow = (data.size.height / 100) * previewSize.height + dh;
      const maxX = Math.max(0, previewSize.width - wNow);
      const maxY = Math.max(0, previewSize.height - hNow);
      const nx = Math.min(Math.max(0, startPos.current.x + dx), maxX);
      const ny = Math.min(Math.max(0, startPos.current.y + dy), maxY);
      
      const newPos = {
        x: (nx / previewSize.width) * 100,
        y: (ny / previewSize.height) * 100,
      };

      dispatch(editOverlay({ id: data.id, changes: { position: newPos } }));
      startPos.current = { x: nx, y: ny };
      setDx(0);
      setDy(0);
    } else if (e.nativeEvent.state === 2 /* ACTIVE */) {
      dispatch(setActiveOverlay(data.id));
    }
  };

  // ----- RESIZE HANDLERS -----
  const onResize = (e: PanGestureHandlerGestureEvent) => {
    const { translationX, translationY } = e.nativeEvent;
    setDw(translationX);
    setDh(translationY);
  };

  const onResizeEnd = (e: PanGestureHandlerGestureEvent) => {
    if (e.nativeEvent.state === 5 /* END */ || e.nativeEvent.state === 3 /* CANCELLED */) {
      const left = (data.position.x / 100) * previewSize.width;
      const top = (data.position.y / 100) * previewSize.height;
      const maxW = Math.max(50, previewSize.width - left);
      const maxH = Math.max(50, previewSize.height - top);
      const nw = Math.min(maxW, Math.max(50, startSize.current.w + dw));
      const nh = Math.min(maxH, Math.max(50, startSize.current.h + dh));

      const newSize = {
        width: (nw / previewSize.width) * 100,
        height: (nh / previewSize.height) * 100,
      };

      dispatch(editOverlay({ id: data.id, changes: { size: newSize } }));
      startSize.current = { w: nw, h: nh };
      setDw(0);
      setDh(0);
    } else if (e.nativeEvent.state === 2 /* ACTIVE */) {
      dispatch(setActiveOverlay(data.id));
    }
  };

  // ----- STYLES -----
  const wrapperStyle = useMemo(
    () => [
      {
        position: "absolute" as const,
        width: (data.size.width / 100) * previewSize.width + dw,
        height: (data.size.height / 100) * previewSize.height + dh,
        left: (data.position.x / 100) * previewSize.width + dx,
        top: (data.position.y / 100) * previewSize.height + dy,
        borderWidth: isActive ? 2 : 0,
        borderColor: "#6366f1",
      },
    ],
    [previewSize.width, previewSize.height, data.position.x, data.position.y, data.size.width, data.size.height, dx, dy, dw, dh, isActive]
  );

  const content = useMemo(() => {
    switch (data.type) {
      case "text":
        {
          const fontSize = ((data.size.height / 100) * (previewSize.height || 0)) * 0.6;
          const common = { fontSize, lineHeight: fontSize * 1.2 } as const;
          return (
            <View style={[styles.fill, styles.center, styles.textBox]}>
              {isActive ? (
                <TextInput
                  style={[styles.textInput, common]}
                  value={data.content}
                  onChangeText={(t) => dispatch(editOverlay({ id: data.id, changes: { content: t } }))}
                  placeholder="Enter text"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  multiline
                  autoFocus
                  allowFontScaling={false}
                />
              ) : (
                <Text style={[styles.text, common]} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>
                  {data.content || ""}
                </Text>
              )}
            </View>
          );
        }
      case "image":
        return <Image source={{ uri: data.content }} style={styles.fill} resizeMode="contain" />;
      case "video":
        return <VideoOverlayContent uri={data.content} isPlaying={isPlaying} currentTime={currentTime} startTime={data.timing.start} />;
      case "sticker":
        return (
          <View style={[styles.fill, styles.center, styles.sticker]}>
            <Text style={styles.stickerText}>🩵</Text>
          </View>
        );
      default:
        return null;
    }
  }, [data.type, data.content, isPlaying, currentTime, data.timing.start, isActive, dispatch, data.id]);

  const isVisible = currentTime >= data.timing.start && currentTime <= data.timing.end;

  if (!isVisible) {
    return null;
  }

  return (
    <TapGestureHandler onHandlerStateChange={onSingleTap}>
      <PanGestureHandler onGestureEvent={onDrag} onHandlerStateChange={onDragEnd}>
        <View style={wrapperStyle} pointerEvents="box-none">
          {content}
          {isActive && (
            <PanGestureHandler onGestureEvent={onResize} onHandlerStateChange={onResizeEnd}>
              <View style={styles.resizeHandle} />
            </PanGestureHandler>
          )}
        </View>
      </PanGestureHandler>
    </TapGestureHandler>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  textBox: { backgroundColor: "transparent", borderRadius: 8 },
  text: { color: "#fff", fontWeight: "600" },
  textInput: {
    color: "#fff",
    fontWeight: "600",
    backgroundColor: "transparent",
    textAlign: "center",
    width: "100%",
    height: "100%",
  },
  sticker: { backgroundColor: "transparent" },
  stickerText: { fontSize: 28 },
  resizeHandle: {
    position: "absolute",
    bottom: -8,
    right: -8,
    width: 16,
    height: 16,
    backgroundColor: "#6366f1",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
  },
});
