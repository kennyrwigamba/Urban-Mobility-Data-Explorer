function getArgs(){
    return {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || 'mobility'
    };
}

async function setupDb(){
    const cfg = getArgs();
    const conn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database
    });
}
await conn.query("CREATE DATABASE IF NOT EXISTS `" + cfg.database +"`");
await conn.end();

const pool = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    multipleStatements: true
});

const sqlPath = path.join(__dirname,",,","database","schema.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
await pool.query(sql);
await pool.end();
console.log("Database setup completed successfully." + cfg.database);

setupDb().catch(function (err){
    console.error(err.message);
    process.exit(1);
})