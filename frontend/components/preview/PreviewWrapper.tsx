import React, { PropsWithChildren } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { VideoView, VideoPlayer } from "expo-video";

export type PreviewWrapperProps = {
  player: VideoPlayer | null;
  height?: number; // preview height in px; width is 100%
  style?: ViewStyle;
};

export default function PreviewWrapper({
  player,
  height = 240,
  style,
  children,
}: PropsWithChildren<PreviewWrapperProps>) {

  return (
    <View style={[{ width: "100%", height, overflow: 'hidden' }, style]}>
      {/* Video */}
      {player ? (
        <VideoView
          player={player}
          style={StyleSheet.flatten([StyleSheet.absoluteFillObject, styles.video])}
          contentFit="contain"
          nativeControls={false}
        />
      ) : null}

      {/* Overlays (interactive) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  video: {
    backgroundColor: "#000",
  },
  
});
