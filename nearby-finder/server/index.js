const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const AMENITY_MAP = {
  gas: { key: 'amenity', value: 'fuel' },
  restroom: { key: 'amenity', value: 'toilets' },
  restaurant: { key: 'amenity', value: 'restaurant' },
  charging: { key: 'amenity', value: 'charging_station' },
};

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/nearby', async (req, res) => {
  try {
    const { lat, lon, type, radius } = req.query;

    if (!lat || !lon || !type) {
      return res.status(400).json({ error: 'Missing required query params: lat, lon, type' });
    }

    const amenity = AMENITY_MAP[String(type)];
    if (!amenity) {
      return res.status(400).json({ error: 'Invalid type. Use one of: gas, restroom, restaurant, charging' });
    }

    const searchRadius = Number(radius) || 3000; // meters
    const latitude = Number(lat);
    const longitude = Number(lon);

    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["${amenity.key}"="${amenity.value}"](around:${searchRadius},${latitude},${longitude});
        way["${amenity.key}"="${amenity.value}"](around:${searchRadius},${latitude},${longitude});
        relation["${amenity.key}"="${amenity.value}"](around:${searchRadius},${latitude},${longitude});
      );
      out center tags 100;
    `;

    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 30000,
      }
    );

    const elements = Array.isArray(response.data?.elements) ? response.data.elements : [];
    const results = elements
      .map((el) => {
        let itemLat = el.lat;
        let itemLon = el.lon;
        if ((itemLat == null || itemLon == null) && el.center) {
          itemLat = el.center.lat;
          itemLon = el.center.lon;
        }
        if (itemLat == null || itemLon == null) return null;
        const distance = haversineDistanceMeters(latitude, longitude, itemLat, itemLon);
        return {
          id: el.id,
          type: el.type,
          name: el.tags?.name || null,
          tags: el.tags || {},
          lat: itemLat,
          lon: itemLon,
          distanceMeters: Math.round(distance),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 5);

    res.json({ center: { lat: latitude, lon: longitude }, type, radius: searchRadius, count: results.length, results });
  } catch (error) {
    console.error('Error in /api/nearby:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch data from Overpass API' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});