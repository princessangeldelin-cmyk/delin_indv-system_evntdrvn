# SupplyLink

SupplyLink is a small XianFire (Express) application for supplier records, product stock, purchase orders, and delivery receiving. It uses Xian `.xian` views, Tailwind utility classes, Sequelize, and MySQL.

## Requirements

- Node.js 18 or newer
- MySQL 8 or compatible MySQL server

## Start the application

1. Install the project dependencies:

   ```powershell
   npm install
   ```

2. Set the MySQL connection settings in the current PowerShell session if they differ from the defaults (`localhost:3306`, user `root`, blank password):

   ```powershell
   $env:DB_HOST = "localhost"
   $env:DB_PORT = "3306"
   $env:DB_USER = "root"
   $env:DB_PASSWORD = "your-mysql-password"
   $env:DB_NAME = "supplylink_delin"
   $env:SESSION_SECRET = "replace-this-with-a-long-random-secret"
   ```

3. Create the database and the five application tables:

   ```powershell
   npm run migrate
   ```

   The migration uses Sequelize `sync()` without `force`; it does not drop existing tables.

4. Start the server:

   ```powershell
   npm start
   ```

5. Open `http://localhost:3000`. On the first visit, register the initial Administrator account. After setup, registration is disabled. The Administrator can create Staff accounts from **User accounts**.

## Workflow

- Add suppliers, then add products with a current stock, minimum stock, optional supplier, and purchase unit price.
- Products at or below their minimum stock are automatically shown on the dashboard.
- Create a purchase order with a supplier, products, and quantities. It starts as **Pending approval**.
- An Administrator approves the order. Staff or Administrators can record deliveries against approved orders.
- Receiving a quantity updates both the order's received quantity and the product's current stock in one database transaction. Partial deliveries remain open until all ordered units are received.
- Use **Reports** to summarize purchasing totals, supplier spend, approval status, and fully received orders by date range; purchase-order lists can also be filtered by status.

The database contains only `users`, `suppliers`, `products`, `purchase_orders`, and `order_items`. Product-to-supplier assignment is stored on the product; received quantities are stored on order items. Sales, payments, external inventory integrations, and discrepancy history are outside this simple implementation.

## Roles

- **Administrator**: all purchasing and inventory screens, user account management, and purchase order approval.
- **Staff**: supplier and product CRUD, purchase order creation, and delivery receiving.
