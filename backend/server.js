
const express = require("express");
const path = require("path");
require("dotenv").config({ quiet: true });
const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

const frontendPath = path.join(__dirname, "..", "frontend");

app.use(express.static(frontendPath));
app.get("/favicon.ico", function (req, res) { res.status(204).end(); });

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Urban Mobility Data Explorer API is running"
    });
});

app.use("/api", routes);
app.use("/api", function (req, res) {
    res.status(404).json({ error: { message: "API endpoint not found." } });
});
app.use(function (error, req, res, next) {
    console.error(error.message);
    const databaseErrors = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR", "ER_NO_SUCH_TABLE"];
    const status = error.status || (databaseErrors.includes(error.code) ? 503 : 500);
    let message = error.message;
    if (!error.status) message = status === 503 ? "Database unavailable. Check configuration and run setup/import commands." : "The request could not be completed.";
    res.status(status).json({ error: { message } });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
