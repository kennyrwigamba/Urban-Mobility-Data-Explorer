CREATE TABLE IF NOT EXISTS taxi_zones (
    location_id INT PRIMARY KEY,
    borough VARCHAR(50) NOT NULL,
    zone_name VARCHAR(100) NOT NULL,
    service_zone VARCHAR(50) NOT NULL,
    geometry LONGTEXT NULL
);

CREATE TABLE IF NOT EXISTS data_imports(
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_name VARCHAR(225) NOT NULL,
    checksum VARCHAR(128) NOT NULL,
    scope VARCHAR(50) NOT NULL,
    cleaning_version VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    rows_read INT NOT NULL DEFAULT 0,
    accepted_normal INT NOT NULL DEFAULT 0,
    accepted_flagged INT NOT NULL DEFAULT 0,
    excluded INT NOT NULL DEFAULT 0,
    period_start DATETIME NULL,
    period_end DATETIME NULL,
    started_at DATETIME NULL,
    finished_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS trips(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    import_id INT NOT NULL,
    vendor_id INT NOT NULL,
    pickup_datetime DATETIME NOT NULL,
    dropoff_datetime DATETIME NOT NULL,
    passenger_count INT NULL,
    trip_distance DECIMAL(10, 2) NOT NULL,
    ratecode_id INT NULL,
    store_fwd_flag VARCHAR(5) NULL,
    pickup_zone_id INT NOT NULL,
    dropoff_zone_id INT NOT NULL,
    payment_type INT NULL,
    fare_amount DECIMAL(10, 2) NOT NULL,
    extra DECIMAL(10, 2) NULL,
    mta_tax DECIMAL(10, 2) NULL,
    tip_amount DECIMAL(10, 2) NULL,
    tolls_amount DECIMAL(10, 2) NULL,
    improvement_surcharge DECIMAL (10, 2) NULL,
    total_amount DECIMAL(10, 2) NULL,
    congestion_surcharge DECIMAL(10, 2) NULL,
    fingerprint CHAR(65) NOT NULL,
    is_flagged TINYINT(1) NOT NULL DEFAULT 0,
    flag_reason VARCHAR(255) NULL,
    CONSTRAINT fk_trips_import FOREIGN KEY (import_id) REFERENCES data_imports (id),
    CONSTRAINT fk_trips_pickup FOREIGN KEY (pickup_zone_id) REFERENCES taxi_zones (location_id),
    CONSTRAINT fk_trips_droppoff FOREIGN KEY (droppoff_zone_id) REFERENCES taxi_zones (location_id),
    UNIQUE KEY uq_import_fingerprint (import_id,fingerprint),
    INDEX idx_trips_pickup_time (pickup_datetime),
    INDEX idx_trips_pu(pickup_zone_id),
    INDEX idx_trips_do(droppoff_zone_id),
);

CREATE OR REPLACE  VIEW trip_features AS 
SELECT
t.id,
t.import_id,
t.pickup_datetime,
t.dropoff_datetime,
t.trip_distance,
  t.fare_amount,
  t.pickup_zone_id,
  t.dropoff_zone_id,
  t.is_flagged,
  TIMESTAMPDIFF(SECOND, t.pickup_datetime, t.dropoff_datetime) / 60 AS duration_min,
  CASE
    WHEN TIMESTAMPDIFF(SECOND, t.pickup_datetime, t.dropoff_datetime) > 0 AND t.trip_distance > 0
    THEN t.trip_distance * 3600 / TIMESTAMPDIFF(SECOND, t.pickup_datetime, t.dropoff_datetime)
    ELSE NULL
  END AS speed_mph,
  CASE
    WHEN t.trip_distance > 0 THEN t.fare_amount / t.trip_distance
    ELSE NULL
  END AS fare_per_mile
FROM trips t;
