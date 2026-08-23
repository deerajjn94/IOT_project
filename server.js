const express = require('express');
const sql = require('mssql');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
const SECRET = "your-secret-key";

// ---------------- AUTH ----------------

// Register route (create user with hashed password)
app.post('/api/register', async (req, res) => {
  const { username, password, email, phone } = req.body;
  if (!username || !password || !email || !phone) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, hash)
      .input("emailid", sql.VarChar, email)
      .input("phonenumber", sql.VarChar, phone)
      .query("INSERT INTO users (username, password, emailid, phonenumber) VALUES (@username, @password, @emailid, @phonenumber)");

    res.json({ success: true, message: "User registered" });
  } catch (err) {
    console.error(err);
    let msg = err.message;
    if (msg.includes("UNIQUE") || msg.includes("duplicate")) {
      msg = "Username already exists. Please choose another.";
    }
    res.status(500).json({ success: false, message: msg });
  }
});


// Login route (check hashed password and issue JWT)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input("username", sql.VarChar, username)
            .query("SELECT id, password FROM users WHERE username=@username");

        if (result.recordset.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const hash = result.recordset[0].password;
        const match = await bcrypt.compare(password, hash);

        if (match) {
            const token = jwt.sign({ username }, SECRET, { expiresIn: "0.5h" });
            res.json({ success: true, token });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// ---------------- PASSWORD RESET ----------------

// Send OTP (for demo: just return OTP in response)
app.post("/api/send-reset-otp", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: "Missing username" });

  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input("username", sql.VarChar, username)
      .query("SELECT id FROM users WHERE username=@username");

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Generate OTP (demo only)
    const otp = Math.floor(100000 + Math.random() * 900000);

    // For now, just return OTP in response (frontend will show popup)
    res.json({ success: true, otp });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to generate OTP" });
  }
});

// Reset password
app.post("/api/reset-password", async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    const hash = await bcrypt.hash(newPassword, saltRounds);
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, hash)
      .query("UPDATE users SET password=@password WHERE username=@username");

    res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to reset password" });
  }
});

// ---------------- DEVICES ----------------

// Get devices assigned to user
app.get("/api/devices", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ success: false, message: "No token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const username = decoded.username;

    const pool = await sql.connect(dbConfig);
    const userResult = await pool.request()
      .input("username", sql.VarChar, username)
      .query("SELECT id FROM users WHERE username=@username");

    if (userResult.recordset.length === 0) return res.status(404).json({ success: false });

    const userid = userResult.recordset[0].id;

    const deviceResult = await pool.request()
      .input("userid", sql.Int, userid)
      .query("SELECT device_id FROM user_devices WHERE userid=@userid");

    res.json({ success: true, devices: deviceResult.recordset.map(r => r.device_id) });
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

// ---------------- PIN NAMES ----------------

// Get pin names for user/device
app.get("/api/pinNames", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ success: false });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const username = decoded.username;

    const pool = await sql.connect(dbConfig);
    const userResult = await pool.request()
      .input("username", sql.VarChar, username)
      .query("SELECT id FROM users WHERE username=@username");

    if (userResult.recordset.length === 0) return res.status(404).json({ success: false });

    const userid = userResult.recordset[0].id;
    const deviceId = req.query.device_id;
    console.log("Received pinNames request for device_id:", deviceId);

    const pinsResult = await pool.request()
      .input("userid", sql.Int, userid)
      .input("device_id", sql.VarChar, deviceId)
      .query("SELECT * FROM user_device_pins WHERE userid=@userid AND device_id=@device_id");

    if (pinsResult.recordset.length === 0) {
      return res.json({ success: false, message: "No pins found" });
    }

    const row = pinsResult.recordset[0];
    const pins = [];
    for (let i = 1; i <= 10; i++) {
      pins.push({ pin_number: i, pin_name: row[`pin${i}_name`] });
    }

    res.json({ success: true, pins });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch pin names" });
  }
});

// Update pin name
app.post("/api/updatePinName", async (req, res) => {
  const { pin_number, new_name, device_id } = req.body;
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ success: false });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const username = decoded.username;

    const pool = await sql.connect(dbConfig);
    const userResult = await pool.request()
      .input("username", sql.VarChar, username)
      .query("SELECT id FROM users WHERE username=@username");

    if (userResult.recordset.length === 0) return res.status(404).json({ success: false });

    const userid = userResult.recordset[0].id;
    const deviceId = req.query.device_id;

    await pool.request()
      .input("userid", sql.Int, userid)
      .input("device_id", sql.VarChar, deviceId)
      .input("pin_name", sql.VarChar, new_name)
      .query(`UPDATE user_device_pins SET pin${pin_number}_name=@pin_name WHERE userid=@userid AND device_id=@device_id`);

    res.json({ success: true, message: "Pin name updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update pin name" });
  }
});

// ---------------- DEVICE CONTROL ----------------

// Control device (store pin states in one row)
app.post('/api/device/control', async (req, res) => {
  const { device_id, pins } = req.body; 
  try {
    const pool = await sql.connect(dbConfig);

    await pool.request()
      .input("device_id", sql.VarChar, device_id)
      .input("pin1", sql.VarChar, pins.pin1)
      .input("pin2", sql.VarChar, pins.pin2)
      .input("pin3", sql.VarChar, pins.pin3)
      .input("pin4", sql.VarChar, pins.pin4)
      .input("pin5", sql.VarChar, pins.pin5)
      .input("pin6", sql.VarChar, pins.pin6)
      .input("pin7", sql.VarChar, pins.pin7)
      .input("pin8", sql.VarChar, pins.pin8)
      .input("pin9", sql.VarChar, pins.pin9)
      .input("pin10", sql.VarChar, pins.pin10)
      .query(`
        INSERT INTO device_commands (device_id, pin1, pin2, pin3, pin4, pin5, pin6, pin7, pin8, pin9, pin10, timestamp)
        VALUES (@device_id, @pin1, @pin2, @pin3, @pin4, @pin5, @pin6, @pin7, @pin8, @pin9, @pin10, GETDATE())
      `);

    res.json({ success: true, message: "Command updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "DB insert failed" });
  }
});


// Get latest device status
app.get("/api/device/status", async (req, res) => {
  const { device_id } = req.query;
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input("device_id", sql.VarChar, device_id)
      .query("SELECT TOP 1 pin1, pin2, pin3, pin4, pin5, pin6, pin7, pin8, pin9, pin10 FROM device_commands WHERE device_id=@device_id ORDER BY timestamp DESC");

    if (result.recordset.length === 0) {
      return res.json({ success: false, message: "No status found" });
    }

    res.json({ success: true, pins: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch status" });
  }
});

app.use(express.static('public')); // serve frontend

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
