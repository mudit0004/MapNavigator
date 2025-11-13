const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Simple health route
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'Map Navigator Backend' });
});

/**
 * Search (autocomplete) using Nominatim (OpenStreetMap).
 * Query param: q=search text
 * Example: /api/search?q=New%20York
 */
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q || q.trim() === '') return res.status(400).json({ error: 'q param required' });

  try {
    const url = `https://nominatim.openstreetmap.org/search`;
    const params = {
      q,
      format: 'json',
      addressdetails: 1,
      limit: 6
    };
    const response = await axios.get(url, { params, headers: { 'User-Agent': 'map-navigator-demo' }});
    // Return trimmed results
    const results = response.data.map(r => ({
      display_name: r.display_name,
      lat: r.lat,
      lon: r.lon,
      type: r.type,
      boundingbox: r.boundingbox
    }));
    res.json(results);
  } catch (err) {
    console.error('Nominatim error', err?.message || err);
    res.status(500).json({ error: 'Failed to query search provider' });
  }
});

/**
 * Route using OSRM public demo server.
 * Query params: fromLat, fromLng, toLat, toLng
 * Returns geojson polyline + distance (meters) + duration (seconds)
 */
app.get('/api/route', async (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  if (!fromLat || !fromLng || !toLat || !toLng) {
    return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng are required' });
  }

  try {
    // OSRM expects lon,lat
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}`;
    const params = {
      overview: 'full',
      geometries: 'geojson',
      steps: false,
      alternatives: false
    };
    const response = await axios.get(url, { params });
    if (response.data.code !== 'Ok') {
      return res.status(500).json({ error: 'Routing provider returned error', detail: response.data });
    }
    const route = response.data.routes[0];
    res.json({
      distance: route.distance, // meters
      duration: route.duration, // seconds
      geometry: route.geometry // GeoJSON LineString
    });
  } catch (err) {
    console.error('OSRM error', err?.message || err);
    res.status(500).json({ error: 'Failed to query routing provider' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
