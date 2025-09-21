import React from "react"
import { useLocalSearchParams, router } from "expo-router"
import { Text, View, TouchableOpacity, ScrollView, Alert, Pressable, Modal, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { styles } from '../styles/editstyle'
import PreviewWrapper from "@/components/preview/PreviewWrapper"
import Overlay from "@/components/preview/Overlay"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"
import { RootState } from "@/redux/store"
import * as ImagePicker from "expo-image-picker"
import { addOverlay, deleteOverlay, Overlay as Overlaytype, setActiveOverlay } from "@/redux/overlaySlice"
import { setPlayerState } from "@/redux/playerSlice";
import Timeline from "@/components/timeline/Timeline";
import { useVideoPlayer } from "expo-video";
import ExportButton from "@/components/export/ExportButton";

export default function EditScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>()
  const decodedUri = typeof uri === 'string' ? decodeURIComponent(uri) : ''
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const overlays = useAppSelector((s: RootState) => s.overlay.overlays)
  const activeOverlayId = useAppSelector((s: RootState) => s.overlay.activeOverlayId)
  const dispatch = useAppDispatch()
  const activeOverlay = overlays.find((o) => o.id === activeOverlayId);

  // --- Video Player State Management ---
  const player = useVideoPlayer(decodedUri ? { uri: decodedUri } : null, (p) => {
    p.loop = false;
  });
  const playerState = useAppSelector((s: RootState) => s.player);

  React.useEffect(() => {
    let id: any;
    const tick = () => {
      try {
        const currentTime = player?.currentTime ?? 0;
        const duration = Math.ceil(player?.duration ?? 0);
        const isPlaying = player?.playing ?? false;
        dispatch(setPlayerState({ currentTime, duration, isPlaying }));
      } catch { }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [player, dispatch]);

  React.useEffect(() => {
    if (playerState.isPlaying) {
      dispatch(setActiveOverlay(null));
    }
  }, [playerState.isPlaying, dispatch]);

  const play = () => player?.play();
  const pause = () => player?.pause();
  const toggle = () => (playerState.isPlaying ? pause() : play());
  const seek = (seconds: number) => {
    if (player) {
      player.currentTime = seconds;
      dispatch(setPlayerState({ currentTime: seconds }));
    }
  };

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  const BACKEND_URL = "https://1e85f969eb9d.ngrok-free.app"; // adjust if needed

  async function handleExport() {
    try {
      if (!decodedUri) {
        Alert.alert("No video", "Base video not found")
        return;
      }
      setExporting(true);
      setExportProgress(0.02);
      setExportMessage("Preparing upload...");

      // Build metadata and collect assets
      const metaOverlays = overlays.map((ov) => {
        if (ov.type === 'image' || ov.type === 'video') {
          // Map content to a filename we will upload
          const name = ov.content.split('/').pop() || `${ov.id}.${ov.type === 'image' ? 'png' : 'mp4'}`;
          return { ...ov, content: name };
        }
        return ov;
      });

      const metadata = { overlays: metaOverlays };

      const form = new FormData();
      form.append('metadata', JSON.stringify(metadata) as any);
      // Base video
      form.append('video', {
        // @ts-ignore - React Native FormData file
        uri: decodedUri,
        name: 'input.mp4',
        type: 'video/mp4',
      });

      // Assets
      for (const ov of overlays) {
        if (ov.type === 'image' || ov.type === 'video') {
          const name = ov.content.split('/').pop() || `${ov.id}.${ov.type === 'image' ? 'png' : 'mp4'}`;
          form.append('assets', {
            // @ts-ignore
            uri: ov.content,
            name,
            type: ov.type === 'image' ? 'image/*' : 'video/*',
          } as any);
        }
      }

      const res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: form as any,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Upload failed: ${res.status} ${t}`);
      }
      const data = (await res.json()) as unknown as { job_id: string; status_url: string; result_url: string };
      const jobId = data.job_id;

      // Poll status
      setExportMessage("Rendering...");
      let done = false;
      while (!done) {
        await new Promise(r => setTimeout(r, 1000));
        const sres = await fetch(`${BACKEND_URL}${data.status_url}`);
        const sdata = (await sres.json()) as unknown as { status: string; progress?: number; message?: string };
        if (typeof sdata.progress === 'number') {
          setExportProgress(Math.max(0, Math.min(1, sdata.progress)));
        }
        if (sdata.message) setExportMessage(sdata.message);
        if (sdata.status === 'completed') {
          done = true;
          break;
        }
        if (sdata.status === 'error') {
          throw new Error(sdata.message || 'Render error');
        }
      }

      // Fetch result url
      const rres = await fetch(`${BACKEND_URL}${data.result_url}`);
      if (!rres.ok) {
        const t = await rres.text();
        throw new Error(`Result fetch failed: ${rres.status} ${t}`);
      }
      const rdata = (await rres.json()) as unknown as { job_id: string; url: string };
      const url = `${BACKEND_URL}${rdata.url}`;
      setExporting(false);
      router.push({ pathname: '/finalvideo', params: { url: encodeURIComponent(url) } });
    } catch (e: any) {
      console.error(e);
      setExporting(false);
      Alert.alert('Export failed', e?.message || String(e));
    }
  }

  const handlePickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      const newOverlay: Overlaytype = {
        id: Date.now().toString(),
        type: result.assets[0].type === 'video' ? 'video' : 'image',
        content: result.assets[0].uri,
        position: { 
          x: (50 / previewSize.width) * 100, 
          y: (50 / previewSize.height) * 100 
        },
        size: { 
          width: (150 / previewSize.width) * 100, 
          height: (100 / previewSize.height) * 100
        },
        timing: { start: 0, end: 5 },
      };
      dispatch(addOverlay(newOverlay));
      dispatch(setActiveOverlay(newOverlay.id));
    }
  };

  function handleClearActive() {
    dispatch(setActiveOverlay(null));
  }

  if (!uri) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>No video received</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const tools = [
    { id: "upload", icon: "cloud-upload-outline", label: "Upload" },
    { id: "delete", icon: "trash-outline", label: "Delete" },
    { id: "text", icon: "text-outline", label: "Text" },
    { id: "export", icon: "cloud-done-outline", label: "Export" },
  ]

  function formatTime(sec: number) {
    const s = Math.max(0, Math.ceil(sec || 0))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  return (
    <Pressable style={styles.container} onPress={handleClearActive}>

      {/* Top section with video preview */}
      <View style={styles.videoSection}>
        <View style={styles.videoWrapper} onLayout={(e) => setPreviewSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
          <PreviewWrapper player={player} height={240}>
            {overlays.map((o) => (
              <Overlay key={o.id} data={o} previewSize={previewSize} />
            ))}
          </PreviewWrapper>
        </View>
      </View>

      {/* Bottom section with controls, timeline and fixed toolbar */}
      <View style={styles.bottomSection}>
        {/* Active Overlay Debugger */}
        {activeOverlay && (
          <View style={styles.debugPanel}>
            <Text style={styles.debugText} selectable>
              Timing: {activeOverlay.position.x}% - {activeOverlay.position.y}%
            </Text>
          </View>
        )}

        {/* Controls row */}
        <View style={styles.controlsRow}>
          <Text style={styles.controlTime}>{formatTime(playerState.currentTime)}</Text>
          <TouchableOpacity style={styles.playButtonCircle} onPress={() => seek(0)}>
            <Ionicons name="play-skip-back" size={20} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButtonCircle} onPress={toggle}>
            <Ionicons name={playerState.isPlaying ? "pause" : "play"} size={20} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButtonCircle} onPress={() => seek(playerState.duration)}>
            <Ionicons name="play-skip-forward" size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.controlTime}>{formatTime(playerState.duration)}</Text>
        </View>

        {/* Timeline */}
        <Timeline
          overlays={overlays}
          baseUri={decodedUri}
          seek={seek}
        />

        {/* Tools section - fixed toolbar at bottom */}
        <View style={styles.toolbarFixed}>
          <View style={styles.toolsContainer}>
              {tools.map((tool) => (
                tool.id === 'export' ? (
                  <ExportButton
                    key={tool.id}
                    active={selectedTool === tool.id}
                    onPress={() => {
                      handleExport();
                      setSelectedTool(tool.id);
                    }}
                  />
                ) : (
                  <TouchableOpacity
                    key={tool.id}
                    style={[styles.toolButton, selectedTool === tool.id && styles.toolButtonActive]}
                    onPress={() => {
                      if (tool.id === "upload") {
                        handlePickMedia()
                      } else if (tool.id === "text") {
                        const newOverlay: Overlaytype = {
                          id: Date.now().toString(),
                          type: 'text',
                          content: '',
                          position: { 
                            x: (50 / previewSize.width) * 100, 
                            y: (50 / previewSize.height) * 100 
                          },
                          size: { 
                            width: (200 / previewSize.width) * 100, 
                            height: (80 / previewSize.height) * 100 
                          },
                          timing: { start: 0, end: 5 },
                        };
                        dispatch(addOverlay(newOverlay));
                        dispatch(setActiveOverlay(newOverlay.id));
                        setSelectedTool(tool.id);
                      }
                      else if(tool.id==='delete'){
                        activeOverlay && dispatch(deleteOverlay(activeOverlay.id));
                        setSelectedTool(null);
                      } else {
                        setSelectedTool(selectedTool === tool.id ? null : tool.id)
                      }
                    }}
                  >
                    <Ionicons name={tool.icon as any} size={24} color={selectedTool === tool.id ? "#6366f1" : "#9ca3af"} />
                    <Text style={[styles.toolLabel, selectedTool === tool.id && styles.toolLabelActive]}>{tool.label}</Text>
                  </TouchableOpacity>
                )
              ))}
            </View>
        </View>
        {/* Export progress modal */}
        <Modal visible={exporting} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, width: 260, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={{ marginTop: 12, fontWeight: '600' }}>Exporting...</Text>
              <Text style={{ marginTop: 6, color: '#6b7280', textAlign: 'center' }}>{exportMessage || ''}</Text>
              <View style={{ marginTop: 12, height: 8, width: '100%', backgroundColor: '#e5e7eb', borderRadius: 4 }}>
                <View style={{ height: 8, width: `${Math.floor(exportProgress*100)}%`, backgroundColor: '#6366f1', borderRadius: 4 }} />
              </View>
              <Text style={{ marginTop: 8, color: '#6b7280' }}>{Math.floor(exportProgress*100)}%</Text>
            </View>
          </View>
        </Modal>
      </View>
    </Pressable>
  );
}
