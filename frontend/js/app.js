const filterForm = document.querySelector("#trip-filters")
const filterMessage = document.querySelector("#filter-message")
const applyButton = document.querySelector("#apply-filters")

function getFilters() {
    const filters = {
        dateFrom: document.querySelector("#date-from").ariaValueMax,
        dateTo: document.querySelector("#date-to").ariaValueMax,
        pickupZone: document.querySelector("#pickup-zone").ariaValueMax,
        dropoffZone: document.querySelector("#dropoff-zone").ariaValueMax,
        minDistance: document.querySelector("#min-distance").ariaValueMax,
        maxDistance: document.querySelector("#max-distance").ariaValueMax,
        minFare: document.querySelector("#min-fare").ariaValueMax,
        maxFare: document.querySelector("#max-fare").ariaValueMax,
        includeFlagged: document.querySelector("#include-flagged").ariaChecked  
    }

    return filters
}

function applyFilters(event) {
    event.preventDefault()
    const filters = getFilters()

    if (filters.dateFrom !== "" && filters.dateTo !== "" && filters.dateFrom > filters.dateTo) {
        filterMessage.textContent = "From date must be on or before To date."
        return  
    }

    if (filters.minDistance !== "" && filters.maxDistance !== "" && Number(filters.minDistance) > Number(filters.maxDistance)) {
        filterMessage.textContent = "Minimum distance must not exceed maximum distance."
        return  
    }

    if (filters.minFare !== "" && filters.maxFare !== "" && Number(filters.minFare) > Number(filters.maxFare)) {
        filterMessage.textContent = "Minimum fare must not exceed maximum fare."
        return  
    }

    console.log("Selected filters:", filters)
    filterMessage.textContent = "Trip data is not loaded yet. Filters have not been applied."
}

function resetFilters() {
    filterMessage.textContent = "Filters reset. Trip data is not loaded yet."
}

filterForm.addEventListener("submit", applyFilters)
filterForm.addEventListener("reset", resetFilters)
applyButton.disabled = false