import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import TextInputField from './TextInputField';
import { useTheme } from '../context/ThemeContext';
import api, { getApiErrorMessage } from '../services/api';

export interface PlaceSuggestion {
  placeId: string;
  label: string;
  mainText: string;
  secondaryText: string;
  latitude?: number;
  longitude?: number;
  provider?: string;
}

interface MapsConfig {
  placeSearchProvider?: string;
  olaConfigured?: boolean;
}

interface Props {
  label: string;
  value: string;
  onChangeValue: (value: string) => void;
  selectedPlaceId: string;
  onSelect: (suggestion: PlaceSuggestion) => void;
  placeholder: string;
  stackPriority?: number;
}

export default function RoutePlaceSearchInput({
  label,
  value,
  onChangeValue,
  selectedPlaceId,
  onSelect,
  placeholder,
  stackPriority = 1,
}: Props) {
  const { colors } = useTheme();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapsConfig, setMapsConfig] = useState<MapsConfig | null>(null);
  const [searchProvider, setSearchProvider] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get('/routes/maps-config')
      .then((res) => {
        if (active) setMapsConfig(res.data ?? null);
      })
      .catch(() => {
        if (active) setMapsConfig(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const providerHint = 'Type at least 2 letters to search places';

  useEffect(() => {
    let active = true;

    async function loadSuggestions() {
      if (value.trim().length < 2) {
        if (active) {
          setSuggestions([]);
          setLoading(false);
          setError(null);
          setSearchProvider(null);
        }
        return;
      }

      if (active) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await api.get('/routes/place-search', {
          params: { query: value.trim() },
          timeout: 8_000,
        });
        if (active) {
          setSuggestions(res.data?.suggestions ?? []);
          setSearchProvider(res.data?.searchProvider ?? null);
        }
      } catch (err: unknown) {
        if (active) {
          setSuggestions([]);
          setError(
            getApiErrorMessage(
              err,
              "We couldn't load places right now. Please check your connection and try again.",
            ),
          );
          setSearchProvider(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      void loadSuggestions();
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value]);

  const showDropdown =
    focused &&
    !selectedPlaceId &&
    value.trim().length >= 2 &&
    (loading || Boolean(error) || suggestions.length > 0);

  const selectedProviderLabel =
    searchProvider === 'ola' || mapsConfig?.placeSearchProvider === 'ola'
      ? 'Ola Maps'
      : 'OpenStreetMap';

  function handleSelect(suggestion: PlaceSuggestion) {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setSuggestions([]);
    setFocused(false);
    onSelect(suggestion);
  }

  function handleFocus() {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setFocused(true);
  }

  function handleBlur() {
    blurTimerRef.current = setTimeout(() => {
      setFocused(false);
    }, 160);
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          zIndex: stackPriority,
          ...(Platform.OS === 'web' ? ({ position: 'relative' } as object) : null),
        },
      ]}
    >
      <TextInputField
        label={label}
        value={value}
        onChangeText={(nextValue) => {
          onChangeValue(nextValue);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoCapitalize="words"
        autoCorrect={false}
        hint={
          selectedPlaceId
            ? `Selected · ${selectedProviderLabel}`
            : providerHint
        }
      />

      {showDropdown ? (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.surfaceHigh,
              borderColor: colors.border,
              shadowColor: '#000',
            },
          ]}
        >
          {loading ? (
            <Text style={[styles.dropdownStatus, { color: colors.textSecondary }]}>Searching places…</Text>
          ) : null}
          {error ? (
            <Text style={[styles.dropdownStatus, { color: colors.red }]}>{error}</Text>
          ) : null}
          {!loading && !error && suggestions.length === 0 ? (
            <Text style={[styles.dropdownStatus, { color: colors.textMuted }]}>
              No places found. Try adding a city, e.g. Yelahanka Bangalore.
            </Text>
          ) : null}
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.placeId}
              style={({ pressed }) => [
                styles.item,
                {
                  borderBottomColor: colors.border,
                  backgroundColor: pressed ? colors.purpleDim : 'transparent',
                },
                index === suggestions.length - 1 ? styles.itemLast : null,
              ]}
              onPress={() => handleSelect(suggestion)}
            >
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {suggestion.mainText || suggestion.label}
              </Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]} numberOfLines={2}>
                {suggestion.secondaryText || suggestion.label}
                {suggestion.provider === 'ola'
                  ? ' · Ola Maps'
                  : suggestion.provider === 'openstreetmap'
                    ? ' · OpenStreetMap'
                    : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  dropdown: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 240,
    overflow: 'hidden',
    zIndex: 2000,
    elevation: 12,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  dropdownStatus: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
