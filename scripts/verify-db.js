const mysql = require("mysql2/promise");
require("dotenv").config();

async function verifyDb(){
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || 'mobility'
    });
    const active  = await conn.query("SELECT id FROM  imports WHERE status = 'complete' ORDER BY id DESC LIMIT 1");
    if (active[0].length === 0){
        console.log("No completed imports found in the database.");
        await conn.end();
        return;
    }
}

const lastImportId = active[0][0].id;
console.log("import: " + lastImportId);

const counts = await conn.query("SELECT rows_read, accepted_normal, accepted_flaggged, excluded FROM data_imports WHERE import_id = ?", [lastImportId]);
console.log(JSON.stringify(counts[0][0]));

const check = await conn.query("SELECT COUNT(*) AS n FROM trips WHERE import_id = ?", [lastImportId]);
console.log("trips: " + check[0][0].n);

const joins = await conn.query("SELECT COUNT(*) AS n FROM trips t LEFT JOIN taxi_zones p on p.location_id = t.pickup_location_id LEFT JOIN data_imports d ON  d.location_id = t.dropoff_zone_id WHERE t.import_id =? AND (p.location_id IS NULL OR d.location_id is NULL)",[lastImportId]);
console.log("bad_joins: " + joins[0][0].n);

const known = await conn.query("SELECT  id, pickup_datetime, dropoff_datetime, trip_distance,fare_amount,duration_min,speed_mph, fare_per_mile FROM trip_features WHERE import_id=? LIMIT 1", [importId]);
console.log(JSON.stringify(known[0][0]));

const plans = await conn.query("EXPLAIN SELECT * FROM trips WHERE imports_id = ? AND pickup_datetime >= ? AND pickup_datetime >= ? AND pickup_datetime < ?", [lastImportId, "2019-01-01 00:00:00", "2019-02-01 00:00:00"]);
console.log(JSON.stringify(plans[0]));
  await conn.end();


verifyDb().catch(function (err){
    console.error(err.message);
    process.exit(1);
})