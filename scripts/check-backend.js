const assert = require("assert/strict");
const { findTopRoutes } = require("../backend/top-routes");
const { parseFilters, integerParameter } = require("../backend/filters");

const routes = [
    { pickupLocationId: 2, dropoffLocationId: 4, tripCount: 8 },
    { pickupLocationId: 1, dropoffLocationId: 3, tripCount: 8 },
    { pickupLocationId: 1, dropoffLocationId: 2, tripCount: 8 },
    { pickupLocationId: 3, dropoffLocationId: 1, tripCount: 20 },
    { pickupLocationId: 4, dropoffLocationId: 1, tripCount: 1 }
];
const expected = [routes[3], routes[2], routes[1], routes[0], routes[4]];
const original = JSON.stringify(routes);
assert.deepEqual(findTopRoutes(routes, 3), expected.slice(0, 3));
assert.deepEqual(findTopRoutes([...routes].reverse(), 3), expected.slice(0, 3));
assert.deepEqual(findTopRoutes(routes, 20), expected);
assert.deepEqual(findTopRoutes(routes, 1), [routes[3]]);
assert.deepEqual(findTopRoutes(routes, 0), []);
assert.deepEqual(findTopRoutes([], 5), []);
assert.throws(function () { findTopRoutes(routes, -1); });
assert.throws(function () { findTopRoutes(routes, 1.5); });
assert.equal(JSON.stringify(routes), original);
console.log("PASS manual ranking, both tie rules, late replacement, empty input and unchanged inputs");

const groups = [];
for (let index = 0; index < 100; index++) {
    groups.push({ pickupLocationId: index % 10, dropoffLocationId: Math.floor(index / 10), tripCount: index * 7 % 23 });
}
const sorted = [...groups].sort(function (a, b) {
    return b.tripCount - a.tripCount || a.pickupLocationId - b.pickupLocationId || a.dropoffLocationId - b.dropoffLocationId;
});
for (let k = 0; k <= 20; k++) assert.deepEqual(findTopRoutes(groups, k), sorted.slice(0, k));
console.log("PASS ranking against an independent reference for 21 limits");

const zones = new Set([1, 151, 239, 264, 265]);
const selected = parseFilters({ dateFrom: "2019-01-01", dateTo: "2019-01-01", pickupZone: "151", minDistance: "0", maxFare: "7.5" }, 2, zones);
assert(selected.where.includes("t.import_id = ?"));
assert(selected.where.includes("t.is_flagged = 0"));
assert.deepEqual(selected.values, [2, "2019-01-01 00:00:00", "2019-01-01 23:59:59", 151, 0, 7.5]);
assert(!parseFilters({ includeFlagged: "true" }, 2, zones).where.includes("t.is_flagged = 0"));
for (const query of [
    { dateFrom: "2019-02-30" }, { dateFrom: "2019-01-02", dateTo: "2019-01-01" },
    { pickupZone: "999" }, { pickupZone: "1 OR 1=1" }, { minDistance: "-1" },
    { minFare: "Infinity" }, { minFare: "abc" }, { minDistance: "3", maxDistance: "2" },
    { minFare: "5", maxFare: "1" }, { includeFlagged: "yes" }, { extra: "unknown" },
    { dateFrom: ["2019-01-01", "2019-01-02"] }
]) {
    assert.throws(function () { parseFilters(query, 2, zones); }, function (error) { return error.status === 400; });
}
assert.equal(integerParameter({}, "page", 1, 100), 1);
assert.equal(integerParameter({ page: "2" }, "page", 1, 100), 2);
for (const page of ["0", "-1", "1.5", "101", "NaN", "1e2"]) {
    assert.throws(function () { integerParameter({ page }, "page", 1, 100); });
}
console.log("PASS filter values, date boundaries, input validation and parameterized conditions");
