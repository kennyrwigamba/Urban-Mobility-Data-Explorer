const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { readTrips } = require("./read-trips");
require("dotenv").config({ quiet: true });

async function inspect() {
    const fileName = process.argv[2] || process.env.TRIP_PARQUET || "data/yellow_tripdata_2019-01.parquet";
    const source = await readTrips(fileName, 2);
    console.log(JSON.stringify({ source: fileName, totalRows: source.totalRows, columns: source.columns, sample: source.rows }, function (key, value) {
        return typeof value === "bigint" ? value.toString() : value;
    }, 2));
    const zoneFile = process.env.ZONE_CSV || "data/taxi_zone_lookup.csv";
    const zones = parse(fs.readFileSync(zoneFile, "utf8"), { columns: true, skip_empty_lines: true, bom: true });
    console.log("Zone lookup rows: " + zones.length);
    const geoFile = process.env.ZONE_GEOJSON || "data/taxi_zones.geojson";
    if (fs.existsSync(geoFile)) {
        const geojson = JSON.parse(fs.readFileSync(geoFile, "utf8"));
        console.log("Geometry features: " + geojson.features.length);
    } else {
        console.log("Run import:zones to create GeoJSON from the local TLC shapefile.");
    }
}

inspect().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
});
