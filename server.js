// Load environment variables FIRST
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const routes = require("./routes");

const app = express();

/* ===========================
   MIDDLEWARE
=========================== */

// Parse JSON body
app.use(express.json());

// Enable CORS
app.use(
  cors({
    origin: "*", // 🔒 Change to Netlify URL later for security
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

/* ===========================
   HEALTH CHECK (ROOT)
=========================== */
app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "VTU Backend is running 🚀"
  });
});

/* ===========================
   API ROUTES
=========================== */
app.use("/api", routes);

/* ===========================
   GLOBAL ERROR HANDLER
=========================== */
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(500).json({
    error: "Internal server error"
  });
});

/* ===========================
   START SERVER
=========================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
