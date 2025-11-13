const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ----------------------------
// 🟢 API ROUTES
// ----------------------------

// Health check
app.get('/api', (req, res) => {
  res.json({ ok: true, service: 'Map Navigator Backend' });
});

// Search using OpenStreetMap Nominatim
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
    const response = await axios.get(url, { params, headers: { 'User-Agent': 'map-navigator-demo' } });
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

// Routing using OSRM
app.get('/api/route', async (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  if (!fromLat || !fromLng || !toLat || !toLng) {
    return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng are required' });
  }

  try {
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
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry
    });
  } catch (err) {
    console.error('OSRM error', err?.message || err);
    res.status(500).json({ error: 'Failed to query routing provider' });
  }
});

// ----------------------------
// 🟣 SERVE FRONTEND (React build)
// ----------------------------

const __dirnameFull = path.resolve();
app.use(express.static(path.join(__dirnameFull, 'frontend', 'build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirnameFull, 'frontend', 'build', 'index.html'));
});

// ----------------------------

app.listen(PORT, () => {
  console.log(`✅ Backend + Frontend running on port ${PORT}`);
});
