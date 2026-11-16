import { Op } from "sequelize";
import { Product, PurchaseOrder, Supplier } from "../models/index.js";

export const dashboardPage = async (req, res, next) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [supplierCount, productCount, orderCount, products, recentOrders, pendingApprovalCount, openDeliveryCount, monthOrders] = await Promise.all([
      Supplier.count(),
      Product.count(),
      PurchaseOrder.count(),
      Product.findAll({
        include: [{ model: Supplier, attributes: ["name"] }],
        order: [["stockQuantity", "ASC"]]
      }),
      PurchaseOrder.findAll({
        include: [{ model: Supplier, attributes: ["name"] }],
        order: [["createdAt", "DESC"]],
        limit: 5
      }),
      PurchaseOrder.count({ where: { status: "Pending approval" } }),
      PurchaseOrder.count({ where: { status: { [Op.in]: ["Approved", "Partially received"] } } }),
      PurchaseOrder.findAll({
        attributes: ["totalAmount"],
        where: { createdAt: { [Op.gte]: monthStart } }
      })
    ]);
    const lowStock = products
      .filter(product => product.stockQuantity < product.minimumStock)
      .map(product => ({
        ...product.get({ plain: true }),
        recommendedQuantity: product.minimumStock - product.stockQuantity
      }));
    res.render("dashboard", {
      title: "Dashboard",
      activePage: "dashboard",
      supplierCount,
      productCount,
      orderCount,
      pendingApprovalCount,
      openDeliveryCount,
      monthSpend: monthOrders.reduce((total, order) => total + Number(order.totalAmount), 0).toFixed(2),
      lowStockCount: lowStock.length,
      lowStockProducts: lowStock.slice(0, 6),
      recentOrders
    });
  } catch (error) {
    next(error);
  }
};
