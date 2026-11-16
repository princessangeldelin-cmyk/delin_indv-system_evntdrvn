import { User } from "./userModel.js";
import { Supplier } from "./supplierModel.js";
import { Product } from "./productModel.js";
import { PurchaseOrder } from "./purchaseOrderModel.js";
import { OrderItem } from "./orderItemModel.js";

Supplier.hasMany(Product, { foreignKey: { name: "supplierId", allowNull: true }, onDelete: "RESTRICT" });
Product.belongsTo(Supplier, { foreignKey: "supplierId" });

User.hasMany(PurchaseOrder, { foreignKey: { name: "createdById", allowNull: false }, onDelete: "RESTRICT" });
PurchaseOrder.belongsTo(User, { as: "creator", foreignKey: "createdById" });
Supplier.hasMany(PurchaseOrder, { foreignKey: { name: "supplierId", allowNull: false }, onDelete: "RESTRICT" });
PurchaseOrder.belongsTo(Supplier, { foreignKey: "supplierId" });

PurchaseOrder.hasMany(OrderItem, { as: "items", foreignKey: { name: "purchaseOrderId", allowNull: false }, onDelete: "CASCADE" });
OrderItem.belongsTo(PurchaseOrder, { foreignKey: "purchaseOrderId" });
Product.hasMany(OrderItem, { foreignKey: { name: "productId", allowNull: false }, onDelete: "RESTRICT" });
OrderItem.belongsTo(Product, { foreignKey: "productId" });

export { User, Supplier, Product, PurchaseOrder, OrderItem };
