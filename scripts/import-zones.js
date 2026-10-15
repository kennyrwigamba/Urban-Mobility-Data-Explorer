const fs = require("fs");
const { parse } = require("csv-parse/sync");
const pool = require("../backend/db");

async function loadGeometry(fileName) {
    if (!fs.existsSync(fileName)) {
        const { default: shp } = await import("shpjs");
        const base = "data/taxi_zones/taxi_zones";
        const converted = await shp({
            shp: fs.readFileSync(base + ".shp"),
            dbf: fs.readFileSync(base + ".dbf"),
            prj: fs.readFileSync(base + ".prj", "utf8")
        });
        fs.writeFileSync(fileName, JSON.stringify(converted));
        console.log("Converted the local TLC shapefile to GeoJSON.");
    }
    const geojson = JSON.parse(fs.readFileSync(fileName, "utf8"));
    if (geojson.type !== "FeatureCollection") throw new Error("Expected a GeoJSON FeatureCollection.");
    const geometries = new Map();
    for (const feature of geojson.features) {
        const id = Number(feature.properties.LocationID ?? feature.properties.location_id);
        const geometry = feature.geometry;
        if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid geometry location ID.");
        if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) throw new Error("Expected zone polygons.");
        const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
        if (geometries.has(id)) {
            geometries.get(id).coordinates.push(...polygons);
        } else {
            geometries.set(id, { type: "MultiPolygon", coordinates: [...polygons] });
        }
    }
    return geometries;
}

async function importZones() {
    let connection;
    try {
        const zoneFile = process.env.ZONE_CSV || "data/taxi_zone_lookup.csv";
        const geoFile = process.env.ZONE_GEOJSON || "data/taxi_zones.geojson";
        const rows = parse(fs.readFileSync(zoneFile, "utf8"), { columns: true, skip_empty_lines: true, bom: true, trim: true });
        const geometries = await loadGeometry(geoFile);
        const seen = new Set();
        const missing = [];
        connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const row of rows) {
            const id = Number(row.LocationID);
            if (!Number.isInteger(id) || id <= 0 || seen.has(id)) throw new Error("Invalid or duplicate lookup ID: " + row.LocationID);
            seen.add(id);
            const geometry = geometries.has(id) ? JSON.stringify(geometries.get(id)) : null;
            if (geometry === null) missing.push(id);
            await connection.query(
                "INSERT INTO taxi_zones (location_id, borough, zone_name, service_zone, geometry) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE borough=?, zone_name=?, service_zone=?, geometry=?",
                [id, row.Borough, row.Zone, row.service_zone, geometry, row.Borough, row.Zone, row.service_zone, geometry]
            );
        }
        for (const id of geometries.keys()) {
            if (!seen.has(id)) throw new Error("Geometry has no lookup row: " + id);
        }
        await connection.commit();
        console.log("Zones: " + seen.size);
        console.log("Unique geometry IDs: " + geometries.size);
        console.log("Zones without polygons: " + missing.join(", "));
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
        await pool.end();
    }
}

importZones().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
});
