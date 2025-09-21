import React from 'react';
import { TouchableOpacity, Text, ViewStyle, TextStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onPress: () => void;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  iconColor?: string;
  active?: boolean;
};

export default function ExportButton({ onPress, style, labelStyle, iconColor = '#9ca3af', active = false }: Props) {
  return (
    <TouchableOpacity
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          width: 80,
          height: 72,
          borderRadius: 12,
          backgroundColor: '#ffffff',
          gap: 8,
          borderWidth: 1,
          borderColor: active ? '#6366f1' : '#e5e7eb',
        },
        style,
      ]}
      onPress={onPress}
    >
      {/* Use a safe Ionicons name */}
      <Ionicons name="save-outline" size={24} color={active ? '#6366f1' : iconColor} />
      <Text style={[{ fontSize: 12, color: active ? '#6366f1' : '#6b7280', fontWeight: '500' }, labelStyle]}>Export</Text>
    </TouchableOpacity>
  );
}
