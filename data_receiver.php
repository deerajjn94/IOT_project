<?php
header("Content-Type: application/json");

// Define your API key
$API_KEY = "DeerajIoT2026"; 

// Get headers (case-insensitive handling)
$headers = apache_request_headers();
$receivedKey = null;
foreach ($headers as $key => $value) {
    if (strtolower($key) === "x-api-key") {
        $receivedKey = $value;
        break;
    }
}

// Validate API key
if ($receivedKey !== $API_KEY) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Invalid API key"]);
    exit;
}

// SQL Server connection
$serverName = "DESKTOP-R87H1QS\\SQLEXPRESS"; // double backslash for PHP
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
    die(json_encode(["status" => "error", "message" => "DB connection failed", "details" => sqlsrv_errors()]));
}

// Read JSON body
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['device_id'], $data['status'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing fields"]);
    exit;
}

$device_id = $data['device_id'];
$status = strtoupper($data['status']); // normalize ON/OFF

// Insert into table
$sql = "INSERT INTO device_status (device_id, status) VALUES (?, ?)";
$params = array($device_id, $status);

$stmt = sqlsrv_query($conn, $sql, $params);
if ($stmt) {
    echo json_encode(["status" => "success"]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => sqlsrv_errors()]);
}

sqlsrv_close($conn);
?>
