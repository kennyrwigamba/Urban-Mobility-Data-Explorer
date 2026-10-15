function toSeconds(pickup, dropoff) {
    const start = new Date(pickup);
    const end = new Date(dropoff);
    const startTime = start.getTime();
    const endTime = end.getTime();
    if (isNaN(startTime) || isNaN(endTime)){
        return null;
    }
    return Math.round((endTime - startTime)/1000);
}

function getDurationMinutes(pickup, dropoff){
    const seconds = toSeconds(pickup,dropoff);
    if (seconds === null || seconds <= 0){
        return null;
    }
    return seconds / 60;
}

function getSpeedMph(distance, pickup,dropoff){
    const seconds = toSeconds(pickup,dropoff);
    const miles = Number(distance);
    if (seconds === null || seconds <= 0){
        return null;
    }
    if (isNaN(miles) || miles <= 0) {
        return null;
    }
    return (miles * 3600) / seconds;
}

function getFarePerMile(fare,distance){
    const fareNum = Number(fare);
    const miles = Number(distance);
    if (isNaN(fareNum) || isNaN(miles)){
        return null;
    }
    if (miles <= 0){
        return null;
    }
    return fareNum / miles;
}

module.exports = {
    toSeconds,
    getDurationMinutes,
    getSpeedMph,
    getFarePerMile
};
