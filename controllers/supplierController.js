import { Supplier, Product } from "../models/index.js";

const supplierFields = (body) => ({
  name: String(body.name || "").trim(),
  contactName: String(body.contactName || "").trim() || null,
  email: String(body.email || "").trim().toLowerCase() || null,
  phone: String(body.phone || "").trim() || null,
  address: String(body.address || "").trim() || null
});

const validSupplierFields = (fields) =>
  fields.name.length <= 160 &&
  (!fields.contactName || fields.contactName.length <= 120) &&
  (!fields.phone || fields.phone.length <= 40) &&
  (!fields.address || fields.address.length <= 255) &&
  (!fields.email || fields.email.length <= 190) &&
  (!fields.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email));

export const listSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.findAll({
      include: [{ model: Product, attributes: ["id"] }],
      order: [["name", "ASC"]]
    });
    res.render("suppliers", { title: "Suppliers", activePage: "suppliers", suppliers });
  } catch (error) {
    next(error);
  }
};

export const newSupplier = (req, res) => res.render("supplierForm", {
  title: "Add supplier", activePage: "suppliers", supplier: {}
});

export const editSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).render("notFound", { title: "Supplier not found" });
    res.render("supplierForm", { title: "Edit supplier", activePage: "suppliers", supplier });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req, res, next) => {
  try {
    const fields = supplierFields(req.body);
    if (!fields.name || !validSupplierFields(fields)) {
      req.flash("error_msg", "Enter a supplier name and a valid email address if provided.");
      return res.redirect("/suppliers/new");
    }
    await Supplier.create(fields);
    req.flash("success_msg", "Supplier added.");
    res.redirect("/suppliers");
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).render("notFound", { title: "Supplier not found" });
    const fields = supplierFields(req.body);
    if (!fields.name || !validSupplierFields(fields)) {
      req.flash("error_msg", "Enter a supplier name and a valid email address if provided.");
      return res.redirect(`/suppliers/${supplier.id}/edit`);
    }
    await supplier.update(fields);
    req.flash("success_msg", "Supplier updated.");
    res.redirect("/suppliers");
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).render("notFound", { title: "Supplier not found" });
    await supplier.destroy();
    req.flash("success_msg", "Supplier deleted.");
    res.redirect("/suppliers");
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      req.flash("error_msg", "This supplier is linked to products or purchase orders and cannot be deleted.");
      return res.redirect("/suppliers");
    }
    next(error);
  }
};
