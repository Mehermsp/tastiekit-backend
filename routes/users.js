const multer = require("multer");
const { uploadImage, deleteImage } = require("../utils/cloudinary.js");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file?.mimetype?.startsWith("image/")) {
            return cb(null, true);
        }
        cb(new Error("Only image files are allowed"));
    },
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-()\s]{7,20}$/;

function isSafeHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function registerUserRoutes(app, { getPool, requireSelfOrAdmin }) {
    app.get("/user/:userId", requireSelfOrAdmin, async (req, res) => {
        const userId = parseInt(req.params.userId);

        const [rows] = await getPool().query(
            "SELECT id,name,email,phone,role,profile_image,profile_image_public_id,addresses FROM users WHERE id = ?",
            [userId]
        );

        if (!rows.length) return res.status(404).json({ error: "Not found" });

        // Parse JSON safely
        const user = rows[0];
        try {
            user.addresses = user.addresses ? JSON.parse(user.addresses) : [];
        } catch {
            user.addresses = [];
        }

        res.json({ user });
    });

    app.post(
        "/user/:userId/profile-photo",
        requireSelfOrAdmin,
        (req, res, next) => {
            upload.single("photo")(req, res, (err) => {
                if (!err) return next();
                if (err?.code === "LIMIT_FILE_SIZE") {
                    return res
                        .status(400)
                        .json({ error: "Image must be smaller than 3MB" });
                }
                return res.status(400).json({
                    error: err.message || "Invalid image upload",
                });
            });
        },
        async (req, res) => {
            try {
                const userId = parseInt(req.params.userId, 10);
                if (!userId || Number.isNaN(userId)) {
                    return res.status(400).json({ error: "Invalid user id" });
                }

                if (!req.file) {
                    return res.status(400).json({ error: "No file uploaded" });
                }

                const [users] = await getPool().query(
                    "SELECT profile_image_public_id FROM users WHERE id = ?",
                    [userId]
                );

                if (!users.length) {
                    return res.status(404).json({ error: "User not found" });
                }

                const uploadResult = await uploadImage(
                    req.file.buffer,
                    "user_profile",
                    `user_${userId}_profile`
                );

                const oldPublicId = users[0].profile_image_public_id;
                if (oldPublicId && oldPublicId !== uploadResult.publicId) {
                    await deleteImage(oldPublicId).catch(() => null);
                }

                await getPool().query(
                    "UPDATE users SET profile_image = ?, profile_image_public_id = ? WHERE id = ?",
                    [uploadResult.url, uploadResult.publicId, userId]
                );

                const [rows] = await getPool().query(
                    "SELECT id,name,email,phone,role,profile_image,profile_image_public_id,addresses FROM users WHERE id = ?",
                    [userId]
                );

                const user = rows[0];
                try {
                    user.addresses = user.addresses
                        ? JSON.parse(user.addresses)
                        : [];
                } catch {
                    user.addresses = [];
                }

                res.json({
                    user,
                    photo: {
                        url: uploadResult.url,
                        publicId: uploadResult.publicId,
                    },
                });
            } catch (err) {
                console.error("Profile photo upload error:", err);
                res.status(500).json({ error: "Failed to upload profile photo" });
            }
        }
    );

    app.post("/user/:userId/profile", requireSelfOrAdmin, async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            const {
                name,
                phone,
                email,
                profile_image,
                profile_image_public_id,
                addresses,
            } = req.body;
            const normalizedPhone =
                typeof phone === "string" ? phone.trim() : phone;

            if (typeof phone !== "undefined" && !normalizedPhone) {
                return res
                    .status(400)
                    .json({ error: "Phone number is required" });
            }

            if (email) {
                const normalizedEmail = String(email).trim().toLowerCase();
                if (!EMAIL_REGEX.test(normalizedEmail)) {
                    return res.status(400).json({ error: "Invalid email" });
                }
                const [existing] = await getPool().query(
                    "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?",
                    [normalizedEmail, userId]
                );
                if (existing.length) {
                    return res
                        .status(400)
                        .json({ error: "Email already in use" });
                }
            }
            if (
                typeof normalizedPhone === "string" &&
                normalizedPhone &&
                !PHONE_REGEX.test(normalizedPhone)
            ) {
                return res.status(400).json({ error: "Invalid phone number" });
            }
            if (
                typeof profile_image === "string" &&
                profile_image.trim() &&
                !isSafeHttpUrl(profile_image.trim())
            ) {
                return res
                    .status(400)
                    .json({ error: "Invalid profile image URL" });
            }

            const updates = [];
            const params = [];

            if (typeof name !== "undefined") {
                updates.push("name = ?");
                params.push(name || "");
            }
            if (typeof phone !== "undefined") {
                updates.push("phone = ?");
                params.push(normalizedPhone);
            }
            if (typeof email !== "undefined") {
                updates.push("email = ?");
                params.push(email ? String(email).trim().toLowerCase() : "");
            }
            if (typeof profile_image !== "undefined") {
                updates.push("profile_image = ?");
                params.push(profile_image || null);
            }
            if (typeof profile_image_public_id !== "undefined") {
                updates.push("profile_image_public_id = ?");
                params.push(profile_image_public_id || null);
            }
            if (typeof addresses !== "undefined") {
                updates.push("addresses = ?");
                params.push(JSON.stringify(addresses || []));
            }

            if (updates.length) {
                const sql = `UPDATE users SET ${updates.join(
                    ", "
                )} WHERE id = ?`;
                params.push(userId);
                await getPool().query(sql, params);
            }

            const [rows] = await getPool().query(
                "SELECT id,name,email,phone,role,profile_image,profile_image_public_id,addresses FROM users WHERE id = ?",
                [userId]
            );

            const user = rows[0];
            try {
                user.addresses = user.addresses ? JSON.parse(user.addresses) : [];
            } catch {
                user.addresses = [];
            }
            res.json({ user });
        } catch (err) {
            console.error("Profile update error:", err);
            res.status(500).json({ error: "Failed to update profile" });
        }
    });
}

module.exports = registerUserRoutes;
