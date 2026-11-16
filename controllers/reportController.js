import { Op } from "sequelize";
import { PurchaseOrder, Supplier } from "../models/index.js";

const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const getDateRange = (query) => {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const from = query.from || defaultFrom;
  const to = query.to || today;

  if (!validDate(from) || !validDate(to) || from > to) {
    return { error: "Choose valid dates and make sure the start date is not after the end date." };
  }

  return {
    from,
    to,
    start: new Date(`${from}T00:00:00.000Z`),
    end: new Date(`${to}T23:59:59.999Z`)
  };
};

const getOrdersForRange = (range) => PurchaseOrder.findAll({
  where: { createdAt: { [Op.between]: [range.start, range.end] } },
  include: [{ model: Supplier, attributes: ["id", "name"] }],
  order: [["createdAt", "DESC"]]
});

export const reportsPage = async (req, res, next) => {
  try {
    const range = getDateRange(req.query);
    if (range.error) {
      req.flash("error_msg", range.error);
      return res.redirect("/reports");
    }

    const orders = await getOrdersForRange(range);
    const summary = {
      orderCount: orders.length,
      spend: orders.reduce((total, order) => total + Number(order.totalAmount), 0),
      pendingCount: orders.filter(order => order.status === "Pending approval").length,
      receivedCount: orders.filter(order => order.status === "Received").length
    };

    const supplierTotals = new Map();
    for (const order of orders) {
      const current = supplierTotals.get(order.supplierId) || {
        name: order.Supplier.name,
        orderCount: 0,
        spend: 0
      };
      current.orderCount += 1;
      current.spend += Number(order.totalAmount);
      supplierTotals.set(order.supplierId, current);
    }

    const suppliers = [...supplierTotals.values()].sort((left, right) => right.spend - left.spend);
    const largestSpend = suppliers[0]?.spend || 1;
    for (const supplier of suppliers) {
      supplier.sharePercent = Math.max(3, Math.round(supplier.spend / largestSpend * 100));
    }

    res.render("reports", {
      title: "Purchasing reports",
      activePage: "reports",
      from: range.from,
      to: range.to,
      summary,
      suppliers,
      orders
    });
  } catch (error) {
    next(error);
  }
};

const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportPurchaseOrders = async (req, res, next) => {
  try {
    const range = getDateRange(req.query);
    if (range.error) {
      req.flash("error_msg", range.error);
      return res.redirect("/reports");
    }
    const orders = await getOrdersForRange(range);
    const rows = [
      ["Order number", "Date", "Supplier", "Status", "Total"],
      ...orders.map(order => [
        order.orderNumber,
        order.createdAt.toISOString(),
        order.Supplier.name,
        order.status,
        Number(order.totalAmount).toFixed(2)
      ])
    ];
    const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="supplylink-purchases-${range.from}-to-${range.to}.csv"`
    });
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    next(error);
  }
};
