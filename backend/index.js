const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// 🧠 Load miner list (each with host, port, and ID)
const miners = [
  { "id": "miner3", "host": "192.168.122.1", "port": 16000 },
  { "id": "miner1", "host": "192.168.122.1", "port": 16001 },
  { "id": "miner2", "host": "192.168.100.58", "port": 16002 }
]

console.log(" Loaded miners:", miners.map(m => `${m.id} (${m.host}:${m.port})`).join(", "));

// 🟢 Get live stats for all miners
app.get("/miners", async (req, res) => {
  try {
    console.log("Fetching stats for all miners...");
    const results = await Promise.all(
      miners.map(async (miner) => {
        try {
          const url = `http://${miner.host}:${miner.port}/api.json`;
          const { data } = await axios.get(url, { timeout: 4000 });

          console.log({data})

          const hashrate = data.hashrate?.total?.[0] || 0;
          console.log(`Miner ${miner.id} → Hashrate: ${hashrate} H/s`);
          const threads = data.threads?.length || 0;
          const uptime = data.connection?.uptime || 0;
          const algo = data.algo || "unknown";

          return {
            id: miner.id,
            host: miner.host,
            status: "online",
            algo,
            hashrate,
            threads,
            uptime,
            version: data.version || "unknown"
          };
        } catch {
          return {
            id: miner.id,
            host: miner.host,
            status: "offline",
            hashrate: 0,
            threads: 0,
            uptime: 0,
            version: null
          };
        }
      })
    );
   
    res.json({ miners: results });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch miner stats", details: err.message });
  }
});

// 🟢 Get summarized network performance
app.get("/summary", async (req, res) => {
  try {
    let totalHashrate = 0;
    let activeMiners = 0;

    const minerStats = await Promise.all(
      miners.map(async (miner) => {
        try {
          const url = `http://${miner.host}:${miner.port}/api.json`;
          const { data } = await axios.get(url, { timeout: 4000 });
          const hashrate = data.hashrate?.total?.[0] || 0;
          totalHashrate += hashrate;
          activeMiners++;
        } catch {}
      })
    );

  const total = Number(totalHashrate) || 0;
const active = Number(activeMiners) || 0;
const totalMinersCount = miners?.length || 0;
const offline = totalMinersCount - active;

console.log(`Stats → Hashrate: ${total} H/s | Active: ${active} | Offline: ${offline}`);

res.json({
  totalHashrate: total.toFixed(2),
  activeMiners: active,
  totalMiners: totalMinersCount,
  offlineMiners: offline,
  lastUpdated: new Date().toISOString()
});

  } catch (err) {
    res.status(500).json({ error: "Failed to generate summary", details: err.message });
  }
});

// 🟡 Optional: Auto-refresh every 30s (for dashboard use)
app.get("/miners/live", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.redirect("/miners");
});

// ✅ Start server
app.listen(5001, () => console.log("✅ Miner API running on port 5001"));
