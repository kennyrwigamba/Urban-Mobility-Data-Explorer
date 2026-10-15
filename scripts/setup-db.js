const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

async function setupDb() {
    const database = process.env.DB_NAME || "mobility";
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        multipleStatements: true
    });
    try {
        await connection.query("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4", [database]);
        await connection.query("USE ??", [database]);
        const sql = fs.readFileSync(path.join(__dirname, "..", "database", "schema.sql"), "utf8");
        await connection.query(sql);
        console.log("Database ready: " + database);
    } finally {
        await connection.end();
    }
}

setupDb().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
});
