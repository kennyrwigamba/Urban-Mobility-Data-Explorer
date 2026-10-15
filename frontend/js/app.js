const form = document.querySelector("#trip-filters");
const message = document.querySelector("#filter-message");
const sortSelect = document.querySelector("#trip-sort");

let filters = { includeFlagged: false };
let page = 1;
let totalPages = 0;
let loading = false;
let zonesLoaded = false;
let failed = false;
let statsLoaded = false;
const pageSize = 25;

function setText(id, text) {
    document.querySelector("#" + id).textContent = text;
}

function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "—";
    }
    return Number(value).toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
}

function getFilters() {
    return {
        dateFrom: document.querySelector("#date-from").value,
        dateTo: document.querySelector("#date-to").value,
        pickupZone: document.querySelector("#pickup-zone").value,
        dropoffZone: document.querySelector("#dropoff-zone").value,
        minDistance: document.querySelector("#min-distance").value,
        maxDistance: document.querySelector("#max-distance").value,
        minFare: document.querySelector("#min-fare").value,
        maxFare: document.querySelector("#max-fare").value,
        includeFlagged: document.querySelector("#include-flagged").checked
    };
}

function validateFilters(values) {
    if (values.dateFrom && values.dateTo && values.dateFrom > values.dateTo) {
        return "From date must be on or before To date.";
    }
    if (values.minDistance !== "" && values.maxDistance !== "" && Number(values.minDistance) > Number(values.maxDistance)) {
        return "Minimum distance must not exceed maximum distance.";
    }
    if (values.minFare !== "" && values.maxFare !== "" && Number(values.minFare) > Number(values.maxFare)) {
        return "Minimum fare must not exceed maximum fare.";
    }
    return "";
}

function buildUrl(path, parameters) {
    const query = new URLSearchParams();
    for (const name in parameters) {
        if (parameters[name] !== "" && parameters[name] !== undefined) {
            query.set(name, parameters[name]);
        }
    }
    return path + "?" + query.toString();
}

async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Data is unavailable. Apply filters to try again.");
    return response.json();
}

function emptyPanel(id, text) {
    const paragraph = document.createElement("p");
    paragraph.className = "empty-state";
    paragraph.textContent = text;
    document.querySelector("#" + id).replaceChildren(paragraph);
}

function emptyTable(text) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.className = "table-empty";
    cell.textContent = text;
    row.append(cell);
    document.querySelector("#trip-table-body").replaceChildren(row);
    setText("page-information", "No records displayed");
    totalPages = 0;
}

function setLoading(value) {
    loading = value;
    document.querySelector("#filter-fields").disabled = value;
    sortSelect.disabled = value || totalPages === 0;
    document.querySelector("#previous-page").disabled = value || page <= 1 || totalPages === 0;
    document.querySelector("#next-page").disabled = value || page >= totalPages;
}

async function loadZones() {
    if (zonesLoaded) return;
    try {
        const result = await fetchData("/api/zones");
        for (const id of ["pickup-zone", "dropoff-zone"]) {
            const select = document.querySelector("#" + id);
            select.replaceChildren(new Option("All zones", ""));
            for (const zone of result.data) select.add(new Option(zone.zoneName + " · " + zone.borough, zone.locationId));
            select.disabled = false;
        }
        zonesLoaded = true;
    } catch (error) {
        failed = true;
    }
}

function resetStats(text) {
    for (const id of ["trip-count", "average-duration", "average-fare"]) setText(id, "—");
    for (const id of ["dataset-period", "dataset-scope", "dataset-timezone", "dataset-quality"]) setText(id, "Not loaded");
    setText("duration-count", "Contributing trips unavailable");
    setText("fare-count", "Contributing trips unavailable");
    for (const id of ["pickup-chart", "duration-chart", "fare-chart"]) emptyPanel(id, text);
}

async function loadStats() {
    statsLoaded = false;
    resetStats("Loading…");
    try {
        const result = await fetchData(buildUrl("/api/stats", filters));
        const summary = result.data.summary;
        const dataset = result.meta.dataset;
        setText("trip-count", formatNumber(summary.tripCount));
        setText("average-duration", formatNumber(summary.averageDurationMinutes, 1));
        setText("average-fare", formatNumber(summary.averageFareAmount, 2));
        setText("duration-count", formatNumber(summary.durationCount) + " contributing trips");
        setText("fare-count", formatNumber(summary.fareCount) + " contributing trips");
        setText("dataset-period", dataset.periodStart.slice(0, 10) + " to " + dataset.periodEnd.slice(0, 10));
        setText("dataset-scope", dataset.scope);
        setText("dataset-timezone", dataset.timezone);
        setText("dataset-quality", formatNumber(dataset.acceptedFlagged) + " flagged · " + formatNumber(dataset.excluded) + " excluded");
        if (summary.tripCount === 0) {
            for (const id of ["pickup-chart", "duration-chart", "fare-chart"]) emptyPanel(id, "No trips match these filters.");
        } else {
            const pickups = [];
            const durations = [];
            for (let hour = 0; hour < 24; hour++) {
                const bucket = result.data.hourly.find(function (item) { return item.hour === hour; });
                const label = String(hour).padStart(2, "0");
                pickups.push({ label, value: bucket ? bucket.tripCount : 0, count: bucket ? bucket.tripCount : 0 });
                durations.push({ label, value: bucket ? bucket.averageDurationMinutes : null, count: bucket ? bucket.durationCount : 0 });
            }
            const fares = result.data.fareDistance.map(function (band) {
                return { label: band.label, value: band.averageFarePerMile, count: band.eligibleCount };
            });
            renderBarChart("pickup-chart", pickups, "trips", 0);
            renderBarChart("duration-chart", durations, "minutes", 1);
            renderBarChart("fare-chart", fares, "USD / mile", 2);
        }
        statsLoaded = true;
    } catch (error) {
        failed = true;
        resetStats("Summary data is unavailable.");
    }
}

