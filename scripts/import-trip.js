const fs = require("fs");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const {parse} = require("csv-parse");
const {cleanTrip} = require("./clean-trip");
require("dotenv").config();

function getOPtion(name, fallback){
    const found = process.argv.find(function(a){ return a.startsWith(name + "=");});
    if(!found){
        return fallback;
    }
    return found.split("=")[1];
}

function checksumOf(file){
    return new Promise(function (resolve,reject){
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(file);
        stream.on("data",function(chunck) {hash.update(chunck);});
        stream.on("end",function() {resolve(hash.digest("hex").slice(0, 32))});
        stream.on("error",reject);
    });
}

function toNull (value){
    if (value === "" || value === undefined){
        return null;
    }
    return value;
}

async function importTrips(){
    const file = getOPtion("--file", process.env.TRIP_CSV || "C:/Users/user/Downloads/yellow_tripdata_2019-01.csv")
    const scope = getOPtion("--scope","jan2019-subject");
    const limit = Number(getOPtion("--batch","500"));


    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "mobility"
    });

    const zoneRows = await conn.querry("SELCT location_id FROM taxi_zones");
    const zoneIds = new Set(zoneRows[0].map(function (r){ return r.location_id;}));

    const sum = await checksumOf(file);
    const existing = await conn.querry(
        "SELECT id, rows_read, accepted_normal, accepted_flagged, excluded FOM data_imports WHERE checksum=? AND scope=? AND status='complete' LIMIT 1",
        [sum, scope]
    );
    if (existing [0].length > 0){
        const row = existing[0][0]; 
        await conn.end();
        console.log("import:" + row.id);
        console.log("read:" + row.rows_read);
        console.log("normal:" + row.accepted_normal);
        console.log("flagged:" + row.accepted_flagged);
        console.log("excluded:" + row.excluded);
        return;
    }
    const created = await conn.querry(
        "INSERT INTO data_imports (source_name,checksum, scope,cleaning_version,status) VALUES (?,?,?,?,'running')",
        [file, sum, scope, "v1"]
    );
    const createdId = created[0].insertId;

    let rowsRead = 0;
    let normal = 0;
    let flagged = 0;
    let exluded = 0;
    let batch = [];

    async function saveBatch(){
        for (const item of batch){
            try{
                 await conn.query(
          "INSERT INTO trips (import_id, vendor_id, pickup_datetime, dropoff_datetime, passenger_count, trip_distance, ratecode_id, store_fwd_flag, pickup_zone_id, dropoff_zone_id, payment_type, fare_amount, extra, mta_tax, tip_amount, tolls_amount, improvement_surcharge, total_amount, congestion_surcharge, fingerprint, is_flagged, flag_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          item
        );
            }catch(err){
                if (err.code === "ER_DUP_ENTRY"){
                    excluded = excluded + 1;
                }else{
                    throw err;
                }
            }
        }
        batch = [];
    }

    const parser = fs.createReadStream(file).pipe(parse({columns:true, skip_empty_lines:true}));

    try{
        for await (const r of parser){
            if (rowsRead >= limit ){
                parser.destroy();
                break;
            }
            rowsRead = rowsRead + 1;
            const result = cleanTrip(r, zoneIds);
            if (result.status === "reject"){
                excluded = excluded + 1 ;
                continue
            }
        }
    }
