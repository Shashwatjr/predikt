import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PrimaryButton from './PrimaryButton';
import { useTheme } from '../context/ThemeContext';
import api, { getApiErrorMessage } from '../services/api';
import { appAlert } from '../utils/appAlert';
import { formatDeleteAvailability } from '../utils/deleteAvailability';

export type RoomDeletable = {
  canDelete: boolean;
  availableAt: string | null;
  reason: string | null;
};

type Props = {
  roomId: string;
  /** The `deletable` object from GET /rooms/:roomId (creator-only server rule). */
  deletable?: RoomDeletable | null;
  /** Called after a successful delete (e.g. navigate Home). */
  onDeleted: () => void;
  compact?: boolean;
};

/**
 * Creator-only "Delete room" affordance. The button is enabled strictly per the
 * server's `deletable.canDelete`; when blocked it stays disabled and surfaces
 * the server `reason` plus a device-timezone availability line so the two never
 * drift from the DELETE /rooms/:id enforcement. Render this only for creators.
 */
export default function DeleteRoomButton({ roomId, deletable, onDeleted, compact = false }: Props) {
  const { colors } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = deletable?.canDelete === true;
  const reason = !canDelete ? deletable?.reason ?? null : null;
  const availability = !canDelete ? formatDeleteAvailability(deletable?.availableAt) : null;

  function confirmDelete() {
    if (isDeleting || !canDelete) return;
    appAlert('Delete this room?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete room',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            await api.delete(`/rooms/${roomId}`);
            onDeleted();
          } catch (error) {
            appAlert(
              'Delete unavailable',
              getApiErrorMessage(error, 'We could not delete this room right now.'),
            );
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.wrap}>
      <PrimaryButton
        label={isDeleting ? 'Deleting room…' : 'Delete room'}
        onPress={confirmDelete}
        variant="secondary"
        icon="🗑️"
        disabled={isDeleting || !canDelete}
        fullWidth={!compact}
      />
      {reason ? (
        <Text style={[styles.helper, compact && styles.helperCompact, { color: colors.textSecondary }]}>{reason}</Text>
      ) : null}
      {availability ? (
        <Text style={[styles.helper, compact && styles.helperCompact, { color: colors.textSecondary }]}>{availability}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  helper: { fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },
  helperCompact: { textAlign: 'left', paddingHorizontal: 0 },
});
