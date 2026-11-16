import bcrypt from "bcrypt";
import { User } from "../models/userModel.js";

export const listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({ attributes: ["id", "name", "email", "role", "createdAt"], order: [["name", "ASC"]] });
    res.render("users", { title: "User accounts", activePage: "users", users });
  } catch (error) {
    next(error);
  }
};

export const createStaffUser = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      req.flash("error_msg", "Enter a name, valid email, and password of at least 8 characters.");
      return res.redirect("/users");
    }
    await User.create({ name, email, password: await bcrypt.hash(password, 12), role: "Staff" });
    req.flash("success_msg", "Staff account created.");
    res.redirect("/users");
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      req.flash("error_msg", "An account already uses that email address.");
      return res.redirect("/users");
    }
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).render("notFound", { title: "User not found" });
    if (user.id === req.currentUser.id || user.role === "Administrator") {
      req.flash("error_msg", "You cannot delete your own account or an administrator account.");
      return res.redirect("/users");
    }
    await user.destroy();
    req.flash("success_msg", "Staff account deleted.");
    res.redirect("/users");
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      req.flash("error_msg", "This user created a purchase order and cannot be deleted.");
      return res.redirect("/users");
    }
    next(error);
  }
};
