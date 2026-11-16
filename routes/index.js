import express from "express";
import { User } from "../models/userModel.js";
import { loginPage, registerPage, loginUser, registerUser, logoutUser } from "../controllers/authController.js";
import { dashboardPage } from "../controllers/dashboardController.js";
import * as suppliers from "../controllers/supplierController.js";
import * as products from "../controllers/productController.js";
import * as purchaseOrders from "../controllers/purchaseOrderController.js";
import * as users from "../controllers/userController.js";
import * as reports from "../controllers/reportController.js";
import { requireAdministrator, requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    if (req.currentUser) return res.redirect("/dashboard");
    res.redirect(await User.count() ? "/login" : "/register");
  } catch (error) {
    next(error);
  }
});

router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/register", registerPage);
router.post("/register", registerUser);
router.get("/logout", logoutUser);

router.use(requireAuth);
router.get("/dashboard", dashboardPage);
router.get("/reports", reports.reportsPage);
router.get("/reports/purchase-orders.csv", reports.exportPurchaseOrders);

router.get("/suppliers", suppliers.listSuppliers);
router.get("/suppliers/new", suppliers.newSupplier);
router.post("/suppliers", suppliers.createSupplier);
router.get("/suppliers/:id/edit", suppliers.editSupplier);
router.post("/suppliers/:id", suppliers.updateSupplier);
router.post("/suppliers/:id/delete", suppliers.deleteSupplier);

router.get("/products", products.listProducts);
router.get("/products/new", products.newProduct);
router.post("/products", products.createProduct);
router.get("/products/:id/edit", products.editProduct);
router.post("/products/:id", products.updateProduct);
router.post("/products/:id/delete", products.deleteProduct);

router.get("/purchase-orders", purchaseOrders.listPurchaseOrders);
router.get("/purchase-orders/new", purchaseOrders.newPurchaseOrder);
router.post("/purchase-orders", purchaseOrders.createPurchaseOrder);
router.get("/purchase-orders/:id", purchaseOrders.viewPurchaseOrder);
router.post("/purchase-orders/:id/approve", requireAdministrator, purchaseOrders.approvePurchaseOrder);
router.post("/purchase-orders/:id/receive", purchaseOrders.recordReceipt);

router.get("/users", requireAdministrator, users.listUsers);
router.post("/users", requireAdministrator, users.createStaffUser);
router.post("/users/:id/delete", requireAdministrator, users.deleteUser);

router.use((req, res) => res.status(404).render("notFound", { title: "Page not found" }));

export default router;
