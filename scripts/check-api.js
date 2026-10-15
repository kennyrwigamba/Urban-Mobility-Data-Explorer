const assert = require("assert/strict");
const { spawn } = require("child_process");
const pool = require("../backend/db");
const { getDurationMinutes, getFarePerMile } = require("../backend/features");

const base = "http://localhost:31874";
const servers = [];

async function startServer(port, settings = {}) {
    const child = spawn(process.execPath, ["backend/server.js"], {
        env: { ...process.env, ...settings, PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true
    });
    servers.push(child);
    await new Promise(function (resolve, reject) {
        const timer = setTimeout(function () { reject(new Error("Test server did not start.")); }, 10000);
        child.stdout.on("data", function (data) {
            if (String(data).includes("Server running")) {
                clearTimeout(timer);
                resolve();
            }
        });
        child.on("error", function (error) { clearTimeout(timer); reject(error); });
        child.on("exit", function () { clearTimeout(timer); reject(new Error("Test server exited.")); });
    });
}

async function request(path, status = 200, origin = base) {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(10000) });
    const body = await response.json();
    assert.equal(response.status, status, path + ": " + JSON.stringify(body));
    if (status >= 400) assert.equal(typeof body.error.message, "string");
    return body;
}

function closeEnough(actual, expected) {
    if (expected === null) assert.equal(actual, null);
    else assert(actual !== null && Math.abs(actual - expected) < 0.001, actual + " differs from " + expected);
}

function average(rows, field) {
    const values = rows.map(function (row) { return row[field]; }).filter(function (value) { return value !== null; });
    return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : null;
}

async function checkPopulation(rows, parameters, importId) {
    const query = new URLSearchParams(parameters).toString();
    const stats = await request("/api/stats?" + query);
    const trips = await request("/api/trips?" + query);
    const routes = await request("/api/routes/top?" + query);
    assert.equal(stats.meta.importId, importId);
    assert.equal(trips.meta.importId, importId);
    assert.equal(routes.meta.importId, importId);
    assert.equal(stats.data.summary.tripCount, rows.length);
    assert.equal(trips.meta.totalRows, rows.length);
    closeEnough(stats.data.summary.averageDurationMinutes, average(rows, "duration"));
    closeEnough(stats.data.summary.averageFareAmount, average(rows, "fare_amount"));
    assert.equal(stats.data.hourly.length, 24);
    assert.equal(stats.data.hourly.reduce(function (sum, hour) { return sum + hour.tripCount; }, 0), rows.length);
    for (const hour of stats.data.hourly) {
        const subset = rows.filter(function (row) { return Number(row.pickup_datetime.slice(11, 13)) === hour.hour; });
        assert.equal(hour.tripCount, subset.length);
        assert.equal(hour.durationCount, subset.length);
        closeEnough(hour.averageDurationMinutes, average(subset, "duration"));
    }
    assert.equal(stats.data.fareDistance.length, 5);
    for (let index = 0; index < 5; index++) {
        const limits = [0, 1, 3, 5, 10, Infinity];
        const subset = rows.filter(function (row) { return row.trip_distance >= limits[index] && row.trip_distance < limits[index + 1]; });
        const band = stats.data.fareDistance[index];
        assert.equal(band.tripCount, subset.length);
        assert.equal(band.eligibleCount, subset.filter(function (row) { return row.ratio !== null; }).length);
        closeEnough(band.averageFarePerMile, average(subset, "ratio"));
    }
    const groups = new Map();
    for (const row of rows) {
        const key = row.pickup_zone_id + ":" + row.dropoff_zone_id;
        if (!groups.has(key)) groups.set(key, { pickupLocationId: row.pickup_zone_id, dropoffLocationId: row.dropoff_zone_id, tripCount: 0 });
        groups.get(key).tripCount++;
    }
    const expected = [...groups.values()].sort(function (a, b) {
        return b.tripCount - a.tripCount || a.pickupLocationId - b.pickupLocationId || a.dropoffLocationId - b.dropoffLocationId;
    }).slice(0, 5);
    assert.deepEqual(routes.data.map(function (row) {
        return { pickupLocationId: row.pickupLocationId, dropoffLocationId: row.dropoffLocationId, tripCount: row.tripCount };
    }), expected);
    return { stats, trips };
}

