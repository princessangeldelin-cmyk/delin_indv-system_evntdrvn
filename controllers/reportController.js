import { Op } from "sequelize";
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import PDFDocument from "pdfkit";
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

const summarizeOrders = (orders) => {
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
  return { summary, suppliers };
};

const getReportData = async (query) => {
  const range = getDateRange(query);
  if (range.error) return range;
  const orders = await getOrdersForRange(range);
  return { range, orders, ...summarizeOrders(orders) };
};

const getReportOrRedirect = async (req, res) => {
  const report = await getReportData(req.query);
  if (report.error) {
    req.flash("error_msg", report.error);
    res.redirect("/reports");
    return null;
  }
  return report;
};

export const reportsPage = async (req, res, next) => {
  try {
    const report = await getReportData(req.query);
    if (report.error) {
      req.flash("error_msg", report.error);
      return res.redirect("/reports");
    }

    res.render("reports", {
      title: "Purchasing reports",
      activePage: "reports",
      from: report.range.from,
      to: report.range.to,
      summary: report.summary,
      suppliers: report.suppliers,
      orders: report.orders
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
    const report = await getReportOrRedirect(req, res);
    if (!report) return;
    const rows = [
      ["Order number", "Date", "Supplier", "Status", "Total"],
      ...report.orders.map(order => [
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
      "Content-Disposition": `attachment; filename="supplylink-purchases-${report.range.from}-to-${report.range.to}.csv"`
    });
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    next(error);
  }
};

export const exportPurchaseOrdersWord = async (req, res, next) => {
  try {
    const report = await getReportOrRedirect(req, res);
    if (!report) return;
    const children = [
      new Paragraph({ text: "SupplyLink Purchasing Report", heading: HeadingLevel.TITLE }),
      new Paragraph({ text: `Report period: ${report.range.from} to ${report.range.to}` }),
      new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: `Orders: ${report.summary.orderCount}` }),
      new Paragraph({ text: `Purchasing total: $${report.summary.spend.toFixed(2)}` }),
      new Paragraph({ text: `Pending approval: ${report.summary.pendingCount}` }),
      new Paragraph({ text: `Received orders: ${report.summary.receivedCount}` }),
      new Paragraph({ text: "Spend by supplier", heading: HeadingLevel.HEADING_1 })
    ];
    children.push(...(report.suppliers.length
      ? report.suppliers.map(supplier => new Paragraph({
        text: `${supplier.name} - ${supplier.orderCount} orders - $${supplier.spend.toFixed(2)}`
      }))
      : [new Paragraph({ text: "No purchasing activity in this period." })]));
    children.push(new Paragraph({ text: "Purchase orders", heading: HeadingLevel.HEADING_1 }));
    children.push(...(report.orders.length
      ? report.orders.map(order => new Paragraph({
        text: `${order.orderNumber} | ${order.createdAt.toISOString().slice(0, 10)} | ${order.Supplier.name} | ${order.status} | $${Number(order.totalAmount).toFixed(2)}`
      }))
      : [new Paragraph({ text: "No purchase orders in this period." })]));

    const document = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(document);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="supplylink-purchases-${report.range.from}-to-${report.range.to}.docx"`
    });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const createPdfReport = (report) => new Promise((resolve, reject) => {
  const document = new PDFDocument({ size: "A4", margin: 48 });
  const chunks = [];
  document.on("data", chunk => chunks.push(chunk));
  document.on("end", () => resolve(Buffer.concat(chunks)));
  document.on("error", reject);

  document.fontSize(20).font("Helvetica-Bold").text("SupplyLink Purchasing Report");
  document.moveDown(0.4).fontSize(10).font("Helvetica").text(`Report period: ${report.range.from} to ${report.range.to}`);
  document.moveDown().fontSize(14).font("Helvetica-Bold").text("Summary");
  document.moveDown(0.3).fontSize(10).font("Helvetica")
    .text(`Orders: ${report.summary.orderCount}`)
    .text(`Purchasing total: $${report.summary.spend.toFixed(2)}`)
    .text(`Pending approval: ${report.summary.pendingCount}`)
    .text(`Received orders: ${report.summary.receivedCount}`);

  document.moveDown().fontSize(14).font("Helvetica-Bold").text("Spend by supplier");
  document.moveDown(0.3).fontSize(10).font("Helvetica");
  if (report.suppliers.length) {
    for (const supplier of report.suppliers) {
      document.text(`${supplier.name} - ${supplier.orderCount} orders - $${supplier.spend.toFixed(2)}`);
    }
  } else {
    document.text("No purchasing activity in this period.");
  }

  document.moveDown().fontSize(14).font("Helvetica-Bold").text("Purchase orders");
  document.moveDown(0.3).fontSize(10).font("Helvetica");
  if (report.orders.length) {
    for (const order of report.orders) {
      document.font("Helvetica-Bold").text(order.orderNumber);
      document.font("Helvetica").text(
        `${order.createdAt.toISOString().slice(0, 10)} | ${order.Supplier.name} | ${order.status} | $${Number(order.totalAmount).toFixed(2)}`,
        { indent: 12 }
      );
      document.moveDown(0.4);
    }
  } else {
    document.text("No purchase orders in this period.");
  }
  document.end();
});

export const exportPurchaseOrdersPdf = async (req, res, next) => {
  try {
    const report = await getReportOrRedirect(req, res);
    if (!report) return;
    const buffer = await createPdfReport(report);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="supplylink-purchases-${report.range.from}-to-${report.range.to}.pdf"`
    });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
