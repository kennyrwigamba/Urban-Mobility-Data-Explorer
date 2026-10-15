const { normalizeTimestamp } = require("./features");

function badRequest(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function integerParameter(query, name, fallback, maximum) {
    if (query[name] === undefined) return fallback;
    const value = Number(query[name]);
    if (typeof query[name] !== "string" || !/^\d+$/.test(query[name]) || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
        throw badRequest(name + " must be an integer from 1 to " + maximum + ".");
    }
    return value;
}

function parseFilters(query, importId, zoneIds, extraNames = []) {
    const names = ["dateFrom", "dateTo", "pickupZone", "dropoffZone", "minDistance", "maxDistance", "minFare", "maxFare", "includeFlagged"];
    for (const name in query) {
        if (!names.includes(name) && !extraNames.includes(name)) throw badRequest("Unknown parameter: " + name);
        if (typeof query[name] !== "string") throw badRequest("Use one value for " + name + ".");
    }
    const filters = {};
    const conditions = ["t.import_id = ?"];
    const values = [importId];
    for (const name of ["dateFrom", "dateTo"]) {
        if (!query[name]) continue;
        if (!normalizeTimestamp(query[name] + " 00:00:00") || Number(query[name].slice(0, 4)) < 1000) {
            throw badRequest(name + " must be a valid YYYY-MM-DD date.");
        }
        filters[name] = query[name];
        conditions.push(name === "dateFrom" ? "t.pickup_datetime >= ?" : "t.pickup_datetime <= ?");
        values.push(query[name] + (name === "dateFrom" ? " 00:00:00" : " 23:59:59"));
    }
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) throw badRequest("From date must be on or before To date.");

    for (const name of ["pickupZone", "dropoffZone"]) {
        if (!query[name]) continue;
        const id = integerParameter(query, name, null, 2147483647);
        if (!zoneIds.has(id)) throw badRequest("Unknown zone: " + id);
        filters[name] = id;
        conditions.push(name === "pickupZone" ? "t.pickup_zone_id = ?" : "t.dropoff_zone_id = ?");
        values.push(id);
    }
    const bounds = {
        minDistance: "t.trip_distance >= ?", maxDistance: "t.trip_distance <= ?",
        minFare: "t.fare_amount >= ?", maxFare: "t.fare_amount <= ?"
    };
    for (const name in bounds) {
        if (query[name] === undefined || query[name] === "") continue;
        const value = Number(query[name]);
        if (!Number.isFinite(value) || value < 0 || query[name].trim() === "") throw badRequest(name + " must be a nonnegative number.");
        filters[name] = value;
        conditions.push(bounds[name]);
        values.push(value);
    }
    if (filters.minDistance !== undefined && filters.maxDistance !== undefined && filters.minDistance > filters.maxDistance) throw badRequest("Minimum distance exceeds maximum distance.");
    if (filters.minFare !== undefined && filters.maxFare !== undefined && filters.minFare > filters.maxFare) throw badRequest("Minimum fare exceeds maximum fare.");
    if (query.includeFlagged !== undefined && !["true", "false"].includes(query.includeFlagged)) throw badRequest("includeFlagged must be true or false.");
    filters.includeFlagged = query.includeFlagged === "true";
    if (!filters.includeFlagged) conditions.push("t.is_flagged = 0");
    return { where: conditions.join(" AND "), values, filters };
}

module.exports = { badRequest, integerParameter, parseFilters };
