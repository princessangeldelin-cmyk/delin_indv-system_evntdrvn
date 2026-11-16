import { Product, Supplier } from "../models/index.js";

const toProductFields = (body) => ({
  name: String(body.name || "").trim(),
  sku: String(body.sku || "").trim() || null,
  unit: String(body.unit || "each").trim(),
  supplierId: body.supplierId ? Number(body.supplierId) : null,
  stockQuantity: body.stockQuantity === "" || body.stockQuantity === undefined ? NaN : Number(body.stockQuantity),
  minimumStock: body.minimumStock === "" || body.minimumStock === undefined ? NaN : Number(body.minimumStock),
  unitPrice: body.unitPrice === "" || body.unitPrice === undefined ? NaN : Number(body.unitPrice)
});

const validFields = (product) =>
  product.name &&
  product.unit &&
  Number.isInteger(product.stockQuantity) && product.stockQuantity >= 0 &&
  Number.isInteger(product.minimumStock) && product.minimumStock >= 0 &&
  Number.isFinite(product.unitPrice) && product.unitPrice >= 0 &&
  (product.supplierId === null || Number.isInteger(product.supplierId));

export const listProducts = async (req, res, next) => {
  try {
    const [products, suppliers] = await Promise.all([
      Product.findAll({ include: [{ model: Supplier, attributes: ["name"] }], order: [["name", "ASC"]] }),
      Supplier.findAll({ order: [["name", "ASC"]] })
    ]);
    res.render("products", { title: "Products", activePage: "products", products, suppliers });
  } catch (error) {
    next(error);
  }
};

export const newProduct = async (req, res, next) => {
  try {
    const suppliers = await Supplier.findAll({ order: [["name", "ASC"]] });
    res.render("productForm", { title: "Add product", activePage: "products", product: {}, suppliers });
  } catch (error) {
    next(error);
  }
};

export const editProduct = async (req, res, next) => {
  try {
    const [product, suppliers] = await Promise.all([
      Product.findByPk(req.params.id),
      Supplier.findAll({ order: [["name", "ASC"]] })
    ]);
    if (!product) return res.status(404).render("notFound", { title: "Product not found" });
    res.render("productForm", { title: "Edit product", activePage: "products", product, suppliers });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const fields = toProductFields(req.body);
    if (!validFields(fields)) {
      req.flash("error_msg", "Enter a product name and valid, non-negative stock, minimum stock, and price.");
      return res.redirect("/products/new");
    }
    if (fields.supplierId && !(await Supplier.findByPk(fields.supplierId))) {
      req.flash("error_msg", "Select an existing supplier.");
      return res.redirect("/products/new");
    }
    await Product.create(fields);
    req.flash("success_msg", "Product added.");
    res.redirect("/products");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      req.flash("error_msg", "That SKU is already in use.");
      return res.redirect("/products/new");
    }
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).render("notFound", { title: "Product not found" });
    const fields = toProductFields(req.body);
    if (!validFields(fields)) {
      req.flash("error_msg", "Enter a product name and valid, non-negative stock, minimum stock, and price.");
      return res.redirect(`/products/${product.id}/edit`);
    }
    if (fields.supplierId && !(await Supplier.findByPk(fields.supplierId))) {
      req.flash("error_msg", "Select an existing supplier.");
      return res.redirect(`/products/${product.id}/edit`);
    }
    await product.update(fields);
    req.flash("success_msg", "Product updated.");
    res.redirect("/products");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      req.flash("error_msg", "That SKU is already in use.");
      return res.redirect(`/products/${req.params.id}/edit`);
    }
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).render("notFound", { title: "Product not found" });
    await product.destroy();
    req.flash("success_msg", "Product deleted.");
    res.redirect("/products");
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      req.flash("error_msg", "This product appears on a purchase order and cannot be deleted.");
      return res.redirect("/products");
    }
    next(error);
  }
};
