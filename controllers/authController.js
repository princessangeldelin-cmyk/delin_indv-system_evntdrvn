import bcrypt from "bcrypt";
import { User } from "../models/userModel.js";

export const loginPage = (req, res) => {
  if (req.currentUser) return res.redirect("/dashboard");
  res.render("login", { title: "Sign in" });
};

export const registerPage = async (req, res, next) => {
  try {
    if (await User.count()) return res.redirect("/login");
    res.render("register", { title: "Set up administrator" });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      req.flash("error_msg", "Email or password is incorrect.");
      return res.redirect("/login");
    }

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      res.redirect("/dashboard");
    });
  } catch (error) {
    next(error);
  }
};

export const registerUser = async (req, res, next) => {
  try {
    if (await User.count()) {
      req.flash("error_msg", "Administrator setup is already complete.");
      return res.redirect("/login");
    }

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      req.flash("error_msg", "Enter your name, a valid email, and a password of at least 8 characters.");
      return res.redirect("/register");
    }

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role: "Administrator"
    });

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      res.redirect("/dashboard");
    });
  } catch (error) {
    next(error);
  }
};

export const logoutUser = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("supplylink.sid");
    res.redirect("/login");
  });
};
