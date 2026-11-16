import { randomBytes } from "node:crypto";
import { sequelize } from "../models/db.js";
import { OrderItem, Product, PurchaseOrder, Supplier, User } from "../models/index.js";

const asArray = (value) => Array.isArray(value) ? value : value === undefined ? [] : [value];

export const listPurchaseOrders = async (req, res, next) => {
  try {
    const statuses = ["Pending approval", "Approved", "Partially received", "Received"];
    const selectedStatus = statuses.includes(req.query.status) ? req.query.status : "";
    const orders = await PurchaseOrder.findAll({
      where: selectedStatus ? { status: selectedStatus } : {},
      include: [
        { model: Supplier, attributes: ["name"] },
        { model: User, as: "creator", attributes: ["name"] }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.render("purchaseOrders", {
      title: "Purchase orders",
      activePage: "orders",
      orders,
      selectedStatus,
      statuses
    });
  } catch (error) {
    next(error);
  }
};

export const newPurchaseOrder = async (req, res, next) => {
  try {
    const [suppliers, products] = await Promise.all([
      Supplier.findAll({ order: [["name", "ASC"]] }),
      Product.findAll({ order: [["name", "ASC"]] })
    ]);
    res.render("purchaseOrderForm", {
      title: "Create purchase order",
      activePage: "orders",
      suppliers,
      products
    });
  } catch (error) {
    next(error);
  }
};

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const supplierId = Number(req.body.supplierId);
    const productIds = asArray(req.body.productIds).map(Number);
    const quantities = asArray(req.body.quantities).map(Number);
    const submittedLines = productIds.map((productId, index) => ({
      productId,
      quantity: quantities[index],
      hasInput: Boolean(productId || quantities[index])
    }));
    const invalidLine = submittedLines.some(line => line.hasInput &&
      (!Number.isInteger(line.productId) || line.productId < 1 ||
        !Number.isInteger(line.quantity) || line.quantity < 1));
    const lines = submittedLines
      .filter(line => line.hasInput)
      .map(({ productId, quantity }) => ({ productId, quantity }));

    if (!Number.isInteger(supplierId) || supplierId < 1 || !lines.length || invalidLine) {
      req.flash("error_msg", "Choose a supplier and add at least one product with a positive whole-number quantity.");
      return res.redirect("/purchase-orders/new");
    }

    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) {
      req.flash("error_msg", "Select an existing supplier.");
      return res.redirect("/purchase-orders/new");
    }

    const products = await Product.findAll({ where: { id: [...new Set(lines.map(line => line.productId))] } });
    if (products.length !== new Set(lines.map(line => line.productId)).size) {
      req.flash("error_msg", "One or more selected products no longer exist.");
      return res.redirect("/purchase-orders/new");
    }
    if (products.some(product => product.supplierId && product.supplierId !== supplier.id)) {
      req.flash("error_msg", "A selected product is assigned to a different supplier.");
      return res.redirect("/purchase-orders/new");
    }

    const productById = new Map(products.map(product => [product.id, product]));
    const items = lines.map(line => ({
      productId: line.productId,
      quantity: line.quantity,
      receivedQuantity: 0,
      unitPrice: Number(productById.get(line.productId).unitPrice)
    }));
    const totalAmount = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
    await sequelize.transaction(async (transaction) => {
      const order = await PurchaseOrder.create({
        orderNumber: `SL-${Date.now()}-${randomBytes(2).toString("hex").toUpperCase()}`,
        supplierId: supplier.id,
        createdById: req.currentUser.id,
        status: "Pending approval",
        totalAmount: totalAmount.toFixed(2)
      }, { transaction });
      await OrderItem.bulkCreate(items.map(item => ({ ...item, purchaseOrderId: order.id })), { transaction });
    });

    req.flash("success_msg", "Purchase order created and sent for administrator approval.");
    res.redirect("/purchase-orders");
  } catch (error) {
    next(error);
  }
};

export const viewPurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findByPk(req.params.id, {
      include: [
        { model: Supplier },
        { model: User, as: "creator", attributes: ["name"] },
        {
          model: OrderItem,
          as: "items",
          include: [{ model: Product, attributes: ["name", "sku", "unit"] }]
        }
      ]
    });
    if (!order) return res.status(404).render("notFound", { title: "Purchase order not found" });
    res.render("purchaseOrderDetail", {
      title: order.orderNumber,
      activePage: "orders",
      order,
      outstandingItems: order.items.filter(item => item.receivedQuantity < item.quantity)
    });
  } catch (error) {
    next(error);
  }
};

export const approvePurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findByPk(req.params.id);
    if (!order) return res.status(404).render("notFound", { title: "Purchase order not found" });
    if (order.status !== "Pending approval") {
      req.flash("error_msg", "Only purchase orders awaiting approval can be approved.");
      return res.redirect(`/purchase-orders/${order.id}`);
    }
    await order.update({ status: "Approved" });
    req.flash("success_msg", "Purchase order approved and ready for delivery.");
    res.redirect(`/purchase-orders/${order.id}`);
  } catch (error) {
    next(error);
  }
};

export const recordReceipt = async (req, res, next) => {
  const orderId = Number(req.params.id);
  try {
    await sequelize.transaction(async (transaction) => {
      const order = await PurchaseOrder.findByPk(orderId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!order) throw new Error("Purchase order not found.");
      if (!["Approved", "Partially received"].includes(order.status)) {
        throw new Error("Only approved, outstanding orders can receive stock.");
      }

      const items = await OrderItem.findAll({
        where: { purchaseOrderId: order.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const deliveries = items.map(item => ({
        item,
        quantity: Number(req.body[`receivedQty_${item.id}`] || 0)
      }));
      if (deliveries.some(({ quantity }) => !Number.isInteger(quantity) || quantity < 0)) {
        throw new Error("Received quantities must be whole numbers of zero or more.");
      }
      if (!deliveries.some(({ quantity }) => quantity > 0)) {
        throw new Error("Enter at least one quantity received.");
      }
      if (deliveries.some(({ item, quantity }) => quantity > item.quantity - item.receivedQuantity)) {
        throw new Error("A received quantity cannot exceed the outstanding quantity.");
      }

      for (const { item, quantity } of deliveries) {
        if (!quantity) continue;
        const product = await Product.findByPk(item.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (!product) throw new Error("A product on this order no longer exists.");
        await product.update({ stockQuantity: product.stockQuantity + quantity }, { transaction });
        await item.update({ receivedQuantity: item.receivedQuantity + quantity }, { transaction });
      }

      const updatedItems = await OrderItem.findAll({ where: { purchaseOrderId: order.id }, transaction });
      const receivedCount = updatedItems.reduce((sum, item) => sum + item.receivedQuantity, 0);
      const orderedCount = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      const status = receivedCount >= orderedCount ? "Received" : "Partially received";
      await order.update({ status }, { transaction });
    });
    req.flash("success_msg", "Delivery quantities recorded and product stock updated.");
    res.redirect(`/purchase-orders/${orderId}`);
  } catch (error) {
    if (["Purchase order not found.", "Only approved, outstanding orders can receive stock.",
      "Received quantities must be whole numbers of zero or more.", "Enter at least one quantity received.",
      "A received quantity cannot exceed the outstanding quantity.", "A product on this order no longer exists."
    ].includes(error.message)) {
      req.flash("error_msg", error.message);
      return res.redirect(`/purchase-orders/${orderId}`);
    }
    next(error);
  }
};
