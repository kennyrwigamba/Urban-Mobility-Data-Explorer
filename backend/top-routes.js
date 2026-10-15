function betterRoute(first, second) {
    if (first.tripCount !== second.tripCount) return first.tripCount > second.tripCount;
    if (first.pickupLocationId !== second.pickupLocationId) return first.pickupLocationId < second.pickupLocationId;
    return first.dropoffLocationId < second.dropoffLocationId;
}

function findTopRoutes(routes, k) {
    if (!Number.isInteger(k) || k < 0) throw new Error("k must be a nonnegative integer.");
    const best = [];
    for (const route of routes) {
        let position = 0;
        while (position < best.length && !betterRoute(route, best[position])) position++;
        if (position >= k) continue;
        const length = Math.min(best.length + 1, k);
        for (let index = length - 1; index > position; index--) best[index] = best[index - 1];
        best[position] = route;
    }
    return best;
}

module.exports = { findTopRoutes };
