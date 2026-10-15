
const { cleanTrip } = require("./clean-trips");
const features = require("../backend/features");

function check(name, got, want) {
  const ok = typeof got === "number" && typeof want === "number"
    ? Math.abs(got - want) < 0.000000001
    : JSON.stringify(got) === JSON.stringify(want);
  if (!ok) process.exitCode = 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}: got=${JSON.stringify(got)}, expected=${JSON.stringify(want)}`
  );
}

const zones = new Set([151, 239, 246]);

const good = {
  tpep_pickup_datetime: "2019-01-01 00:46:40",
  tpep_dropoff_datetime: "2019-01-01 00:53:20",
  trip_distance: "1.50",
  fare_amount: "7",
  total_amount: "9.95",
  PULocationID: "151",
  DOLocationID: "239"
};

const r1 = cleanTrip(good, zones);
check("accept", r1.status, "accept");

const badTime = {
  ...good,
  tpep_pickup_datetime: "2019-01-01 01:50:00",
  tpep_dropoff_datetime: "2019-01-01 01:00:00"
};
check("reject_time", cleanTrip(badTime, zones).status, "reject");

const negDist = {
  ...good,
  trip_distance: "-2"
};
check("reject_negative", cleanTrip(negDist, zones).status, "reject");

const zeroDist = {
  ...good,
  trip_distance: "0"
};
check("flag_zero", cleanTrip(zeroDist, zones).status, "flag");

const far = {
  ...good,
  trip_distance: "150",
  fare_amount: "400",
  total_amount: "410"
};
check("flag_outlier", cleanTrip(far, zones).status, "flag");

const unknown = {
  ...good,
  PULocationID: "999"
};
check("reject_zone", cleanTrip(unknown, zones).status, "reject");

check(
  "duration",
  features.getDurationMinutes(
    "2019-01-01 00:46:40",
    "2019-01-01 00:53:20"
  ),
  400 / 60
);

check(
  "speed",
  features.getSpeedMph(
    1.5,
    "2019-01-01 00:46:40",
    "2019-01-01 00:53:20"
  ),
  13.5
);

check("fare_per_mile", features.getFarePerMile(7, 1.5), 7 / 1.5);
check("fare_zero_dist", features.getFarePerMile(7, 0), null);
check("missing_time", cleanTrip({ ...good, tpep_pickup_datetime: "" }, zones).reason, "missing_time");
check("zero_duration", cleanTrip({ ...good, tpep_dropoff_datetime: good.tpep_pickup_datetime }, zones).reason, "bad_time");
check("invalid_calendar_date", features.normalizeTimestamp("2019-02-30 00:00:00"), null);
check("decoded_parquet_time", features.normalizeTimestamp(new Date("2019-01-01T00:46:40Z")), good.tpep_pickup_datetime);
check("missing_fare", cleanTrip({ ...good, fare_amount: null }, zones).reason, "missing_value");
check("negative_fare", cleanTrip({ ...good, fare_amount: "-5" }, zones).reason, "negative_value");
check("nonfinite_distance", cleanTrip({ ...good, trip_distance: Infinity }, zones).reason, "missing_value");
check("invalid_optional_number", cleanTrip({ ...good, extra: "invalid" }, zones).reason, "invalid_number");
check("negative_total", cleanTrip({ ...good, total_amount: "-1" }, zones).reason, "negative_value");
check("missing_optional_category", cleanTrip(good, zones).trip.passenger_count, null);
check("zero_fare", features.getFarePerMile(0, 2), 0);
check("null_fare", features.getFarePerMile(null, 2), null);
check("normalized_duplicate", cleanTrip({ ...good, trip_distance: 1.5, fare_amount: 7 }, zones).fingerprint, r1.fingerprint);
check("different_vendor_is_not_duplicate", cleanTrip({ ...good, VendorID: 1 }, zones).fingerprint === cleanTrip({ ...good, VendorID: 2 }, zones).fingerprint, false);
check("valid_zone_without_polygon", cleanTrip({ ...good, PULocationID: 264 }, new Set([264, 239])).status, "accept");
check("outside_source_month", cleanTrip(good, zones, "2019-02").reason, "outside_source_month");
