# TASTIEKIT DATABASE DOCUMENTATION

## Table of Contents
1. [Database Overview](#database-overview)
2. [User Roles](#user-roles)
3. [Table Relationships](#table-relationships)
4. [Foreign Key Reference](#foreign-key-reference)
5. [Data Flow Examples](#data-flow-examples)
6. [API Role-Based Access](#api-role-based-access)

---

## Database Overview

**Database Name:** `tastiekit` (or your existing database name)

**Total Tables:** 14

The database uses a clean relational structure where:
- Single `users` table with role-based differentiation
- All relationships use proper foreign keys
- Indexes on frequently queried columns
- ENUM types for status fields for data consistency

---

## User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `customer` | End users who order food | Own orders, own addresses, own cart |
| `restaurant_partner` | Restaurant owners | Own restaurant, own menu, own orders |
| `delivery_partner` | Delivery executives | Assigned deliveries, availability |
| `admin` | Platform administrators | All data, user management |

---

## Table Relationships

### 1. USERS (Central Table)
```
users.id (PK)
    ├── addresses.user_id (1-to-many)
    ├── orders.user_id (1-to-many)
    ├── restaurants.owner_id (1-to-many)
    ├── carts.user_id (1-to-many)
    ├── wishlists.user_id (1-to-many)
    ├── reviews.user_id (1-to-many)
    ├── notifications.user_id (1-to-many)
    └── orders.delivery_partner_id (1-to-many)
```

### 2. RESTAURANTS
```
restaurants.id (PK)
    ├── menu_items.restaurant_id (1-to-many) ← Each restaurant has many menu items
    ├── orders.restaurant_id (1-to-many) ← Each restaurant has many orders
    └── reviews.restaurant_id (1-to-many)
```

### 3. ORDERS (Hub Table)
```
orders.id (PK)
    ├── order_items.order_id (1-to-many) ← Order contains many items
    ├── delivery_assignments.order_id (1-to-many)
    └── reviews.order_id (1-to-many)
```

### 4. MENU_ITEMS
```
menu_items.id (PK)
    ├── order_items.menu_item_id (1-to-many)
    ├── carts.menu_item_id (1-to-many)
    └── wishlists.menu_item_id (1-to-many)
```

---

## Foreign Key Reference

| Table | Foreign Key | References | On Delete | Purpose |
|-------|-------------|------------|-----------|---------|
| `addresses` | user_id | users(id) | CASCADE | Delete addresses when user deleted |
| `restaurants` | owner_id | users(id) | CASCADE | Delete restaurant when owner deleted |
| `menu_items` | restaurant_id | restaurants(id) | CASCADE | Delete menu items when restaurant deleted |
| `orders` | user_id | users(id) | RESTRICT | Prevent deletion if orders exist |
| `orders` | restaurant_id | restaurants(id) | RESTRICT | Prevent deletion if orders exist |
| `orders` | delivery_partner_id | users(id) | SET NULL | Keep order if delivery partner deleted |
| `orders` | address_id | addresses(id) | RESTRICT | Prevent deletion if orders exist |
| `order_items` | order_id | orders(id) | CASCADE | Delete items when order deleted |
| `order_items` | menu_item_id | menu_items(id) | SET NULL | Keep item info if menu deleted |
| `carts` | user_id | users(id) | CASCADE | Clear cart when user deleted |
| `carts` | menu_item_id | menu_items(id) | CASCADE | Remove item if menu deleted |
| `wishlists` | user_id | users(id) | CASCADE | Clear wishlist when user deleted |
| `wishlists` | menu_item_id | menu_items(id) | CASCADE | Remove item if menu deleted |
| `delivery_assignments` | order_id | orders(id) | CASCADE | Delete assignment if order cancelled |
| `delivery_assignments` | delivery_partner_id | users(id) | CASCADE | Reassign if delivery partner deleted |
| `reviews` | order_id | orders(id) | CASCADE | Delete review if order deleted |
| `reviews` | user_id | users(id) | CASCADE | Delete review if user deleted |
| `reviews` | restaurant_id | restaurants(id) | CASCADE | Delete reviews if restaurant deleted |
| `notifications` | user_id | users(id) | CASCADE | Delete notifications if user deleted |
| `restaurant_applications` | owner_id | users(id) | CASCADE | Delete application if owner deleted |

---

## Data Flow Examples

### Flow 1: Customer Places Order

```
1. CUSTOMER LOGIN
   users (role='customer') → Auth via OTP

2. CUSTOMER ADDS ITEMS TO CART
   carts.user_id + carts.menu_item_id

3. CUSTOMER CHECKOUT
   - Select address (addresses.id)
   - Select payment method
   - Submit order

4. ORDER CREATED
   orders (status='placed')
        ↓
   order_items created (one per menu item)

5. RESTAURANT NOTIFIED
   - Restaurant sees order (via restaurant_id)
   - Updates status: placed → confirmed → preparing → ready

6. DELIVERY ASSIGNMENT
   - Admin/delivery system assigns delivery partner
   - delivery_assignments created
   - orders.delivery_partner_id set

7. DELIVERY PARTNER ACCEPTS
   - Updates status: assigned → accepted
   - Picks up: status = 'picked_up'
   - Delivers: status = 'delivered'

8. CUSTOMER RECEIVES
   - Order status = 'delivered'
   - Can leave review (reviews table)
```

### Flow 2: Restaurant Onboarding

```
1. RESTAURANT PARTNER REGISTERS
   users (role='restaurant_partner')

2. SUBMITS APPLICATION
   restaurant_applications created (status='pending')

3. ADMIN REVIEWS
   - Admin approves/rejects
   - status updated to 'approved'/'rejected'

4. RESTAURANT CREATED (on approval)
   restaurants created
   - owner_id = user.id
   - status = 'approved' (or 'pending' depending on workflow)

5. RESTAURANT ADDS MENU ITEMS
   menu_items created with restaurant_id
```

### Flow 3: Delivery Partner Workflow

```
1. DELIVERY PARTNER LOGIN
   users (role='delivery_partner')

2. SET AVAILABILITY
   users.is_available = 1/0

3. RECEIVE ASSIGNMENT
   delivery_assignments created by admin/system

4. ACCEPT/REJECT
   - Accept: status = 'accepted', accepted_at = NOW()
   - Reject: status = 'rejected', rejection_reason = text

5. PICK UP
   - Update order status to 'picked_up'
   - Update assignment pickup_time

6. DELIVER
   - Update order status to 'delivered'
   - Update assignment delivery_time
   - Order totals updated (restaurant revenue)
```

---

## API Role-Based Access

### Customer APIs
```
GET    /restaurants          - Browse restaurants
GET    /restaurants/:id/menu - View menu
POST   /cart                 - Add to cart
POST   /orders               - Place order
GET    /user/:id/orders      - My orders
GET    /addresses            - My addresses
POST   /addresses            - Save address
PUT    /orders/:id/cancel    - Cancel order
```

### Restaurant Partner APIs
```
GET    /restaurant/profile   - My restaurant
PUT    /restaurant/profile   - Update restaurant
GET    /restaurant/menu      - My menu items
POST   /restaurant/menu      - Add menu item
PUT    /restaurant/menu/:id  - Update menu item
DELETE /restaurant/menu/:id  - Delete menu item
GET    /restaurant/orders   - My orders
PUT    /restaurant/orders/:id/status - Update order status
```

### Delivery Partner APIs
```
GET    /delivery/orders      - My assigned orders
PUT    /delivery/availability - Set availability
PUT    /delivery/orders/:id/status - Update delivery status
GET    /delivery/income    - View earnings
```

### Admin APIs
```
GET    /admin/users         - All users
GET    /admin/restaurants   - All restaurants
PUT    /admin/restaurants/:id/approve - Approve restaurant
GET    /admin/orders        - All orders
PUT    /admin/orders/:id/assign - Assign delivery partner
GET    /admin/delivery-partners - Available delivery partners
```

---

## Important Notes

### 1. Address Handling
- Old schema: address stored directly in orders table (door_no, street, area, city, state, zip_code)
- New schema: addresses in separate table with foreign key
- **Migration**: Run the migration query to copy existing addresses

### 2. Order Status Flow
```
placed → confirmed → preparing → ready → picked_up → on_the_way → delivered
                    ↓ (can go to) → cancelled
```

### 3. Payment Status
- payment_status: pending → paid → (failed/refunded)
- payment_id: External payment gateway reference

### 4. Indexes for Performance
- users: role, phone
- restaurants: owner_id, city, status
- menu_items: restaurant_id, category, is_available
- orders: user_id, restaurant_id, delivery_partner_id, status, created_at
- order_items: order_id, menu_item_id

### 5. JSON Fields
- restaurants.cuisines: ["Indian", "Chinese", "Italian"]
- restaurants.days_open: ["Mon", "Tue", "Wed", "Thu", "Fri"]
- addresses stored as separate table, not JSON

---

## Quick Reference: Column Naming

### Changes from old to new:
| Old Column | New Column | Notes |
|------------|-----------|-------|
| menu | menu_items | Renamed table |
| menu.restaurant_id | menu_items.restaurant_id | Now FK |
| orders.driver | orders.delivery_partner_id | Renamed |
| orders.delivery_boy_id | orders.delivery_partner_id | Renamed |
| orders.address (text) | orders.address_id | Now FK to addresses |
| users.role='user' | users.role='customer' | More specific |
| users.role='restaurant_owner' | users.role='restaurant_partner' | Consistent |
| users.role='delivery' | users.role='delivery_partner' | Consistent |
| otp_codes | otp_verifications | Renamed |

---

## Production Notes

1. **Backup before running ALTER queries**
2. **Run migrations in order** (create new tables first, then migrate data)
3. **Test thoroughly** - especially order flow
4. **Monitor performance** - add more indexes if needed
5. **Consider partitioning** - for large orders table