async function checkApi() {
    try {
        const [imports] = await pool.query("SELECT id FROM data_imports WHERE status='complete' ORDER BY id DESC LIMIT 1");
        assert(imports.length, "Import trips before running API checks.");
        const importId = imports[0].id;
        const [all] = await pool.execute("SELECT id,pickup_datetime,dropoff_datetime,pickup_zone_id,dropoff_zone_id,trip_distance,fare_amount,is_flagged FROM trips WHERE import_id=?", [importId]);
        for (const row of all) {
            row.duration = getDurationMinutes(row.pickup_datetime, row.dropoff_datetime);
            row.ratio = getFarePerMile(row.fare_amount, row.trip_distance);
        }
        const normal = all.filter(function (row) { return row.is_flagged === 0; });
        await startServer(31874);
        assert.equal((await fetch(base + "/")).status, 200);
        assert.equal((await fetch(base + "/js/app.js")).status, 200);
        assert.equal((await fetch(base + "/favicon.ico")).status, 204);
        const zones = await request("/api/zones");
        assert(zones.data.length > 0);
        assert(zones.data.every(function (zone) { return Number.isInteger(zone.locationId) && typeof zone.zoneName === "string"; }));
        console.log("PASS frontend assets, zones and favicon");

        await checkPopulation(normal, {}, importId);
        await checkPopulation(all, { includeFlagged: "true" }, importId);
        const filtered = normal.filter(function (row) {
            return row.pickup_datetime.slice(0, 10) === "2019-01-01" && row.pickup_zone_id === 239 && row.trip_distance >= 0.5 && row.trip_distance <= 3 && row.fare_amount <= 10;
        });
        await checkPopulation(filtered, { dateFrom: "2019-01-01", dateTo: "2019-01-01", pickupZone: "239", minDistance: "0.5", maxDistance: "3", minFare: "0", maxFare: "10" }, importId);
        await checkPopulation([], { minFare: "999999" }, importId);
        console.log("PASS actual DB totals, filters, flagged/empty cases, hourly means, distance bands and manual ranking");

        for (const sortBy of ["pickupDatetime", "tripDistance", "fareAmount", "durationMinutes"]) {
            for (const direction of ["asc", "desc"]) {
                const field = { pickupDatetime: "pickup_datetime", tripDistance: "trip_distance", fareAmount: "fare_amount", durationMinutes: "duration" }[sortBy];
                const expected = [...normal].sort(function (a, b) {
                    const difference = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
                    return (difference || a.id - b.id) * (direction === "asc" ? 1 : -1);
                });
                const first = await request("/api/trips?pageSize=5&sortBy=" + sortBy + "&sortOrder=" + direction);
                const second = await request("/api/trips?pageSize=5&page=2&sortBy=" + sortBy + "&sortOrder=" + direction);
                assert.deepEqual(first.data.map(function (row) { return row.id; }), expected.slice(0, 5).map(function (row) { return row.id; }));
                assert.deepEqual(second.data.map(function (row) { return row.id; }), expected.slice(5, 10).map(function (row) { return row.id; }));
                assert(first.data.every(function (row) { return typeof row.isFlagged === "boolean" && typeof row.fareAmount === "number"; }));
            }
        }
        console.log("PASS all eight sorting choices, stable pagination and JSON number/boolean types");

        for (const path of [
            "/api/stats?dateFrom=2019-02-30", "/api/stats?dateFrom=2019-01-02&dateTo=2019-01-01",
            "/api/trips?minDistance=-1", "/api/stats?minFare=Infinity", "/api/trips?pickupZone=999999",
            "/api/trips?minFare=5&maxFare=1", "/api/trips?pageSize=101", "/api/trips?page=0",
            "/api/trips?sortBy=toString", "/api/trips?sortOrder=DROP", "/api/stats?includeFlagged=yes",
            "/api/stats?dateFrom=2019-01-01&dateFrom=2019-01-02", "/api/stats?unknown=value",
            "/api/routes/top?k=0", "/api/routes/top?k=21", "/api/trips?pickupZone=1%20OR%201=1"
        ]) await request(path, 400);
        await request("/api/missing", 404);
        await startServer(31875, { DB_PORT: "1" });
        await request("/api/stats", 503, "http://localhost:31875");
        console.log("PASS validation, SQL-looking input, unknown endpoint and unavailable database errors");
    } finally {
        for (const server of servers) server.kill();
        await pool.end();
    }
}

checkApi().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
});
