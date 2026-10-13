const crypto = require("crypto");
const features = require("../backend/features");

function toNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return null;
  }
  return num;
}

function makeFingerprint(row) {
  const text = [
    row.tpep_pickup_datetime,
    row.tpep_dropoff_datetime,
    row.PULocationID,
    row.DOLocationID,
    row.trip_distance,
    row.fare_amount,
    row.total_amount
  ].join("|");
  return crypto.createHash("sha256").update(text).digest("hex");
}

function cleanTrip(row, zoneIds) {
  const pickup = row.tpep_pickup_datetime;
  const dropoff = row.tpep_dropoff_datetime;
  const distance = toNumber(row.trip_distance);
  const fare = toNumber(row.fare_amount);
  const puId = Number(row.PULocationID);
  const doId = Number(row.DOLocationID);

  if (!pickup || !dropoff) {
    return { status: "reject", reason: "missing_time" };
  }

  const seconds = features.toSeconds(pickup, dropoff);
  if (seconds === null || seconds <= 0) {
    return { status: "reject", reason: "bad_time" };
  }

  if (distance === null || fare === null) {
    return { status: "reject", reason: "missing_value" };
  }

  if (distance < 0 || fare < 0) {
    return { status: "reject", reason: "negative_value" };
  }

  if (!zoneIds.has(puId) || !zoneIds.has(doId)) {
    return { status: "reject", reason: "unknown_zone" };
  }

  const duration = features.getDurationMinutes(pickup, dropoff);
  const speed = features.getSpeedMph(distance, pickup, dropoff);

  if (distance === 0) {
    return { status: "flag", reason: "zero_distance", fingerprint: makeFingerprint(row), duration, speed };
  }

  if (distance > 100 || fare > 500 || duration > 1440 || (speed !== null && speed > 100)) {
    return { status: "flag", reason: "outlier", fingerprint: makeFingerprint(row), duration, speed };
  }

  return { status: "accept", reason: "", fingerprint: makeFingerprint(row), duration, speed };
}

module.exports = {
  cleanTrip,
  makeFingerprint,
  toNumber
};
