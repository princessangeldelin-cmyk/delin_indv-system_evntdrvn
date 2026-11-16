import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Supplier = sequelize.define("Supplier", {
  name: { type: DataTypes.STRING(160), allowNull: false },
  contactName: { type: DataTypes.STRING(120), allowNull: true },
  email: { type: DataTypes.STRING(190), allowNull: true },
  phone: { type: DataTypes.STRING(40), allowNull: true },
  address: { type: DataTypes.STRING(255), allowNull: true }
}, { tableName: "suppliers" });
