
const { cleanTrip } = require("./clean-trips");
const features = require("../backend/features");

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
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
