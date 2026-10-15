const express = require("express");
const pool = require("./db");
const { badRequest, integerParameter, parseFilters } = require("./filters");
const { findTopRoutes } = require("./top-routes");
const router = express.Router();

async function loadDataset(req, res, next) {
    const [imports] = await pool.query("SELECT * FROM data_imports WHERE status='complete' ORDER BY id DESC LIMIT 1");
    if (imports.length === 0) {
        const error = new Error("No completed import. Run the database setup and data imports first.");
        error.status = 503;
        throw error;
    }
    const [zones] = await pool.query("SELECT location_id FROM taxi_zones");
    req.activeImport = imports[0];
    req.zoneIds = new Set(zones.map(function (zone) { return zone.location_id; }));
    next();
}

router.get("/zones", async function (req, res) {
    const [zones] = await pool.query("SELECT location_id AS locationId, zone_name AS zoneName, borough FROM taxi_zones ORDER BY borough, zone_name, location_id");
    if (zones.length === 0) {
        const error = new Error("Zone data is unavailable. Run the zone import first.");
        error.status = 503;
        throw error;
    }
    res.json({ data: zones, meta: {} });
});

router.get("/trips", loadDataset, async function (req, res) {
    const selected = parseFilters(req.query, req.activeImport.id, req.zoneIds, ["page", "pageSize", "sortBy", "sortOrder"]);
    const page = integerParameter(req.query, "page", 1, 1000000);
    const pageSize = integerParameter(req.query, "pageSize", 25, 100);
    const sortColumns = {
        pickupDatetime: "t.pickup_datetime", tripDistance: "t.trip_distance",
        fareAmount: "t.fare_amount", durationMinutes: "t.duration_min"
    };
    const sortBy = req.query.sortBy || "pickupDatetime";
    const sortOrder = req.query.sortOrder || "desc";
    if (!Object.hasOwn(sortColumns, sortBy)) throw badRequest("Unknown sort column.");
    if (!["asc", "desc"].includes(sortOrder)) throw badRequest("Sort order must be asc or desc.");
    const [count] = await pool.execute("SELECT COUNT(*) AS total FROM trip_features t WHERE " + selected.where, selected.values);
    const [trips] = await pool.query(
        "SELECT t.id, t.pickup_datetime AS pickupDatetime, p.zone_name AS pickupZoneName, d.zone_name AS dropoffZoneName, t.trip_distance AS tripDistance, t.duration_min AS durationMinutes, t.speed_mph AS speedMph, t.fare_amount AS fareAmount, t.fare_per_mile AS farePerMile, t.is_flagged AS isFlagged FROM trip_features t JOIN taxi_zones p ON p.location_id=t.pickup_zone_id JOIN taxi_zones d ON d.location_id=t.dropoff_zone_id WHERE " + selected.where + " ORDER BY " + sortColumns[sortBy] + " " + sortOrder + ", t.id " + sortOrder + " LIMIT ? OFFSET ?",
        [...selected.values, pageSize, (page - 1) * pageSize]
    );
    for (const trip of trips) trip.isFlagged = Boolean(trip.isFlagged);
    res.json({ data: trips, meta: { importId: req.activeImport.id, filters: selected.filters, page, pageSize, totalRows: count[0].total, totalPages: Math.ceil(count[0].total / pageSize) } });
});

router.get("/stats", loadDataset, async function (req, res) {
    const selected = parseFilters(req.query, req.activeImport.id, req.zoneIds);
    const [summary] = await pool.execute(
        "SELECT COUNT(*) AS tripCount, AVG(t.duration_min) AS averageDurationMinutes, AVG(t.fare_amount) AS averageFareAmount, COUNT(t.duration_min) AS durationCount, COUNT(t.fare_amount) AS fareCount FROM trip_features t WHERE " + selected.where,
        selected.values
    );
    const [hours] = await pool.execute(
        "SELECT HOUR(t.pickup_datetime) AS hour, COUNT(*) AS tripCount, AVG(t.duration_min) AS averageDurationMinutes, COUNT(t.duration_min) AS durationCount FROM trip_features t WHERE " + selected.where + " GROUP BY HOUR(t.pickup_datetime)",
        selected.values
    );
    const hourly = [];
    for (let hour = 0; hour < 24; hour++) {
        const found = hours.find(function (row) { return row.hour === hour; });
        hourly.push(found || { hour, tripCount: 0, averageDurationMinutes: null, durationCount: 0 });
    }
    const [groups] = await pool.execute(
        "SELECT CASE WHEN t.trip_distance<1 THEN 0 WHEN t.trip_distance<3 THEN 1 WHEN t.trip_distance<5 THEN 2 WHEN t.trip_distance<10 THEN 3 ELSE 4 END AS band, COUNT(*) AS tripCount, AVG(t.fare_per_mile) AS averageFarePerMile, COUNT(t.fare_per_mile) AS eligibleCount FROM trip_features t WHERE " + selected.where + " GROUP BY band",
        selected.values
    );
    const labels = ["0–1", "1–3", "3–5", "5–10", "10+"];
    const fareDistance = [];
    for (let band = 0; band < labels.length; band++) {
        const found = groups.find(function (row) { return row.band === band; });
        fareDistance.push({ label: labels[band], tripCount: found ? found.tripCount : 0, averageFarePerMile: found ? found.averageFarePerMile : null, eligibleCount: found ? found.eligibleCount : 0 });
    }
    const active = req.activeImport;
    res.json({
        data: { summary: summary[0], hourly, fareDistance },
        meta: {
            importId: active.id, filters: selected.filters,
            dataset: { periodStart: active.period_start, periodEnd: active.period_end, scope: active.scope + " of " + active.source_name, timezone: "America/New_York", acceptedFlagged: active.accepted_flagged, excluded: active.excluded }
        }
    });
});

router.get("/routes/top", loadDataset, async function (req, res) {
    const selected = parseFilters(req.query, req.activeImport.id, req.zoneIds, ["k"]);
    const k = integerParameter(req.query, "k", 5, 20);
    const [groups] = await pool.execute(
        "SELECT t.pickup_zone_id AS pickupLocationId, t.dropoff_zone_id AS dropoffLocationId, COUNT(*) AS tripCount FROM trip_features t WHERE " + selected.where + " GROUP BY t.pickup_zone_id, t.dropoff_zone_id",
        selected.values
    );
    const [zones] = await pool.query("SELECT location_id, zone_name FROM taxi_zones");
    const names = new Map(zones.map(function (zone) { return [zone.location_id, zone.zone_name]; }));
    const ranked = findTopRoutes(groups, k);
    const routes = ranked.map(function (route) {
        return { ...route, pickupZoneName: names.get(route.pickupLocationId), dropoffZoneName: names.get(route.dropoffLocationId) };
    });
    res.json({ data: routes, meta: { importId: req.activeImport.id, filters: selected.filters, groupCount: groups.length } });
});

module.exports = router;
