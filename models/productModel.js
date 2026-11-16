import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Product = sequelize.define("Product", {
  name: { type: DataTypes.STRING(160), allowNull: false },
  sku: { type: DataTypes.STRING(80), allowNull: true, unique: true },
  unit: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "each" },
  stockQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  minimumStock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 }
}, { tableName: "products" });
