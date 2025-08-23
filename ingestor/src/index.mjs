import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
import { z } from 'zod';

// === CONFIG ===
const OUT_DIR = path.resolve(process.cwd(), '../web/static/data');
const HISTORY_FILE = path.join(OUT_DIR, 'history.json');
const TODAY_FILE = path.join(OUT_DIR, 'today.json');

// Feeds públicos de Renfe Data (Cercanías)
const FEEDS = {
  trips: process.env.RENFE_RT_TRIPS_URL || 'https://data.renfe.com/api/gtfs-rt/viajes.json',
  alerts: process.env.RENFE_RT_ALERTS_URL || 'https://data.renfe.com/api/gtfs-rt/avisos.json'
};

// Esquema simplificado de un viaje RT
const TripSchema = z.object({
  trip_id: z.string(),
  route_id: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  scheduled_departure: z.string().optional(),
  actual_departure: z.string().optional(),
  scheduled_arrival: z.string().optional(),
  actual_arrival: z.string().optional(),
  status: z.enum(['ON_TIME','DELAYED','CANCELLED','ADDED']).optional()
}).passthrough();

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!r.ok) throw new Error(`Fetch ${url} -> ${r.status}`);
  return r.json();
}

function minutesBetween(a, b) {
  if (!a || !b) return null;
  const ms = (new Date(b) - new Date(a));
  return Math.round(ms / 60000);
}

function bucketDelay(mins) {
  if (mins === null) return 'unknown';
  if (mins < 5) return '0-5min';
  if (mins < 15) return '5-15min';
  if (mins < 30) return '15-30min';
  if (mins < 45) return '30-45min';
  return '45+min';
}

function computeMetrics(trips) {
  const summary = {
    date: new Date().toISOString(),
    totals: { trains: 0, cancelled: 0, delayed15: 0, delayed30: 0 },
    avgDelayDepartureMin: 0,
    worst: null,
    buckets: { '0-5min': 0, '5-15min': 0, '15-30min': 0, '30-45min': 0, '45+min': 0 }
  };

  let delaySum = 0;
  let delayCount = 0;

  for (const t of trips) {
    summary.totals.trains++;
    if (t.status === 'CANCELLED') {
      summary.totals.cancelled++;
      continue;
    }
    const depDelay = minutesBetween(t.scheduled_departure, t.actual_departure);
    if (depDelay !== null) {
      delaySum += depDelay;
      delayCount++;
      if (depDelay >= 15) summary.totals.delayed15++;
      if (depDelay >= 30) summary.totals.delayed30++;
      const b = bucketDelay(depDelay);
      summary.buckets[b]++;
      if (!summary.worst || depDelay > summary.worst.delayMin) {
        summary.worst = {
          trip_id: t.trip_id,
          origin: t.origin,
          destination: t.destination,
          delayMin: depDelay,
          scheduled_departure: t.scheduled_departure,
          actual_departure: t.actual_departure
        };
      }
    }
  }

  summary.avgDelayDepartureMin = delayCount ? Math.round(delaySum / delayCount) : 0;
  return summary;
}

async function main() {
  await ensureDir(OUT_DIR);

  // 1) Descarga tiempo real
  const tripsRaw = await fetchJSON(FEEDS.trips);
  const trips = [];
  for (const item of tripsRaw.trips ?? tripsRaw ?? []) {
    try {
      const t = TripSchema.parse({
        trip_id: item.trip_id || item.id || String(item.tripId ?? ''),
        route_id: item.route_id ?? item.routeId,
        origin: item.origin || item.origin_station || item.from,
        destination: item.destination || item.destination_station || item.to,
        scheduled_departure: item.scheduled_departure || item.planned_departure || item.departure?.scheduled,
        actual_departure: item.actual_departure || item.departure?.actual,
        scheduled_arrival: item.scheduled_arrival || item.planned_arrival || item.arrival?.scheduled,
        actual_arrival: item.actual_arrival || item.arrival?.actual,
        status: item.status || (item.cancelled ? 'CANCELLED' : undefined)
      });
      trips.push(t);
    } catch {
      // ignoramos registros corruptos
    }
  }

  // 2) Métricas
  const metrics = computeMetrics(trips);

  // 3) today.json
  await fs.promises.writeFile(TODAY_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), metrics, sampleSize: trips.length }, null, 2));

  // 4) history.json
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(await fs.promises.readFile(HISTORY_FILE, 'utf-8'));
  }
  history.push({ date: metrics.date, metrics });
  history = history.slice(-45);
  await fs.promises.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));

  console.log(`OK: trips=${trips.length} avgDelay=${metrics.avgDelayDepartureMin} worst=${metrics?.worst?.delayMin ?? 'n/a'}m`);
}

main().catch((e) => {
  console.error('INGEST ERROR', e);
  process.exit(1);
});
