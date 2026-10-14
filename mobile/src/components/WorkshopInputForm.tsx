import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Plus } from 'lucide-react-native';

interface WorkshopInputFormProps {
  onCreate: (url: string, count: number) => void;
  error?: string | null;
  loading?: boolean;
}

export const WorkshopInputForm: React.FC<WorkshopInputFormProps> = ({
  onCreate,
  error,
  loading = false,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [countInput, setCountInput] = useState('50');

  const handlePressCreate = () => {
    if (loading) return;
    const finalCount = parseInt(countInput, 10) || 50;
    onCreate(urlInput.trim(), finalCount);
  };

  return (
    <View style={styles.container}>
      {/* Form Card */}
      <View style={styles.formCard}>
        {/* URL Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>LINK YOUTUBE</Text>
          <TextInput
            style={styles.textInput}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="https://youtube.com/watch?v=..."
            placeholderTextColor="rgba(255, 255, 255, 0.25)"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        {/* Row for Klip count & Submit button */}
        <View style={styles.bottomRow}>
          <View style={styles.countGroup}>
            <Text style={styles.label}>KLIP</Text>
            <TextInput
              style={[styles.textInput, styles.countInput]}
              value={countInput}
              onChangeText={setCountInput}
              keyboardType="numeric"
              maxLength={3}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handlePressCreate}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Plus size={18} color="#ffffff" strokeWidth={3} />
                <Text style={styles.submitBtnText}>BUAT</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Alert Box */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: 'rgba(23, 23, 23, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  inputGroup: {
    width: '100%',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  countGroup: {
    width: 80,
  },
  countInput: {
    textAlign: 'center',
    fontWeight: '700',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: 'rgba(220, 38, 38, 0.6)',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  errorBox: {
    backgroundColor: 'rgba(127, 29, 29, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
});
