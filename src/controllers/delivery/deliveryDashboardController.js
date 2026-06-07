import { asyncHandler } from "../../utils/asyncHandler.js";

import { AppError, sendSuccess } from "../../utils/http.js";

import { updateDeliveryAvailability } from "../../models/userModel.js";

import {
    getDeliveryPartnerStats,
    getOrderById,
    getOrderItemsForOrderIds,
    listDeliveryAssignments,
} from "../../models/orderModel.js";

const attachItemsToAssignments = async (assignments) => {
    const orderIds = assignments.map((assignment) => assignment.order_id);
    const items = await getOrderItemsForOrderIds(orderIds);
    const itemsByOrderId = items.reduce((map, item) => {
        const key = String(item.order_id);
        const orderItems = map.get(key) || [];
        orderItems.push(item);
        map.set(key, orderItems);
        return map;
    }, new Map());

    return assignments.map((assignment) => ({
        ...assignment,
        items: itemsByOrderId.get(String(assignment.order_id)) || [],
    }));
};

export const getDeliveryDashboard = asyncHandler(async (req, res) => {
    const assignments = await listDeliveryAssignments(req.user.id);
    const assignmentsWithItems = await attachItemsToAssignments(assignments);

    const stats = await getDeliveryPartnerStats(req.user.id);

    sendSuccess(
        res,
        {
            profile: req.user,

            openOrders: [],

            assignments: assignmentsWithItems,

            stats,
        },
        "Delivery dashboard fetched successfully"
    );
});

export const getDeliveryOrders = asyncHandler(async (req, res) => {
    const assignments = await listDeliveryAssignments(req.user.id);
    const assignmentsWithItems = await attachItemsToAssignments(assignments);

    const ordersWithItems = await Promise.all(
        assignmentsWithItems.map(async (assignment) => {
            const order = await getOrderById(assignment.order_id);

            return {
                ...assignment,
                ...order,
            };
        })
    );

    sendSuccess(res, ordersWithItems, "Delivery orders fetched successfully");
});

export const getDeliveryIncome = asyncHandler(async (req, res) => {
    const assignments = await listDeliveryAssignments(req.user.id);

    const totalIncome = assignments
        .filter((a) => a.assignment_status === "delivered")
        .reduce((sum, a) => sum + Number(a.total || 0) * 0.1, 0);

    sendSuccess(
        res,
        {
            totalDeliveries: assignments.filter(
                (a) => a.assignment_status === "delivered"
            ).length,

            totalIncome: Number(totalIncome.toFixed(2)),
        },
        "Delivery income fetched successfully"
    );
});

export const setDeliveryAvailability = asyncHandler(async (req, res) => {
    const isAvailable = Boolean(req.body.isAvailable);

    if (!isAvailable) {
        const assignments = await listDeliveryAssignments(req.user.id);

        const activeOrders = assignments.filter(
            (a) =>
                !["delivered", "rejected", "cancelled"].includes(
                    a.assignment_status
                )
        );

        if (activeOrders.length > 0) {
            throw new AppError(
                400,
                `Cannot go offline: You have ${activeOrders.length} active/pending order(s).`
            );
        }
    }

    await updateDeliveryAvailability(req.user.id, isAvailable);

    sendSuccess(
        res,
        {
            ...req.user,

            is_available: isAvailable,
        },
        isAvailable
            ? "You are now online and ready for deliveries"
            : "You are now offline"
    );
});
