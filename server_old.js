const express = require('express');
const sql = require('mssql');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');   // added for password hashing
const { spawn } = require('child_process');

const app = express();
app.use(bodyParser.json());
app.use(session({ secret: 'iot_secret', resave: false, saveUninitialized: true }));

// SQL Server config
const dbConfig = {
    server: "DESKTOP-R87H1QS\\SQLEXPRESS",
    database: "iot_db",
    user: "sa",
    password: "Medilla18@",
    options: { 
        encrypt: false, 
        trustServerCertificate: true,
        port: 1433
     }
};

const saltRounds = 10;

const jwt = require("jsonwebtoken");
const SECRET = "your-secret-key";

app.post("/api/checkAuth", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.json({ authenticated: false });

  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, SECRET);
    res.json({ authenticated: true });
  } catch (err) {
    res.json({ authenticated: false });
  }
});

// Register route (create user with hashed password)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Missing fields" });
    }
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input("username", sql.VarChar, username)
            .input("password", sql.VarChar, hash)
            .query("INSERT INTO users (username, password) VALUES (@username, @password)");
        res.json({ success: true, message: "User registered" });
    } catch (err) {
        console.error(err);

        // Friendly error mapping
        let msg = err.message;
        if (msg.includes("UNIQUE") || msg.includes("duplicate")) {
            msg = "Username already exists. Please choose another.";
        } else if (msg.includes("string or binary data would be truncated")) {
            msg = "Password too long for database column.";
        }

        res.status(500).json({ success: false, message: msg });
    }
});


// Login route (check hashed password)
// Login route (check hashed password and issue JWT)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("username", sql.VarChar, username)
            .query("SELECT password FROM users WHERE username=@username");

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const hash = result.recordset[0].password;
        const match = await bcrypt.compare(password, hash);

        if (match) {
            // ✅ Generate JWT
            const token = jwt.sign({ username }, SECRET, { expiresIn: "30m" });
            res.json({ success: true, token });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Login failed" });
    }
});

// Get devices assigned to the logged-in user
app.get("/api/devices", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ success: false, message: "No token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const username = decoded.username;

    const pool = await sql.connect(dbConfig);

    // Step 1: Get user id from users table
    const userResult = await pool.request()
      .input("username", sql.VarChar, username)
      .query("SELECT id FROM users WHERE username=@username");

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userid = userResult.recordset[0].id;

    // Step 2: Get devices for that userid
    const deviceResult = await pool.request()
      .input("userid", sql.Int, userid)
      .query("SELECT device_id FROM user_devices WHERE userid=@userid");

    res.json({ success: true, devices: deviceResult.recordset.map(r => r.device_id) });
  } catch (err) {
    console.error(err);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

// Get latest device status
app.get('/api/device/status', async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`SELECT TOP 1 * FROM device_status ORDER BY timestamp DESC`;
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Control device
app.post('/api/device/control', async (req, res) => {
    const { device_id, status } = req.body;
    try {
        await sql.connect(dbConfig);
        await sql.query`INSERT INTO device_commands (device_id, action) VALUES (${device_id}, ${status})`;
        res.json({ success: true, message: `Command queued: ${status}` });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Get latest command for a device
app.get('/api/device/command/:device_id', async (req, res) => {
    const deviceId = req.params.device_id;
    try {
        await sql.connect(dbConfig);
        const result = await sql.query`
            SELECT TOP 1 action 
            FROM device_commands 
            WHERE device_id = ${deviceId} 
            ORDER BY timestamp DESC
        `;
        if (result.recordset.length > 0) {
            res.json({ status: "success", action: result.recordset[0].action });
        } else {
            res.json({ status: "success", action: "NONE" });
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Update device status only when changed
app.post("/api/device/status", async (req, res) => {
  const { device_id, status } = req.body;

  if (!device_id || !status) {
    return res.status(400).json({ status: "error", message: "Missing fields" });
  }

  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request()
      .input("device_id", sql.VarChar, device_id)
      .query("SELECT TOP 1 status FROM device_status WHERE device_id = @device_id ORDER BY timestamp DESC");

    const lastStatus = result.recordset.length > 0 ? result.recordset[0].status : null;

    if (lastStatus !== status) {
      await pool.request()
        .input("device_id", sql.VarChar, device_id)
        .input("status", sql.VarChar, status)
        .query("INSERT INTO device_status (device_id, status, timestamp) VALUES (@device_id, @status, GETDATE())");

      return res.json({ status: "success", message: "Status updated", device_id, new_status: status });
    } else {
      return res.json({ status: "success", message: "No change, skipped", device_id, current_status: status });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "DB insert failed" });
  }
});

app.use(express.static('public')); // serve frontend

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
