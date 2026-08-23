<?php
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
    die("DB connection failed");
}

// Get distinct devices
$devices = sqlsrv_query($conn, "SELECT DISTINCT device_id FROM device_status");
?>
<!DOCTYPE html>
<html>
<head>
    <title>Device Status Dashboard</title>
</head>
<body>
    <h2>IoT Device Status Dashboard</h2>
    <form method="GET">
        <label>Select Device:</label>
        <select name="device_id" onchange="this.form.submit()">
            <?php while($row = sqlsrv_fetch_array($devices, SQLSRV_FETCH_ASSOC)): ?>
                <option value="<?= htmlspecialchars($row['device_id']) ?>" 
                    <?= (isset($_GET['device_id']) && $_GET['device_id']==$row['device_id'])?'selected':'' ?>>
                    <?= htmlspecialchars($row['device_id']) ?>
                </option>
            <?php endwhile; ?>
        </select>
    </form>

    <?php
    if (isset($_GET['device_id'])) {
        $device_id = $_GET['device_id'];
        $sql = "SELECT TOP 1 * FROM device_status WHERE device_id=? ORDER BY timestamp DESC";
        $stmt = sqlsrv_query($conn, $sql, array($device_id));
        $latest = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);

        echo "<h3>Latest Status for ".htmlspecialchars($device_id)."</h3>";
        if ($latest) {
            // Show status
            echo "<p>Status: <b>".htmlspecialchars($latest['status'])."</b></p>";

            // Handle timestamp safely
            if (isset($latest['timestamp'])) {
                if ($latest['timestamp'] instanceof DateTime) {
                    echo "<p>Timestamp: ".$latest['timestamp']->format('Y-m-d H:i:s')."</p>";
                } else {
                    echo "<p>Timestamp: ".htmlspecialchars($latest['timestamp'])."</p>";
                }
            }
        } else {
            echo "<p>No data yet.</p>";
        }
    }
    ?>
    <script>
        setTimeout(() => location.reload(), 10000); // auto-refresh every 10s
    </script>
</body>
</html>
<?php sqlsrv_close($conn); ?>
