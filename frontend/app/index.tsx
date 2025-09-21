"use client"

import { useCallback, useMemo, useState } from "react"
import { Alert,View, Text, TouchableOpacity, Dimensions } from "react-native"
import * as ImagePicker from "expo-image-picker"
import * as FileSystem from "expo-file-system"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { styles } from "../styles/homestyles"
import { useVideoPlayer, VideoView } from "expo-video"

const { width: screenWidth } = Dimensions.get("window")

export default function HomeScreen() {
  const [pickedUri, setPickedUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const requestPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission required", "We need media library permission to pick a video.")
      return false
    }
    return true
  }, [])

  const onPickVideo = useCallback(async () => {
    const ok = await requestPermission()
    if (!ok) return

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 1,
    })

    if (!result.canceled && result.assets?.length) {
      setPickedUri(result.assets[0].uri)
    }
  }, [requestPermission])

  const onEdit = useCallback(async () => {
    if (!pickedUri) return
    try {
      setSaving(true)
      // The URI from ImagePicker is often directly usable.
      // We can simplify by passing it directly without copying first.
      const encoded = encodeURIComponent(pickedUri)
      console.log("Navigating to /edit with uri=", pickedUri)
      router.push(`/edit?uri=${encoded}`)
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to navigate to the editor.")
    } finally {
      setSaving(false)
    }
  }, [pickedUri])

  const player = useVideoPlayer(pickedUri ? { uri: pickedUri } : null, (p) => {
    p.loop = false
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Video Editor</Text>
        <Text style={styles.headerSubtitle}>Create amazing videos</Text>
      </View>

      {!pickedUri ? (
        <View style={styles.emptyState}>
          <View style={styles.uploadArea}>
            <View style={styles.uploadIcon}>
              <Ionicons name="videocam-outline" size={64} color="#6366f1" />
            </View>
            <Text style={styles.uploadTitle}>Import Your Video</Text>
            <Text style={styles.uploadSubtitle}>Select a video from your library to start editing</Text>
            <TouchableOpacity style={styles.selectButton} onPress={onPickVideo}>
              <Ionicons name="folder-open-outline" size={20} color="#fff" />
              <Text style={styles.selectButtonText}>Browse Videos</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <View style={styles.videoContainer}>
            <VideoView
              player={player}
              style={{
                width: "100%",
                height: 220,
                backgroundColor: "#000",
                borderRadius: 8,
                overflow: "hidden",
              }}
              contentFit="contain"
            />
            <View style={styles.videoOverlay}>
              <View style={styles.videoInfo}>
                <Ionicons name="play-circle" size={16} color="#fff" />
                <Text style={styles.videoInfoText}>Ready to edit</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionPanel}>
            <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={onEdit} disabled={saving}>
              <Ionicons name="cut-outline" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>{saving ? "Processing..." : "Start Editing"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => setPickedUri(null)}
              disabled={saving}
            >
              <Ionicons name="refresh-outline" size={20} color="#6b7280" />
              <Text style={styles.secondaryButtonText}>Choose Different</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}
