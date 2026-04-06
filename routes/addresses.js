function registerAddressRoutes(app, { getPool }) {
    // Get all addresses for a user
    app.get("/addresses/:userId", async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            if (isNaN(userId)) {
                return res.status(400).json({ error: "Invalid user ID" });
            }
            const [rows] = await getPool().query(
                "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC",
                [userId]
            );
            res.json(rows);
        } catch (err) {
            console.error("Get addresses error:", err);
            res.status(500).json({ error: err.message });
        }
    });

    // Save a new address
    app.post("/addresses", async (req, res) => {
        try {
            const userId = parseInt(req.body.userId);
            const { label, door_no, street, area, city, state, pincode, landmark, latitude, longitude, is_default } = req.body;

            if (!userId || !door_no || !city || !state || !pincode) {
                return res.status(400).json({ error: "Required fields missing" });
            }

            // If this is default, unset other defaults
            if (is_default) {
                await getPool().query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId]);
            }

            const [result] = await getPool().query(
                `INSERT INTO addresses (user_id, label, door_no, street, area, city, state, pincode, landmark, latitude, longitude, is_default)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [userId, label || 'Home', door_no, street, area, city, state, pincode, landmark, latitude, longitude, is_default ? 1 : 0]
            );

            res.json({ id: result.insertId, success: true });
        } catch (err) {
            console.error("Save address error:", err);
            res.status(500).json({ error: err.message });
        }
    });

    // Update an address
    app.put("/addresses/:id", async (req, res) => {
        try {
            const addressId = parseInt(req.params.id);
            if (isNaN(addressId)) {
                return res.status(400).json({ error: "Invalid address ID" });
            }
            
            const { label, door_no, street, area, city, state, pincode, landmark, latitude, longitude, is_default, userId } = req.body;

            if (is_default && userId) {
                await getPool().query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId]);
            }

            const updates = [];
            const params = [];

            const fields = ['label', 'door_no', 'street', 'area', 'city', 'state', 'pincode', 'landmark', 'latitude', 'longitude', 'is_default'];
            for (const field of fields) {
                if (req.body[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    params.push(req.body[field]);
                }
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: "No fields to update" });
            }

            params.push(addressId);
            await getPool().query(`UPDATE addresses SET ${updates.join(', ')} WHERE id = ?`, params);

            res.json({ success: true });
        } catch (err) {
            console.error("Update address error:", err);
            res.status(500).json({ error: err.message });
        }
    });

    // Delete an address
    app.delete("/addresses/:id", async (req, res) => {
        try {
            const addressId = parseInt(req.params.id);
            if (isNaN(addressId)) {
                return res.status(400).json({ error: "Invalid address ID" });
            }
            await getPool().query("DELETE FROM addresses WHERE id = ?", [addressId]);
            res.json({ success: true });
        } catch (err) {
            console.error("Delete address error:", err);
            res.status(500).json({ error: "Failed to delete address" });
        }
    });

    // Set default address
    app.put("/addresses/:id/set-default", async (req, res) => {
        try {
            const addressId = parseInt(req.params.id);
            const { userId } = req.body;

            console.log("Set default address:", addressId, userId);

            if (!userId) {
                return res.status(400).json({ error: "User ID required" });
            }

            if (isNaN(addressId)) {
                return res.status(400).json({ error: "Invalid address ID" });
            }

            const [result] = await getPool().query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId]);
            console.log("Reset default result:", result);

            const [result2] = await getPool().query("UPDATE addresses SET is_default = 1 WHERE id = ?", [addressId]);
            console.log("Set default result:", result2);

            res.json({ success: true, affectedRows: result2.affectedRows });
        } catch (err) {
            console.error("Set default address error:", err);
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = registerAddressRoutes;
