import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

export default function FinalVideoScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const decoded = typeof url === 'string' ? decodeURIComponent(url) : '';
  const [loading, setLoading] = React.useState(false);

  const player = useVideoPlayer(decoded ? { uri: decoded } : null, (p) => {
    p.loop = false;
    p.play();
  });

  const handleOpenVideo = async () => {
    if (!decoded) {
      Alert.alert('No video', 'There is no video URL available.');
      return;
    }

    try {
      setLoading(true);
      
      // Simply open the URL - works on all platforms
      const supported = await Linking.canOpenURL(decoded);
      
      if (supported) {
        await Linking.openURL(decoded);
        Alert.alert(
          'Video Opened', 
          Platform.OS === 'web' 
            ? 'The video has been opened in a new tab. You can save it from there.'
            : 'The video has been opened in your browser. You can save it from there.'
        );
      } else {
        Alert.alert('Error', 'Cannot open this video URL');
      }
      
    } catch (error: any) {
      console.error('Open video error:', error);
      Alert.alert('Error', 'Could not open video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!decoded) return;
    
    // Show the URL to user so they can copy it manually
    Alert.alert(
      'Video URL', 
      decoded,
      [
        {
          text: 'Open Link',
          onPress: handleOpenVideo
        },
        {
          text: 'OK',
          style: 'cancel'
        }
      ]
    );
  };

  const handleGoHome = () => {
    // Navigate back to the main screen
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      {/* Header */}
      <View style={{ 
        paddingTop: 50, 
        paddingHorizontal: 16, 
        paddingBottom: 12, 
        backgroundColor: '#111827', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          Your Video is Ready!
        </Text>
        <TouchableOpacity onPress={handleGoHome}>
          <Ionicons name="home-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Video Container */}
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ 
          backgroundColor: '#000', 
          borderRadius: 12, 
          overflow: 'hidden', 
          aspectRatio: 9/16,
          alignItems: 'center', 
          justifyContent: 'center',
          maxHeight: 600,
          alignSelf: 'center',
          width: '100%',
          maxWidth: 400,
          marginBottom: 24
        }}>
          {decoded ? (
            <VideoView 
              player={player} 
              style={{ width: '100%', height: '100%' }} 
              contentFit="contain"
              allowsFullscreen={true}
            />
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="videocam-off" size={48} color="#6b7280" />
              <Text style={{ color: '#9ca3af', marginTop: 8 }}>No video available</Text>
            </View>
          )}
        </View>
        
        {/* Action Buttons */}
        {decoded && (
          <View style={{ gap: 16 }}>
            {/* Main Download Button */}
            <TouchableOpacity
              onPress={handleOpenVideo}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#374151' : '#10b981',
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="download-outline" size={24} color="#fff" />
              )}
              <Text style={{ 
                color: '#fff', 
                marginLeft: 8, 
                fontSize: 18, 
                fontWeight: '600' 
              }}>
                {loading ? 'Opening...' : 'Download Video'}
              </Text>
            </TouchableOpacity>

            {/* Secondary Actions */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => player.replay()}
                style={{
                  flex: 1,
                  backgroundColor: '#374151',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={{ color: '#fff', marginLeft: 6, fontSize: 14, fontWeight: '500' }}>
                  Replay
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCopyLink}
                style={{
                  flex: 1,
                  backgroundColor: '#374151',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Ionicons name="link" size={20} color="#fff" />
                <Text style={{ color: '#fff', marginLeft: 6, fontSize: 14, fontWeight: '500' }}>
                  Copy Link
                </Text>
              </TouchableOpacity>
            </View>

            {/* Info Text */}
            <View style={{ 
              backgroundColor: '#1f2937', 
              padding: 16, 
              borderRadius: 8,
              marginTop: 8
            }}>
              <Text style={{ 
                color: '#d1d5db', 
                textAlign: 'center', 
                fontSize: 14,
                lineHeight: 20
              }}>
                💡 <Text style={{ fontWeight: '600' }}>How to save:</Text>
                {'\n\n'}
                Tap "Download Video" to open it in your browser, then:
                {'\n'}
                • Right-click and "Save video as..." (Desktop)
                {'\n'}
                • Long-press and "Save to Photos" (Mobile)
              </Text>
            </View>

            {/* Create Another Button */}
            <TouchableOpacity
              onPress={handleGoHome}
              style={{
                backgroundColor: '#6366f1',
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={{ 
                color: '#fff', 
                marginLeft: 8, 
                fontSize: 16, 
                fontWeight: '600' 
              }}>
                Create Another Video
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}