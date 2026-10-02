// Migration một lần: đưa `trips` trong db.json về model mới của
// docs/features/trip-board.md §10. Chạy: node scripts/migrate-trips.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DB = new URL('../db.json', import.meta.url);
const BACKUP = new URL('../db.before-itinerary-migration.json', import.meta.url);

const db = JSON.parse(readFileSync(DB, 'utf8'));

if (!existsSync(BACKUP)) {
  writeFileSync(BACKUP, JSON.stringify(db, null, 2) + '\n');
  console.log('backup -> db.before-itinerary-migration.json');
}

let migrated = 0;

db.trips = (db.trips ?? []).map((trip) => {
  if (Array.isArray(trip.regions) && trip.party) return trip; // đã migrate

  const { regionId, regionName, country, extraTravelers, ...rest } = trip;
  const travelers = Array.isArray(rest.travelers) ? rest.travelers : [];

  migrated += 1;

  return {
    ...rest,
    regions: regionId ? [{ id: regionId, name: regionName, ...(country ? { country } : {}) }] : [],
    travelers,
    // Tổng số người trước đây = travelers.length + extraTravelers.
    party: { adults: travelers.length + (extraTravelers ?? 0), children: 0 },
    days: (rest.days ?? []).map((day) => ({
      ...day,
      items: (day.items ?? []).map((item) => ({
        id: item.id,
        kind: 'place',
        placeId: item.placeId,
        startTime: item.startTime ?? null,
        endTime: item.endTime ?? null,
        order: item.order,
      })),
    })),
    unscheduledItems: rest.unscheduledItems ?? [],
  };
});

writeFileSync(DB, JSON.stringify(db, null, 2) + '\n');
console.log(`migrated ${migrated}/${db.trips.length} trips`);
