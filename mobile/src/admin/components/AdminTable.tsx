import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, typography } from '../../theme/designSystem';

type Column<T> = {
  key: string;
  label: string;
  width?: number;
  render: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  emptyLabel?: string;
  onRowPress?: (row: T) => void;
};

export default function AdminTable<T extends { [key: string]: unknown }>({
  columns,
  rows,
  emptyLabel = 'No records found',
  onRowPress,
}: Props<T>) {
  if (!rows.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal>
      <View>
        <View style={styles.headerRow}>
          {columns.map((column) => (
            <Text key={column.key} style={[styles.headerCell, { width: column.width ?? 140 }]}>
              {column.label}
            </Text>
          ))}
        </View>
        {rows.map((row, index) => (
          <Pressable
            key={String(row.id ?? row.roomId ?? row.userId ?? row.feedbackId ?? row.reportId ?? index)}
            onPress={() => onRowPress?.(row)}
            style={styles.dataRow}
          >
            {columns.map((column) => (
              <View key={column.key} style={[styles.dataCell, { width: column.width ?? 140 }]}>
                {column.render(row)}
              </View>
            ))}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  headerCell: {
    ...typography.caption,
    color: palette.textMuted,
    padding: spacing.sm,
    fontWeight: '700',
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  dataCell: {
    padding: spacing.sm,
    justifyContent: 'center',
  },
  empty: {
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyText: {
    ...typography.body,
    color: palette.textMuted,
  },
});
