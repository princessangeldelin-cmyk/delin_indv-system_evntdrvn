import mysql from "mysql2/promise";
import { sequelize } from "./models/db.js";
import "./models/index.js";

const database = process.env.DB_NAME || "supplylink_delin";
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || ""
});

try {
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  console.log(`MySQL database "${database}" is ready.`);
  await sequelize.authenticate();
  await sequelize.sync();
  console.log("SupplyLink tables created or already up to date.");
} catch (error) {
  console.error("SupplyLink migration failed:", error);
  process.exitCode = 1;
} finally {
  await connection.end();
  await sequelize.close();
}
