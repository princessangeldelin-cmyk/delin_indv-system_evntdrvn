import { Sequelize } from "sequelize";

const database = process.env.DB_NAME || "supplylink_delin";
if (!/^[a-zA-Z0-9_]+$/.test(database)) {
  throw new Error("DB_NAME may contain only letters, numbers, and underscores.");
}

export const sequelize = new Sequelize(
  database,
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    dialect: "mysql",
    logging: false
  }
);
