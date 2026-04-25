const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");

const { register, login } = require("../controllers/authController");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// ✅ normal auth
router.post("/register", register);
router.post("/login", login);
router.post("/logout", (req, res) => {
  res.clearCookie("token"); // if using cookies
  res.json({
    success: true,
    message: "Logged out successfully"
  });
});
// ✅ google auth start
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

// ✅ google callback
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    try {
      // 🔥 ensure user exists
      if (!req.user) {
        return res.redirect("http://localhost:5173/?error=auth_failed");
      }

      // ✅ include username (VERY IMPORTANT for sockets)
      const token = jwt.sign(
        {
          id: req.user._id,
          username: req.user.name || req.user.username || "User",
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      // ✅ redirect to frontend
      res.redirect(`http://localhost:5173/home?token=${token}`);
    } catch (err) {
      console.error(err);
      res.redirect("http://localhost:5173/?error=server_error");
    }
  }
);

module.exports = router;