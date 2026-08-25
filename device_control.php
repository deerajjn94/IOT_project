<?php
header("Content-Type: application/json");

$API_KEY = "DeerajIoT2026"; 

// Accept API key either from header or query parameter
$headers = apache_request_headers();
$key = $headers['X-API-KEY'] ?? $headers['x-api-key'] ?? ($_GET['api_key'] ?? null);

if ($key !== $API_KEY) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Invalid API key"]);
    exit;
}

if (!isset($_GET['device_id'], $_GET['action'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing parameters"]);
    exit;
}

$device_id = $_GET['device_id'];
$action = strtoupper($_GET['action']); // ON or OFF or STATUS

// Connect to DB
$serverName = "DESKTOP-R87H1QS\\SQLEXPRESS";
$connectionOptions = array(
    "Database" => "iot_db",
    "Uid" => "sa",
    "PWD" => "Medilla18@",
    "Encrypt" => 0,
    "TrustServerCertificate" => 1
);

$conn = sqlsrv_connect($serverName, $connectionOptions);
if ($conn === false) {
    http_response_code(500);
    die(json_encode(["status" => "error", "message" => "DB connection failed"]));
}

if ($action === "STATUS") {
    // Return latest command for this device
    $sql = "SELECT TOP 1 action FROM device_commands WHERE device_id=? ORDER BY timestamp DESC";
    $stmt = sqlsrv_query($conn, $sql, array($device_id));
    $row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
    if ($row) {
        echo json_encode(["status" => "success", "device_id" => $device_id, "action" => $row['action']]);
    } else {
        echo json_encode(["status" => "success", "device_id" => $device_id, "action" => "OFF"]);
    }
} else {
    // Insert new command
    $sql = "INSERT INTO device_commands (device_id, action, timestamp) VALUES (?, ?, GETDATE())";
    $params = array($device_id, $action);
    $stmt = sqlsrv_query($conn, $sql, $params);

    if ($stmt) {
        echo json_encode(["status" => "success", "device_id" => $device_id, "action" => $action]);
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => sqlsrv_errors()]);
    }
}

sqlsrv_close($conn);
?>
