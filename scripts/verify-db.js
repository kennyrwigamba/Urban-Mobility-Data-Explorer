const fs = require("fs");
const { parse } = require("csv-parse/sync");
const pool = require("../backend/db");
const features = require("../backend/features");

async function verifyDb() {
    try {
        const [imports] = await pool.query("SELECT * FROM data_imports WHERE status='complete' ORDER BY id DESC LIMIT 1");
        if (imports.length === 0) throw new Error("No completed import found.");
        const active = imports[0];
        const [counts] = await pool.execute(
            "SELECT COUNT(*) AS total, SUM(is_flagged=0) AS normal, SUM(is_flagged=1) AS flagged FROM trips WHERE import_id=?",
            [active.id]
        );
        const actual = counts[0];
        if (active.rows_read !== active.accepted_normal + active.accepted_flagged + active.excluded) throw new Error("Import counts do not reconcile.");
        if (actual.total !== active.accepted_normal + active.accepted_flagged) throw new Error("Stored trip count does not match the import.");
        if (Number(actual.normal) !== active.accepted_normal || Number(actual.flagged) !== active.accepted_flagged) throw new Error("Stored quality counts do not match the import.");

        const [joins] = await pool.execute(
            "SELECT COUNT(*) AS missing FROM trips t LEFT JOIN taxi_zones p ON p.location_id=t.pickup_zone_id LEFT JOIN taxi_zones d ON d.location_id=t.dropoff_zone_id WHERE t.import_id=? AND (p.location_id IS NULL OR d.location_id IS NULL)",
            [active.id]
        );
        if (joins[0].missing !== 0) throw new Error("Trip zone joins are incomplete.");
        const [trips] = await pool.execute("SELECT * FROM trip_features WHERE import_id=? ORDER BY id LIMIT 10", [active.id]);
        for (const trip of trips) {
            const expected = [
                features.getDurationMinutes(trip.pickup_datetime, trip.dropoff_datetime),
                features.getSpeedMph(trip.trip_distance, trip.pickup_datetime, trip.dropoff_datetime),
                features.getFarePerMile(trip.fare_amount, trip.trip_distance)
            ];
            const actualValues = [trip.duration_min, trip.speed_mph, trip.fare_per_mile];
            for (let index = 0; index < expected.length; index++) {
                if (expected[index] === null && actualValues[index] !== null) {
                    throw new Error("JavaScript and SQL feature values differ.");
                }
                if (expected[index] !== null && (actualValues[index] === null || Math.abs(expected[index] - actualValues[index]) > 0.001)) {
                    throw new Error("JavaScript and SQL feature values differ.");
                }
            }
        }
        const auditFile = "data/audits/import-" + active.id + ".csv";
        const audit = parse(fs.readFileSync(auditFile, "utf8"), { columns: true, skip_empty_lines: true });
        const excluded = audit.filter(function (row) { return row.status === "excluded"; }).length;
        const flagged = audit.filter(function (row) { return row.status === "flagged"; }).length;
        if (excluded !== active.excluded || flagged !== active.accepted_flagged) throw new Error("Audit rows do not match quality counts.");
        console.log(JSON.stringify({ importId: active.id, rowsRead: active.rows_read, storedTrips: actual.total, normal: actual.normal, flagged: actual.flagged, excluded: active.excluded, missingZoneJoins: joins[0].missing, verifiedFeatureRows: trips.length, auditRows: audit.length }, null, 2));
    } finally {
        await pool.end();
    }
}

verifyDb().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
});
