const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("./db");
const sendData = require("./vtuService");
const auth = require("./middleware/auth");

const SECRET = process.env.JWT_SECRET || "vtu_secret_key";
const PRICE = 5;

/* ===========================
   AUTH: SIGNUP
=========================== */
router.post("/signup", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  const hashed = bcrypt.hashSync(password, 10);

  db.run(
    "INSERT INTO users (email, password, balance, role) VALUES (?, ?, 0, 'user')",
    [email.toLowerCase(), hashed],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE"))
          return res.status(409).json({ error: "User already exists" });
        return res.status(500).json({ error: "Database error" });
      }

      res.status(201).json({ success: true, userId: this.lastID });
    }
  );
});

/* ===========================
   AUTH: LOGIN
=========================== */
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email.toLowerCase()],
    (err, user) => {
      if (err || !user)
        return res.status(401).json({ error: "Invalid credentials" });

      if (!bcrypt.compareSync(password, user.password))
        return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: user.id, role: user.role },
        SECRET,
        { expiresIn: "1d" }
      );

      res.json({ success: true, token, userId: user.id });
    }
  );
});

/* ===========================
   WALLET: BALANCE
=========================== */
router.get("/wallet/balance", auth, (req, res) => {
  db.get(
    "SELECT balance FROM users WHERE id = ?",
    [req.user.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ balance: row.balance });
    }
  );
});

/* ===========================
   WALLET: DEPOSIT
=========================== */
router.post("/wallet/deposit", auth, (req, res) => {
  const { amount } = req.body;

  if (!amount || amount <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  db.run(
    "UPDATE users SET balance = balance + ? WHERE id = ?",
    [amount, req.user.id],
    err => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true });
    }
  );
});

/* ===========================
   PLACE ORDER (SECURE)
=========================== */
router.post("/order", auth, (req, res) => {
  const { network, phone, bundle } = req.body;

  if (!network || !phone || !bundle)
    return res.status(400).json({ error: "Missing fields" });

  db.serialize(() => {
    db.get(
      "SELECT balance FROM users WHERE id = ?",
      [req.user.id],
      (err, user) => {
        if (err || !user)
          return res.status(500).json({ error: "User error" });

        if (user.balance < PRICE)
          return res.status(400).json({ error: "Insufficient balance" });

        if (!sendData(network, phone, bundle))
          return res.status(500).json({ error: "VTU failed" });

        db.run(
          "UPDATE users SET balance = balance - ? WHERE id = ?",
          [PRICE, req.user.id]
        );

        db.run(
          "INSERT INTO orders (userId, network, phone, bundle) VALUES (?, ?, ?, ?)",
          [req.user.id, network, phone, bundle],
          function (err) {
            if (err)
              return res.status(500).json({ error: "Order failed" });

            res.json({ success: true, orderId: this.lastID });
          }
        );
      }
    );
  });
});

/* ===========================
   USER ORDERS
=========================== */
router.get("/orders/:userId", auth, (req, res) => {
  const userId = Number(req.params.userId);

  if (userId !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "Access denied" });

  db.all(
    "SELECT * FROM orders WHERE userId = ? ORDER BY id DESC",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

/* ===========================
   ADMIN: ALL ORDERS
=========================== */
router.get("/admin/orders", auth, (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin only" });

  db.all("SELECT * FROM orders ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(rows);
  });
});

module.exports = router;
