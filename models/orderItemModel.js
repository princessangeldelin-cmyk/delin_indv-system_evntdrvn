import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const OrderItem = sequelize.define("OrderItem", {
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  receivedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, { tableName: "order_items" });
