# Urban Mobility Data Explorer

A dashboard for exploring NYC yellow taxi trips using HTML, CSS, JavaScript, Express and MySQL. It includes shared filters, sorting, pagination, three charts and ranked busiest routes.

The current development import uses the first **5,000 source rows**, not the full month. See [verified scope and limitations](database/final-scope.md).

## Project links

- [Tasksheet](https://docs.google.com/spreadsheets/d/17_m0DaBuCWtHYLUwbc1sObbU-axApnu_44bMvPc2hXE/edit?usp=sharing)
- [Scrum board](https://github.com/users/kennyrwigamba/projects/7)

## Setup

Tested with Node.js 26.2.0 and MySQL 8.4.2. Start MySQL, then run from the project root:

```powershell
npm ci
Copy-Item .env.example .env
```

Set your MySQL credentials in `.env` and keep `DB_NAME=mobility`. Skip the copy command if `.env` already exists. If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm`.

## Data files

Download these [NYC TLC datasets](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page); raw files are not included in Git:

| Dataset | Local path |
| --- | --- |
| [January 2019 yellow taxi trips](https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2019-01.parquet) | `data/yellow_tripdata_2019-01.parquet` |
| [Taxi zone lookup](https://d37ci6vzurychx.cloudfront.net/misc/taxi_zone_lookup.csv) | `data/taxi_zone_lookup.csv` |
| [Taxi zone shapefile](https://d37ci6vzurychx.cloudfront.net/misc/taxi_zones.zip) | Extract to `data/taxi_zones/` |

Keep the shapefile's `.shp`, `.dbf` and `.prj` files together as `taxi_zones.*`. The importer converts them to GeoJSON, or you can supply `data/taxi_zones.geojson`. Data paths are configurable in `.env`.

## Import and run

```powershell
npm run db:setup
npm run import:zones
npm run data:inspect
npm run import:trips
npm run db:verify
npm start
```

Open [localhost:3000](http://localhost:3000), or your configured port. Restart the server after backend or `.env` changes.

The trip import defaults to 5,000 rows. To change the source and limit:

```powershell
npm run import:trips -- data/yellow_tripdata_2019-01.parquet 10000
```

The selected rows are read into memory. Repeating a completed import reuses it; the API uses the latest completed import. Database setup does not migrate an older schema.

## Using the dashboard

Choose filters and press **Apply**. **Reset** restores the selected import with flagged trips excluded. Sorting and pagination affect the trip table while keeping the applied filters. See [API documentation](frontend/README.md) for endpoints and responses.

## Cleaning and features

The importer rejects invalid times, missing required values, negative amounts and unknown zones, and removes exact duplicates. It retains and flags unusual records, including outliers, zero distances and pickups outside the source month. Row-level audits are saved in `data/audits/`.

Derived features are trip duration, average speed and metered fare per mile. Zero-distance speed and fare ratios are null. Timestamps preserve NYC source-local clock values. The schema and feature view are in [database/schema.sql](database/schema.sql).

## Route ranking

`backend/top-routes.js` manually selects the best K routes by trip count, breaking ties by pickup ID, then dropoff ID:

```text
best = []
for each route:
    find its position in best
    if position is before K:
        insert route and keep at most K entries
return best
```

For G route groups, ranking takes O(G * K) time and O(K) extra space. The endpoint also holds O(G) input groups.

## Checks

```powershell
npm test
npm run test:api
```

Unit checks cover cleaning, derived features, validation and ranking. API checks require an imported database and free ports 31874/31875; they verify filtering, sorting, pagination and error handling.

For connection errors, check MySQL and `.env`. For missing data, check the file paths and complete the imports. If the server port is occupied, stop the previous server.
