const router = require("express").Router();
const jwt = require("jsonwebtoken");

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    console.warn(`[auth] failed login for ${email}`);
    return res.status(401).json({ message: "Incorrect email or password." });
  }
  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "8h" });
  console.log(`[auth] ${email} logged in`);
  res.json({ token, email });
});

module.exports = router;
