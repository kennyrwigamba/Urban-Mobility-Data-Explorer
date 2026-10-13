const fs = require("fs")
const mysql = require("mysql2/promise")
const {parse} = require("csv-parse/sync")
require("dotenv").config();
function readCsv(file){
 const text = fs.readFileSync(file,"utf8")
 return parse(text,{columns:true,skip_empty_lines:true})
}
function loadGeometry(file){
    if(!file||!fs.existsSync(file)){
        return new Map()
    }
    const raw = JSON.parse(fs.readFileSync(file,"utf8"))
    const map = new Map()
    for (const f of raw.features){
        const id = Number(f.properties.LocationID||f.properties.location_id)
        if(!map.has(id)){
            map.set(id,f.geometry)
        }
    }
    return map
}
async function importZones(){
    const zoneFile = process.env.ZONE_CSV || "C:/Users/user/Downloads/taxi_zone_lookup.csv"
    const geoFile = process.env.ZONE_GEOJSON || "C:/Users/user/Downloads/taxi_zones.geojson"
    const rows = readCsv(zoneFile)
    const geo = loadGeometry(geoFile)
    const conn= await mysql.createConnection({
        host:process.env.DB_HOST || "localhost",
        port:Number(process.env.DB_HOST ||3306),
        user:process.env.DB_PASSWORD || "",
        database:process.env.DB_NAME || "mobility"
    })
    let seen = new Set()
    let dup = 0
    let missing = 0
    for (const r of rows){
        const id = Number(r.LocationID)
        if(seen.has(id)){
            dup = dup +1
        }
        seen.add(id)
        let geom = null
        if(geo.has(id)){
            geom = JSON.stringify(geo.get(id))
        }else{
            missing = missing + 1
        }
        await conn.query(
            "REPLACE INTO taxi_zones (location_id, borough, zone_name, service_zone, geometry) VALUES (?, ?, ?, ?, ?)",
            [id,r.Borough,r.Zone,r.service_zone,geom]
        )
    }
    await conn.end()
    console.log("zones:" + rows.length)
    console.log("duplicate_ids: " + dup);
    console.log("missing_polygon:" + missing)

}

importZones().catch(function(err){
    console.error(err.message);
    process.exist(1)
})