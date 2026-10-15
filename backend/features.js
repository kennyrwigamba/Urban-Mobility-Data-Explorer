function normalizeTimestamp(value) {
    if (value instanceof Date) {
        if (!Number.isFinite(value.getTime())) return null;
        return value.toISOString().slice(0, 19).replace("T", " ");
    }
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return null;
    const date = new Date(text.replace(" ", "T") + "Z");
    if (!Number.isFinite(date.getTime())) return null;
    if (date.toISOString().slice(0, 19).replace("T", " ") !== text) return null;
    return text;
}

function toSeconds(pickup, dropoff) {
    const start = normalizeTimestamp(pickup);
    const end = normalizeTimestamp(dropoff);
    if (start === null || end === null) return null;
    return (Date.parse(end.replace(" ", "T") + "Z") - Date.parse(start.replace(" ", "T") + "Z")) / 1000;
}

function getDurationMinutes(pickup, dropoff) {
    const seconds = toSeconds(pickup, dropoff);
    if (seconds === null || seconds <= 0) return null;
    return seconds / 60;
}

function getSpeedMph(distance, pickup, dropoff) {
    const seconds = toSeconds(pickup, dropoff);
    const miles = Number(distance);
    if (seconds === null || seconds <= 0 || !Number.isFinite(miles) || miles <= 0) return null;
    return miles * 3600 / seconds;
}

function getFarePerMile(fare, distance) {
    if (fare === null || fare === undefined || fare === "") return null;
    const amount = Number(fare);
    const miles = Number(distance);
    if (!Number.isFinite(amount) || !Number.isFinite(miles) || miles <= 0 || amount < 0) return null;
    return amount / miles;
}

module.exports = { normalizeTimestamp, toSeconds, getDurationMinutes, getSpeedMph, getFarePerMile };
