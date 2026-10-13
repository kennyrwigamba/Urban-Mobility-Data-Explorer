const fs = require("fs");
const {parse} = require ("csv-parse")

async function  head(file, n) {
    return new Promise(function (resolve,reject){
        const rows = [];
        let columns = null;
        let total = 0;
        const stream = fs.createReadStream(file).pipe(parse({columns: true ,skip_empty_lines:true}));
        stream.on("readable",function(){
            let record 
            while ((record = stream.read())!==null){
                total = total + 1;
                if (column === null ){
                    columns = Object.keys(record);
                }
                if(rows.length < n ){
                    rows.push(record);
                }
            }
        });
        stream.on("end",function (){resolve ({columns ,rows,total});});
        stream,on("error",reject);
    });
}

async function inspect(){
    const tripFile = process.env.TRIP_CSV ||  "C:/Users/user/Downloads/yellow_tripdata_2019-01.csv";
    const zoneFile = process.env.ZONE_CSV ||  "C:/Users/user/Downloads/taxi_zone_lookup.csv";
    const trip = await head(tripFile, 2);
    console.log("trip_columns: " + trip.columns.join(","));
    console.log(JSON.stringify(trip.rows,null,1));
    const zone = await head(zoneFile, 2);
    console.log("zone_columns: " + zone.columns.join(","));
    console.log("zone_rows: " + zone.total);
}

inspect ().catch(function (err){
    console.error(err.message);
    process.exit(1);
});
