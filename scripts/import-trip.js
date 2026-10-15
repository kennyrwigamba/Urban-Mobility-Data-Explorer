const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("../backend/db");
const { readTrips } = require("./read-trips");
const { cleanTrip } = require("./clean-trips");

async function checksumOf(fileName) {
    const hash = crypto.createHash("sha256");
    for await (const chunk of fs.createReadStream(fileName)) hash.update(chunk);
    return hash.digest("hex");
}

async function importTrips() {
    let connection;
    let importId;
    try {
        const fileName = process.argv[2] || process.env.TRIP_PARQUET || "data/yellow_tripdata_2019-01.parquet";
        const limit = Number(process.argv[3] || 5000);
        if (!Number.isInteger(limit) || limit < 1) throw new Error("The row limit must be a positive integer.");
        const source = await readTrips(fileName, limit);
        const monthMatch = path.basename(fileName).match(/(\d{4}-\d{2})\.parquet$/);
        const sourceMonth = monthMatch ? monthMatch[1] : null;
        const scope = "First " + source.rows.length + " rows";
        const checksum = await checksumOf(fileName);
        connection = await pool.getConnection();
        const [existing] = await connection.execute(
            "SELECT id FROM data_imports WHERE checksum=? AND scope=? AND cleaning_version='v3' AND status='complete' LIMIT 1",
            [checksum, scope]
        );
        if (existing.length) {
            console.log("Already imported: " + existing[0].id + ". No rows added.");
            return;
        }
        const [zones] = await connection.query("SELECT location_id FROM taxi_zones");
        if (zones.length === 0) throw new Error("Import taxi zones before importing trips.");
        const zoneIds = new Set(zones.map(function (zone) { return zone.location_id; }));
        const [created] = await connection.execute(
            "INSERT INTO data_imports (source_name, checksum, scope, cleaning_version, status, started_at) VALUES (?, ?, ?, 'v3', 'running', NOW())",
            [path.basename(fileName), checksum, scope]
        );
        importId = created.insertId;
        fs.mkdirSync("data/audits", { recursive: true });
        const auditFile = "data/audits/import-" + importId + ".csv";
        fs.writeFileSync(auditFile, "source_row,status,reason\n");

        let normal = 0;
        let flagged = 0;
        let excluded = 0;
        let periodStart = null;
        let periodEnd = null;
        await connection.beginTransaction();
        for (let index = 0; index < source.rows.length; index++) {
            const result = cleanTrip(source.rows[index], zoneIds, sourceMonth);
            let reason = result.reason;
            let status = result.status;
            if (status !== "reject") {
                const record = {
                    import_id: importId,
                    ...result.trip,
                    fingerprint: result.fingerprint,
                    is_flagged: status === "flag" ? 1 : 0,
                    flag_reason: reason || null
                };
                try {
                    await connection.query("INSERT INTO trips SET ?", record);
                    if (status === "flag") flagged++;
                    else normal++;
                    const pickup = result.trip.pickup_datetime;
                    if (periodStart === null || pickup < periodStart) periodStart = pickup;
                    if (periodEnd === null || pickup > periodEnd) periodEnd = pickup;
                } catch (error) {
                    if (error.code !== "ER_DUP_ENTRY") throw error;
                    status = "reject";
                    reason = "duplicate";
                }
            }
            if (status === "reject") excluded++;
            if (status !== "accept") {
                fs.appendFileSync(auditFile, (index + 1) + "," + (status === "reject" ? "excluded" : "flagged") + "," + reason + "\n");
            }
        }
        if (normal + flagged === 0) throw new Error("No usable trips were found. Check the audit log.");
        await connection.execute(
            "UPDATE data_imports SET status='complete', rows_read=?, accepted_normal=?, accepted_flagged=?, excluded=?, period_start=?, period_end=?, finished_at=NOW() WHERE id=?",
            [source.rows.length, normal, flagged, excluded, periodStart, periodEnd, importId]
        );
        await connection.commit();
        console.log(JSON.stringify({ importId, sourceRows: source.totalRows, rowsRead: source.rows.length, normal, flagged, excluded, periodStart, periodEnd, auditFile }, null, 2));
    } catch (error) {
        if (connection) await connection.rollback();
        if (importId) await connection.execute("UPDATE data_imports SET status='failed', finished_at=NOW() WHERE id=?", [importId]);
        throw error;
    } finally {
        if (connection) connection.release();
        await pool.end();
    }
}

importTrips().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
});
