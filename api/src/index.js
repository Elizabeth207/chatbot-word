import { app } from "./controllers/serverSetup.js";
import "./controllers/index.js";

const PORT = process.env.PORT || 3000;

console.log("🚀 INICIANDO SERVIDOR...");

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
