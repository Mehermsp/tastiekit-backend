import mysql from "mysql2/promise";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

let pool;

export const initializeDatabase = async () => {
    pool = mysql.createPool({
        host: env.dbHost,
        port: env.dbPort,
        user: env.dbUser,
        password: env.dbPassword,
        database: env.dbName,
        waitForConnections: true,
        connectionLimit: env.dbPoolLimit || 20, // Increased for production
        queueLimit: 0,
        connectTimeout: env.dbConnectTimeout || 15000,
        acquireTimeout: 15000,
        decimalNumbers: true,
        ssl: env.dbSsl
            ? { rejectUnauthorized: env.dbSslRejectUnauthorized !== false }
            : undefined,
        timezone: "Z", // Important for consistent timestamps
    });

    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        logger.info("✅ MySQL connection pool initialized successfully");
    } catch (error) {
        logger.error("❌ Database connection failed", { error: error.message });
        throw error;
    }

    return pool;
};

export const getPool = () => {
    if (!pool)
        throw new Error(
            "Database pool not initialized. Call initializeDatabase() first."
        );
    return pool;
};

export const query = async (sql, params = []) => {
    try {
        const [rows] = await getPool().execute(sql, params);
        return rows;
    } catch (error) {
        logger.error("Database query error", {
            sql: sql.substring(0, 200),
            error: error.message,
        });
        throw error;
    }
};

export const getOne = async (sql, params = []) => {
    const rows = await query(sql, params);
    return rows[0] || null;
};

export const withTransaction = async (handler) => {
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        const result = await handler(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        logger.error("Transaction rolled back", { error: error.message });
        throw error;
    } finally {
        connection.release();
    }
};
