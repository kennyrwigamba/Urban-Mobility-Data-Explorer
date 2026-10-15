const { gunzipSync } = require("zlib");

async function readTrips(fileName, limit) {
    const { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects } = await import("hyparquet");
    const file = await asyncBufferFromFile(fileName);
    const metadata = await parquetMetadataAsync(file);
    const totalRows = Number(metadata.num_rows);
    const rows = await parquetReadObjects({
        file,
        rowEnd: Math.min(limit, totalRows),
        compressors: {
            GZIP: function (bytes) { return gunzipSync(bytes); }
        }
    });
    return { rows, totalRows, columns: metadata.schema.slice(1).map(function (column) { return column.name; }) };
}

module.exports = { readTrips };
