import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { palette, radius, spacing } from '../theme/designSystem';

type Props = {
  /** Source of truth: the currently-picked arrival time. */
  value: Date;
  onChange: (next: Date) => void;
  showSeconds?: boolean;
  /** Show the AM/PM toggle (12-hour locales). Defaults on. */
  showAmPm?: boolean;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const ITEM_HEIGHT = 46;
const VISIBLE_ITEMS = 3; // center + one above + one below
const HOURS_12 = Array.from({ length: 12 }, (_, i) => pad(i + 1)); // 01..12
const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad(i)); // 00..23
const SIXTY = Array.from({ length: 60 }, (_, i) => pad(i)); // 00..59

/**
 * Combination-lock style [HH]:[MM]:[SS] time picker. Each field is a vertical wheel
 * you scroll up/down (mouse-wheel on web, drag on native); it snaps to the nearest
 * value and centers it. Stays anchored to the room's date — the caller pre-populates
 * `value` from a benchmark and this only changes the time-of-day.
 */
export default function TimePickerSegments({
  value,
  onChange,
  showSeconds = true,
  showAmPm = true,
}: Props) {
  const lastEmitted = useRef<number>(value.getTime());

  const to12h = (d: Date) => {
    const h24 = d.getHours();
    const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    let h = h24 % 12;
    if (h === 0) h = 12;
    return { h, ampm };
  };

  const initial = to12h(value);
  const [hour, setHour] = useState(showAmPm ? initial.h : value.getHours()); // 1..12 or 0..23
  const [minute, setMinute] = useState(value.getMinutes());
  const [second, setSecond] = useState(value.getSeconds());
  const [ampm, setAmPm] = useState<'AM' | 'PM'>(initial.ampm);

  // Re-sync from outside changes (e.g. a quick-adjust chip nudging the time).
  useEffect(() => {
    if (value.getTime() === lastEmitted.current) return;
    const t = to12h(value);
    setHour(showAmPm ? t.h : value.getHours());
    setMinute(value.getMinutes());
    setSecond(value.getSeconds());
    setAmPm(t.ampm);
    lastEmitted.current = value.getTime();
  }, [value, showAmPm]);

  const commit = (parts: { hour?: number; minute?: number; second?: number; ampm?: 'AM' | 'PM' }) => {
    const h = parts.hour ?? hour;
    const minutes = parts.minute ?? minute;
    const seconds = showSeconds ? parts.second ?? second : 0;
    const period = parts.ampm ?? ampm;
    const h24 = showAmPm ? (h % 12) + (period === 'PM' ? 12 : 0) : h % 24;
    const next = new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      h24,
      minutes,
      seconds,
    );
    lastEmitted.current = next.getTime();
    onChange(next);
  };

  const hourValues = showAmPm ? HOURS_12 : HOURS_24;
  const hourIndex = showAmPm ? hour - 1 : hour;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <WheelColumn
          values={hourValues}
          index={hourIndex}
          onSelect={(i) => {
            const h = showAmPm ? i + 1 : i;
            setHour(h);
            commit({ hour: h });
          }}
          label="HH"
        />
        <Text style={styles.colon}>:</Text>
        <WheelColumn
          values={SIXTY}
          index={minute}
          onSelect={(i) => {
            setMinute(i);
            commit({ minute: i });
          }}
          label="MM"
        />
        {showSeconds ? (
          <>
            <Text style={styles.colon}>:</Text>
            <WheelColumn
              values={SIXTY}
              index={second}
              onSelect={(i) => {
                setSecond(i);
                commit({ second: i });
              }}
              label="SS"
            />
          </>
        ) : null}
        {showAmPm ? (
          <View style={styles.ampmCol}>
            {(['AM', 'PM'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => {
                  setAmPm(p);
                  commit({ ampm: p });
                }}
                style={[styles.ampmBtn, ampm === p && styles.ampmBtnActive]}
              >
                <Text style={[styles.ampmText, ampm === p && styles.ampmTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function WheelColumn({
  values,
  index,
  onSelect,
  label,
}: {
  values: string[];
  index: number;
  onSelect: (index: number) => void;
  label: string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMount = useRef(false);
  const initialized = useRef(false);
  const indexRef = useRef(index);
  indexRef.current = index;
  const [active, setActive] = useState(index);

  // Keep the wheel parked on the current index; animate only after first paint so
  // an external nudge (quick-adjust chip) glides instead of jumping on open.
  useEffect(() => {
    setActive(index);
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: didMount.current });
    didMount.current = true;
  }, [index]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const settle = (offsetY: number) => {
    const i = clamp(Math.round(offsetY / ITEM_HEIGHT), 0, values.length - 1);
    scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
    setActive(i);
    if (i !== index) onSelect(i);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    setActive(clamp(Math.round(offsetY / ITEM_HEIGHT), 0, values.length - 1));
    // Debounced settle covers web mouse-wheel (no momentum event) and native drag alike.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(offsetY), 140);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settle(e.nativeEvent.contentOffset.y);
  };

  const pad = (VISIBLE_ITEMS - 1) / 2;

  return (
    <View style={styles.segmentCol}>
      <View style={styles.wheelWindow}>
        <View pointerEvents="none" style={styles.selectionBand} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          scrollEventThrottle={16}
          nestedScrollEnabled
          onLayout={() => {
            if (!initialized.current) {
              initialized.current = true;
              scrollRef.current?.scrollTo({ y: indexRef.current * ITEM_HEIGHT, animated: false });
            }
          }}
          onScroll={onScroll}
          onMomentumScrollEnd={Platform.OS === 'web' ? undefined : onMomentumEnd}
          contentContainerStyle={{ paddingVertical: pad * ITEM_HEIGHT }}
        >
          {values.map((v, i) => (
            <Pressable
              key={v}
              style={styles.wheelItem}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
                setActive(i);
                if (i !== index) onSelect(i);
              }}
            >
              <Text style={[styles.wheelText, i === active ? styles.wheelTextActive : styles.wheelTextDim]}>
                {v}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Text style={styles.segmentLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  segmentCol: { alignItems: 'center' },
  wheelWindow: {
    width: 64,
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceHigh,
    overflow: 'hidden',
  },
  selectionBand: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(34,211,238,0.5)',
    backgroundColor: 'rgba(34,211,238,0.08)',
    zIndex: 1,
  },
  wheelItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelText: { textAlign: 'center', fontWeight: '900' },
  wheelTextActive: { color: palette.textPrimary, fontSize: 30 },
  wheelTextDim: { color: palette.textMuted, fontSize: 20 },
  segmentLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  colon: { color: palette.textSecondary, fontSize: 30, fontWeight: '900', marginTop: -14 },
  ampmCol: { marginLeft: spacing.sm, gap: 6 },
  ampmBtn: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: palette.surface,
  },
  ampmBtnActive: { borderColor: palette.violet, backgroundColor: 'rgba(34,211,238,0.2)' },
  ampmText: { color: palette.textSecondary, fontSize: 13, fontWeight: '800' },
  ampmTextActive: { color: palette.violetLight },
});
