const crypto = require("crypto");
const features = require("../backend/features");

function toNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function makeFingerprint(trip) {
    return crypto.createHash("sha256").update(JSON.stringify(trip)).digest("hex");
}

function cleanTrip(row, zoneIds, sourceMonth) {
    if (!row.tpep_pickup_datetime || !row.tpep_dropoff_datetime) {
        return { status: "reject", reason: "missing_time" };
    }
    const pickup = features.normalizeTimestamp(row.tpep_pickup_datetime);
    const dropoff = features.normalizeTimestamp(row.tpep_dropoff_datetime);
    const seconds = features.toSeconds(pickup, dropoff);
    if (seconds === null || seconds <= 0) return { status: "reject", reason: "bad_time" };

    const distance = toNumber(row.trip_distance);
    const fare = toNumber(row.fare_amount);
    if (distance === null || fare === null) return { status: "reject", reason: "missing_value" };
    if (distance < 0 || fare < 0) return { status: "reject", reason: "negative_value" };

    const pickupZone = toNumber(row.PULocationID);
    const dropoffZone = toNumber(row.DOLocationID);
    if (!Number.isInteger(pickupZone) || !Number.isInteger(dropoffZone) || !zoneIds.has(pickupZone) || !zoneIds.has(dropoffZone)) {
        return { status: "reject", reason: "unknown_zone" };
    }

    const trip = {
        vendor_id: toNumber(row.VendorID),
        pickup_datetime: pickup,
        dropoff_datetime: dropoff,
        passenger_count: toNumber(row.passenger_count),
        trip_distance: Number(distance.toFixed(2)),
        ratecode_id: toNumber(row.RatecodeID),
        store_fwd_flag: row.store_and_fwd_flag ? String(row.store_and_fwd_flag).trim().toUpperCase() : null,
        pickup_zone_id: pickupZone,
        dropoff_zone_id: dropoffZone,
        payment_type: toNumber(row.payment_type),
        fare_amount: Number(fare.toFixed(2))
    };
    for (const name of ["vendor_id", "passenger_count", "ratecode_id", "payment_type"]) {
        if (trip[name] !== null && (!Number.isInteger(trip[name]) || trip[name] < 0)) {
            return { status: "reject", reason: "invalid_category" };
        }
    }
    for (const name of ["extra", "mta_tax", "tip_amount", "tolls_amount", "improvement_surcharge", "total_amount", "congestion_surcharge"]) {
        const value = toNumber(row[name]);
        if (value !== null && value < 0) return { status: "reject", reason: "negative_value" };
        if (value === null && row[name] !== null && row[name] !== undefined && String(row[name]).trim() !== "") {
            return { status: "reject", reason: "invalid_number" };
        }
        trip[name] = value === null ? null : Number(value.toFixed(2));
    }

    const duration = features.getDurationMinutes(pickup, dropoff);
    const speed = features.getSpeedMph(trip.trip_distance, pickup, dropoff);
    let reason = "";
    if (sourceMonth && pickup.slice(0, 7) !== sourceMonth) reason = "outside_source_month";
    else if (trip.trip_distance === 0) reason = "zero_distance";
    else if (trip.trip_distance > 100 || trip.fare_amount > 500 || duration > 1440 || speed > 100) reason = "outlier";

    return {
        status: reason ? "flag" : "accept",
        reason,
        trip,
        fingerprint: makeFingerprint(trip),
        duration,
        speed
    };
}

module.exports = { cleanTrip, makeFingerprint, toNumber };