async function loadTrips() {
    emptyTable("Loading trips…");
    try {
        const sort = sortSelect.value.split(":");
        const result = await fetchData(buildUrl("/api/trips", {
            ...filters, page, pageSize, sortBy: sort[0], sortOrder: sort[1]
        }));
        if (result.data.length === 0) {
            emptyTable("No trips match these filters.");
            return;
        }
        const body = document.querySelector("#trip-table-body");
        body.replaceChildren();
        for (const trip of result.data) {
            const row = document.createElement("tr");
            const values = [
                trip.pickupDatetime, trip.pickupZoneName, trip.dropoffZoneName,
                formatNumber(trip.tripDistance, 2), formatNumber(trip.durationMinutes, 1),
                formatNumber(trip.speedMph, 1), formatNumber(trip.fareAmount, 2), formatNumber(trip.farePerMile, 2)
            ];
            for (let index = 0; index < values.length; index++) {
                const cell = document.createElement("td");
                cell.textContent = values[index] ?? "—";
                if (index >= 3) cell.className = "numeric";
                row.append(cell);
            }
            if (trip.isFlagged) {
                const flag = document.createElement("span");
                flag.className = "flag-label";
                flag.textContent = "Flagged";
                row.firstChild.append(flag);
            }
            body.append(row);
        }
        totalPages = result.meta.totalPages;
        const first = (page - 1) * pageSize + 1;
        const last = first + result.data.length - 1;
        setText("page-information", formatNumber(first) + "–" + formatNumber(last) + " of " + formatNumber(result.meta.totalRows) + " · Page " + page + " of " + totalPages);
    } catch (error) {
        failed = true;
        emptyTable("Trip data is unavailable.");
    }
}

async function loadRoutes() {
    emptyPanel("top-routes", "Loading routes…");
    try {
        const result = await fetchData(buildUrl("/api/routes/top", { ...filters, k: 5 }));
        if (result.data.length === 0) {
            emptyPanel("top-routes", "No routes match these filters.");
            return;
        }
        const list = document.createElement("ol");
        list.className = "route-list";
        for (const route of result.data) {
            const item = document.createElement("li");
            const content = document.createElement("div");
            content.className = "route-item";
            const name = document.createElement("span");
            name.textContent = route.pickupZoneName + " → " + route.dropoffZoneName;
            const count = document.createElement("strong");
            count.textContent = formatNumber(route.tripCount) + " trips";
            content.append(name, count);
            item.append(content);
            list.append(item);
        }
        document.querySelector("#top-routes").replaceChildren(list);
    } catch (error) {
        failed = true;
        emptyPanel("top-routes", "Route data is unavailable.");
    }
}

async function loadDashboard() {
    if (loading) return;
    failed = false;
    setLoading(true);
    setText("dataset-status", "Loading");
    showMessage("Loading the dashboard…");
    await Promise.all([loadZones(), loadStats(), loadTrips(), loadRoutes()]);
    let status = "Data unavailable";
    if (statsLoaded) status = failed ? "Some data unavailable" : "Data loaded";
    setText("dataset-status", status);
    showMessage(failed ? "Some data is unavailable. Apply filters to try again." : "Dashboard updated for the applied filters.", failed);
    setLoading(false);
}

async function changeTripPage() {
    if (loading) return;
    failed = false;
    setLoading(true);
    await loadTrips();
    showMessage(failed ? "Trip data is unavailable. Apply filters to try again." : "Trip records updated using the last applied filters.", failed);
    setLoading(false);
}

form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (loading || !form.reportValidity()) return;
    const values = getFilters();
    const error = validateFilters(values);
    if (error) {
        showMessage(error + " Displayed results have not changed.", true);
        return;
    }
    filters = values;
    page = 1;
    loadDashboard();
});

form.addEventListener("reset", function () {
    if (loading) return;
    filters = { includeFlagged: false };
    page = 1;
    sortSelect.value = "pickupDatetime:desc";
    loadDashboard();
});

form.addEventListener("input", function () {
    if (!loading) showMessage("Filter changes are not applied yet. Choose Apply filters to update the results.");
});

sortSelect.addEventListener("change", function () {
    page = 1;
    changeTripPage();
});

document.querySelector("#previous-page").addEventListener("click", function () {
    if (page > 1 && !loading) {
        page--;
        changeTripPage();
    }
});

document.querySelector("#next-page").addEventListener("click", function () {
    if (page < totalPages && !loading) {
        page++;
        changeTripPage();
    }
});

loadDashboard();
