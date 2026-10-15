function renderBarChart(id, points, unit, decimals) {
    const container = document.querySelector("#" + id);
    container.replaceChildren();
    let maximum = 0;
    let hasValues = false;
    for (const point of points) {
        if (point.value !== null && Number.isFinite(point.value)) {
            hasValues = true;
            maximum = Math.max(maximum, point.value);
        }
    }
    if (!hasValues) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No contributing trips for this measure.";
        container.append(empty);
        return;
    }
    const scale = document.createElement("p");
    scale.className = "chart-scale";
    scale.textContent = "Scale: 0" + maximum.toLocaleString("en-US", { maximumFractionDigits: decimals }) + " " + unit;
    const chart = document.createElement("div");
    chart.className = "bar-chart";
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const value = point.value === null ? "No data" : point.value.toLocaleString("en-US", { maximumFractionDigits: decimals });
        const column = document.createElement("div");
        column.className = "bar-column";
        column.title = point.label + ": " + value + " " + unit + "  " + point.count + " contributing trips";
        const track = document.createElement("div");
        track.className = "bar-track";
        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.height = maximum > 0 && point.value !== null ? Math.max(0, point.value / maximum * 100) + "%" : "0%";
        track.append(fill);
        const label = document.createElement("span");
        label.className = "bar-label";
        label.textContent = points.length <= 8 || index % 4 === 0 ? point.label : "";
        column.append(track, label);
        chart.append(column);
    }
    container.append(scale, chart);
}
