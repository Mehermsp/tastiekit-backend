<<<<<<< HEAD
# yummly-backend
=======
Server setup (Node + MySQL)

1. Install dependencies

    npm install

2. Create MySQL database

    - Ensure MySQL server is running.
    - Run the SQL in `schema.sql` (for example using mysql client):

        mysql -u root -p < schema.sql

    - Or paste the contents of `schema.sql` into a MySQL GUI and execute.

3. Configure MySQL credentials in index.js (optional)

    The current defaults are:

    - host: 127.0.0.1
    - user: root
    - password: meher1234
    - database: yummly
    - port: 8000

4. Start server

    npm start

API Endpoints:

-   GET /ping - Health check
-   POST /auth/register { name, email, password } - Register new user
-   POST /auth/login { email, password } - Login user
-   GET /menu - Get all menu items
-   POST /orders { userId, items: [{id,name,price,qty}], total, paymentMethod } - Create order
-   GET /orders/:id - Get order details
-   POST /cart { userId, items: [{id,name,price,qty}] } - Save/update cart
-   GET /cart/:userId - Get user's cart
-   GET /user/:userId - Get user profile
-   POST /user/:userId/profile { name, phone, email } - Update user profile
-   GET /user/:userId/orders - Get user's orders

Database:

-   Uses MySQL with connection pooling
-   All data is persisted in the yummly database
-   Foreign key constraints ensure data integrity

This server is suitable for local development and testing.
>>>>>>> 677259f (Backend Ready)
