# R01 source inspection
Period:January 2019, timezone America/New_York, local strings kept as-is

## yellow_tripdata_2019-01.csv
Source:NYC TLC yellow trip records, file in Downloads
Columns:VendorId,tpep_pickup_datetime,tpep_dropoff_datetime,passenger_count,trip_distance,RatecodeID,store_and_fwd_flag,PULocationID,DOLocationID,payment_type,fare_amount, extra, mta_tax, tip_amount, tolls_amount, improvement_surcharge, total_amount, congestion_surcharge.
Sample row:1,2019-01-01 00:46:40,2019-01-01 00:53:20, 1, 1.50, 1, N, 151, 239, 1, 7, 0.5, 0.5, 1.65, 0, 0.3, 9.95,empty. Samle check on 20000 rows:distance min 0,max 128.73,zero 150,over 100 only 1. Fare min -52, max 496.5,negative 18.Bad dropoff-before-pickup 5 in 5000.
Thresholds used:flag distance 0, distance over 100, fare over 500, duration over 1440 min, speed over 100 mph

## taxi_zone_lookup.csv
Colums:LocationID, Borough, Zone, service_zone. Rows: 265, IDs 1 to 265, no duplicate IDs.
Duplicate names: Corona in Queens twice (56, 57), Governors Island three times (103, 104, 105).
IDs 264 (Unknown) and 265 (Outside of NYC) have no polygon.

## taxi_zones shapefile
Folder taxi_zones, files .shp .dbf .shx .prj. Geometry property holding the ID LocationID.
Shapes:263, unique IDS 260. IDs 56 and 103 appear twice (split polygons, merged to MultiPolygon on conversion).
Missing polygons:57,104,105,264,265, Converted to taxi_zones. geojson with 260 features for import-zones.js.
Join rule:interger LocationID. keep lookup rows without polygon,geometry stays null.