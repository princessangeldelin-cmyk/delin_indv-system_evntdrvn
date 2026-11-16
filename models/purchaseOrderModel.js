import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const PurchaseOrder = sequelize.define("PurchaseOrder", {
  orderNumber: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  status: {
    type: DataTypes.ENUM("Pending approval", "Approved", "Partially received", "Received"),
    allowNull: false,
    defaultValue: "Pending approval"
  },
  totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }
}, { tableName: "purchase_orders" });
