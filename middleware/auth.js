import { User } from "../models/userModel.js";

export const attachUser = async (req, res, next) => {
  try {
    if (req.session.userId) {
      const user = await User.findByPk(req.session.userId, {
        attributes: ["id", "name", "email", "role"]
      });
      if (user) {
        req.currentUser = user;
        res.locals.currentUser = user;
      } else {
        delete req.session.userId;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth = (req, res, next) => {
  if (!req.currentUser) {
    req.flash("error_msg", "Please sign in to continue.");
    return res.redirect("/login");
  }
  next();
};

export const requireAdministrator = (req, res, next) => {
  if (req.currentUser?.role !== "Administrator") {
    req.flash("error_msg", "Administrator access is required for that action.");
    return res.redirect("/dashboard");
  }
  next();
};
