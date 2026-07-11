# PREDIKT Map Visual UX Fix

## Why this changed

Arrival Time rooms need a real visual map experience on web. The previous approach depended on `react-native-maps` for native and an embedded Google Maps style fallback on web, which was not reliable enough for Expo Web and could leave the experience feeling non-visual or fragile.

For PREDIKT, a route summary card is acceptable only as an emergency backup. It is not the intended Arrival Time setup UX.

## Chosen stack

- Web map: `Leaflet`
- Tiles: `OpenStreetMap`
- Search: backend provider abstraction with Google Places optional and OpenStreetMap/Nominatim fallback
- Route preview: backend provider abstraction with optional `OSRM_BASE_URL`

## Why Leaflet

- Works well in web-first MVPs
- Lightweight compared with heavier map SDK choices
- Easy to pair with OpenStreetMap tiles
- Keeps Expo Web unblocked without depending on native map rendering behavior

## Provider fallback strategy

### Search

1. Try Google Places when `GOOGLE_MAPS_API_KEY` is configured
2. Fallback to OpenStreetMap Nominatim with Bangalore/India query bias

### Route geometry

1. If `OSRM_BASE_URL` is configured, use OSRM route geometry and duration
2. Otherwise return a two-point approximate route line from start to destination
3. Label approximate results clearly as approximate

## Privacy boundaries

- Creator setup preview may use route coordinates to render the map line
- `previewGeometry` is returned only from authenticated creator setup preview
- `previewGeometry` must not appear in:
  - public invite preview
  - dashboard active predictions
  - participant room detail
  - live-state payloads
  - result or Moment Card style payloads

Creator setup preview geometry is not public live tracking.

## Setup

### Mobile web

```bash
cd mobile
npm install
npx expo start --web
```

### Backend

```bash
cd backend
npx prisma generate
npx prisma db push
npm run build
npm test -- --runInBand
```

### Optional routing provider

Set:

```bash
OSRM_BASE_URL=http://localhost:5000
```

If this is missing, PREDIKT falls back to an approximate route line and duration estimate.

## Troubleshooting

### No map visible

- Confirm the app is running on web
- Confirm `leaflet` is installed in `mobile/package.json`
- Confirm both Start and Destination have been selected

### No search results

- Try adding the city name, for example `Yelahanka Bangalore`
- Check that backend internet access is available for Nominatim or Google Places

### Route line missing

- Check `POST /routes/preview` response for `previewGeometry`
- If OSRM is unavailable, the fallback should still return a two-point approximate line

### Provider key missing

- Google search is optional
- OpenStreetMap/Nominatim remains the fallback
- OSRM is optional and only improves route quality
