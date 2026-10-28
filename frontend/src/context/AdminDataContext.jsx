"use client";

import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import {
  props as seedProps,
  customers as seedCustomers,
  categories as seedCategories,
  seedStockMovements,
  seedEnquiries,
  seedWhatsAppConversations,
  seedNotifications,
  getPropsByCategory,
  getPropSKU,
  normalizePhone,
} from "@/data/firangi";

const AdminDataContext = createContext(null);

const STORAGE_KEYS = {
  props: "firangi_admin_props_v2",
  movements: "firangi_admin_stock_movements_v2",
  enquiries: "firangi_admin_enquiries_v2",
  whatsapp: "firangi_admin_whatsapp_v2",
  notifications: "firangi_admin_notifications_v2",
};

const loadStorage = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return fallback;
};

export const AdminDataProvider = ({ children }) => {
  // 1. Props with Physical Inventory Balances
  const [props, setProps] = useState(() => loadStorage(STORAGE_KEYS.props, seedProps));

  // 2. Physical Inventory Movement Transaction Ledger
  const [stockMovements, setStockMovements] = useState(() => loadStorage(STORAGE_KEYS.movements, seedStockMovements));

  // 3. Website Enquiries Inbox
  const [enquiries, setEnquiries] = useState(() => loadStorage(STORAGE_KEYS.enquiries, seedEnquiries));

  // 4. WhatsApp Two-Way Inbox
  const [waConversations, setWaConversations] = useState(() => loadStorage(STORAGE_KEYS.whatsapp, seedWhatsAppConversations));

  // 5. In-dashboard Notifications
  const [notifications, setNotifications] = useState(() => loadStorage(STORAGE_KEYS.notifications, seedNotifications));

  // 6. Customers & Categories
  const [customers] = useState(() => seedCustomers);
  const [categories, setCategories] = useState(() =>
    seedCategories.map((c) => ({ ...c, count: getPropsByCategory(c.slug).length })));

  // Persist to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.props, JSON.stringify(props));
      localStorage.setItem(STORAGE_KEYS.movements, JSON.stringify(stockMovements));
      localStorage.setItem(STORAGE_KEYS.enquiries, JSON.stringify(enquiries));
      localStorage.setItem(STORAGE_KEYS.whatsapp, JSON.stringify(waConversations));
      localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications));
    } catch (e) { /* ignore */ }
  }, [props, stockMovements, enquiries, waConversations, notifications]);

  // --------------------------------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------------------------------
  const addNotification = useCallback((notif) => {
    const newNotif = {
      id: `NOTIF-${Date.now().toString().slice(-5)}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...notif,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    return newNotif;
  }, []);

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);


  // --------------------------------------------------------------------------
  // PHYSICAL INVENTORY TRANSACTIONS (per PDF Section 7 & 8)
  // --------------------------------------------------------------------------

  // Stock-In / Receipt: +On-hand, +Available
  const receiveStock = useCallback((skuOrId, qty, referenceId = "", reason = "Stock Receipt", actor = "Admin") => {
    const quantity = Math.max(1, Number(qty) || 1);
    let targetProp = null;

    setProps((prev) => {
      return prev.map((p) => {
        if (p.id === skuOrId || p.sku === skuOrId) {
          const newOnHand = (p.onHand || 0) + quantity;
          const newReserved = p.reserved || 0;
          const newAvailable = Math.max(0, newOnHand - newReserved);
          targetProp = { ...p, onHand: newOnHand, reserved: newReserved, available: newAvailable };
          return targetProp;
        }
        return p;
      });
    });

    if (targetProp) {
      const movement = {
        id: `MOV-${Date.now().toString().slice(-4)}`,
        propId: targetProp.id,
        sku: targetProp.sku,
        propName: targetProp.name,
        movementType: "receipt",
        signedQty: quantity,
        onHandAfter: targetProp.onHand,
        reservedAfter: targetProp.reserved,
        availableAfter: targetProp.available,
        referenceId: referenceId || `PO-${Date.now().toString().slice(-4)}`,
        reason: reason || "Stock receipt",
        actor: actor || "Admin",
        createdAt: new Date().toISOString(),
      };
      setStockMovements((prev) => [movement, ...prev]);

      addNotification({
        type: "inventory",
        title: "Stock Received",
        message: `+${quantity} units of ${targetProp.name} (${targetProp.sku}) received into inventory.`,
        link: `/admin/inventory?sku=${targetProp.sku}`,
      });

      return { success: true, prop: targetProp };
    }
    return { success: false, error: "Prop not found" };
  }, [addNotification]);

  // Order Confirmation: Atomic Stock Reservation (+Reserved, -Available, On-hand unchanged)
  // Prevents double reservations and negative available stock!
  const confirmEnquiry = useCallback((enquiryId, actor = "Admin") => {
    const enq = enquiries.find((e) => e.id === enquiryId || e.reference === enquiryId);
    if (!enq) return { success: false, error: "Enquiry not found" };

    // Check available stock atomically for all items
    const shortages = [];
    enq.items.forEach((item) => {
      const p = props.find((x) => x.id === item.propId || x.sku === item.sku);
      const reqQty = item.quantity || 1;
      const avail = p ? (p.available ?? (p.onHand - p.reserved)) : 0;
      if (avail < reqQty) {
        shortages.push({
          name: item.name || (p ? p.name : item.sku),
          sku: item.sku,
          requested: reqQty,
          available: avail,
        });
      }
    });

    if (shortages.length > 0) {
      const details = shortages.map((s) => `${s.name} (Need: ${s.requested}, Avail: ${s.available})`).join(", ");
      return {
        success: false,
        error: `Insufficient available stock to confirm order: ${details}`,
        shortages,
      };
    }

    // All available stock is verified -> Commit reservation atomically
    const newMovements = [];
    setProps((prev) => {
      return prev.map((p) => {
        const matchingItem = enq.items.find((item) => item.propId === p.id || item.sku === p.sku);
        if (matchingItem) {
          const qty = matchingItem.quantity || 1;
          const newReserved = (p.reserved || 0) + qty;
          const newAvailable = Math.max(0, (p.onHand || 0) - newReserved);
          const updated = { ...p, reserved: newReserved, available: newAvailable };

          newMovements.push({
            id: `MOV-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900)}`,
            propId: p.id,
            sku: p.sku,
            propName: p.name,
            movementType: "reserve",
            signedQty: qty,
            onHandAfter: p.onHand,
            reservedAfter: newReserved,
            availableAfter: newAvailable,
            referenceId: enq.reference || enq.id,
            reason: `Order confirmed for ${enq.customer} (${enq.company || "Direct"})`,
            actor: actor || "Admin",
            createdAt: new Date().toISOString(),
          });

          return updated;
        }
        return p;
      });
    });

    if (newMovements.length) {
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    // Update enquiry status to 'won'
    setEnquiries((prev) =>
      prev.map((e) =>
        e.id === enq.id
          ? {
            ...e,
            status: "won",
            unread: false,
            history: [
              ...(e.history || []),
              {
                status: "won",
                actor: actor || "Admin",
                timestamp: new Date().toISOString(),
                notes: "Order confirmed & units reserved in inventory",
              },
            ],
          }
          : e
      )
    );

    addNotification({
      type: "enquiry",
      title: "Order Confirmed & Stock Reserved",
      message: `Enquiry ${enq.reference} confirmed for ${enq.customer}. Stock reserved.`,
      link: `/admin/enquiries?id=${enq.id}`,
    });

    return { success: true };
  }, [enquiries, props, addNotification]);

  // Dispatch Units: -On-hand, -Reserved, Available unchanged
  const dispatchOrder = useCallback((enquiryId, actor = "Admin") => {
    const enq = enquiries.find((e) => e.id === enquiryId || e.reference === enquiryId);
    if (!enq) return { success: false, error: "Enquiry not found" };

    const newMovements = [];
    setProps((prev) => {
      return prev.map((p) => {
        const item = enq.items.find((x) => x.propId === p.id || x.sku === p.sku);
        if (item) {
          const qty = item.quantity || 1;
          const newOnHand = Math.max(0, (p.onHand || 0) - qty);
          const newReserved = Math.max(0, (p.reserved || 0) - qty);
          const newAvailable = Math.max(0, newOnHand - newReserved);

          newMovements.push({
            id: `MOV-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900)}`,
            propId: p.id,
            sku: p.sku,
            propName: p.name,
            movementType: "dispatch",
            signedQty: -qty,
            onHandAfter: newOnHand,
            reservedAfter: newReserved,
            availableAfter: newAvailable,
            referenceId: `ORD-${enq.reference ? enq.reference.slice(-4) : enq.id}`,
            reason: `Dispatched for shoot (${enq.customer})`,
            actor: actor || "Admin",
            createdAt: new Date().toISOString(),
          });

          return { ...p, onHand: newOnHand, reserved: newReserved, available: newAvailable };
        }
        return p;
      });
    });

    if (newMovements.length) {
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    setEnquiries((prev) =>
      prev.map((e) =>
        e.id === enq.id
          ? {
            ...e,
            status: "active",
            history: [
              ...(e.history || []),
              {
                status: "active",
                actor: actor || "Admin",
                timestamp: new Date().toISOString(),
                notes: "Order dispatched to shoot location",
              },
            ],
          }
          : e
      )
    );

    return { success: true };
  }, [enquiries]);

  // Return Units: +On-hand, +Available
  const returnOrder = useCallback((enquiryId, actor = "Admin") => {
    const enq = enquiries.find((e) => e.id === enquiryId || e.reference === enquiryId);
    if (!enq) return { success: false, error: "Enquiry not found" };

    const newMovements = [];
    setProps((prev) => {
      return prev.map((p) => {
        const item = enq.items.find((x) => x.propId === p.id || x.sku === p.sku);
        if (item) {
          const qty = item.quantity || 1;
          const newOnHand = (p.onHand || 0) + qty;
          const newReserved = Math.max(0, p.reserved || 0);
          const newAvailable = Math.max(0, newOnHand - newReserved);

          newMovements.push({
            id: `MOV-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900)}`,
            propId: p.id,
            sku: p.sku,
            propName: p.name,
            movementType: "return",
            signedQty: qty,
            onHandAfter: newOnHand,
            reservedAfter: newReserved,
            availableAfter: newAvailable,
            referenceId: `RET-${enq.reference ? enq.reference.slice(-4) : enq.id}`,
            reason: `Returned from shoot in good condition (${enq.customer})`,
            actor: actor || "Admin",
            createdAt: new Date().toISOString(),
          });

          return { ...p, onHand: newOnHand, reserved: newReserved, available: newAvailable };
        }
        return p;
      });
    });

    if (newMovements.length) {
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    setEnquiries((prev) =>
      prev.map((e) =>
        e.id === enq.id
          ? {
            ...e,
            status: "returned",
            history: [
              ...(e.history || []),
              {
                status: "returned",
                actor: actor || "Admin",
                timestamp: new Date().toISOString(),
                notes: "Items returned to atelier and restocked",
              },
            ],
          }
          : e
      )
    );

    return { success: true };
  }, [enquiries]);

  // Cancel Order: -Reserved, +Available (releases reserved stock)
  const cancelEnquiry = useCallback((enquiryId, actor = "Admin") => {
    const enq = enquiries.find((e) => e.id === enquiryId || e.reference === enquiryId);
    if (!enq) return { success: false, error: "Enquiry not found" };

    if (enq.status === "won" || enq.status === "confirmed") {
      const newMovements = [];
      setProps((prev) => {
        return prev.map((p) => {
          const item = enq.items.find((x) => x.propId === p.id || x.sku === p.sku);
          if (item) {
            const qty = item.quantity || 1;
            const newReserved = Math.max(0, (p.reserved || 0) - qty);
            const newAvailable = Math.max(0, (p.onHand || 0) - newReserved);

            newMovements.push({
              id: `MOV-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900)}`,
              propId: p.id,
              sku: p.sku,
              propName: p.name,
              movementType: "reserve",
              signedQty: -qty,
              onHandAfter: p.onHand,
              reservedAfter: newReserved,
              availableAfter: newAvailable,
              referenceId: `CAN-${enq.reference ? enq.reference.slice(-4) : enq.id}`,
              reason: `Reservation cancelled (${enq.customer})`,
              actor: actor || "Admin",
              createdAt: new Date().toISOString(),
            });

            return { ...p, reserved: newReserved, available: newAvailable };
          }
          return p;
        });
      });

      if (newMovements.length) {
        setStockMovements((prev) => [...newMovements, ...prev]);
      }
    }

    setEnquiries((prev) =>
      prev.map((e) =>
        e.id === enq.id
          ? {
            ...e,
            status: "lost",
            history: [
              ...(e.history || []),
              {
                status: "lost",
                actor: actor || "Admin",
                timestamp: new Date().toISOString(),
                notes: "Enquiry marked lost / cancelled",
              },
            ],
          }
          : e
      )
    );

    return { success: true };
  }, [enquiries]);

  // Stock Count Reconciliation: correction entry rather than erasing history!
  const reconcileStock = useCallback((skuOrId, physicalCount, reason = "Annual stocktake discrepancy", actor = "Admin") => {
    const count = Math.max(0, Number(physicalCount) || 0);
    let targetProp = null;
    let diff = 0;

    setProps((prev) => {
      return prev.map((p) => {
        if (p.id === skuOrId || p.sku === skuOrId) {
          diff = count - (p.onHand || 0);
          const newOnHand = count;
          const newReserved = p.reserved || 0;
          const newAvailable = Math.max(0, newOnHand - newReserved);
          targetProp = { ...p, onHand: newOnHand, reserved: newReserved, available: newAvailable };
          return targetProp;
        }
        return p;
      });
    });

    if (targetProp && diff !== 0) {
      const movement = {
        id: `MOV-${Date.now().toString().slice(-4)}`,
        propId: targetProp.id,
        sku: targetProp.sku,
        propName: targetProp.name,
        movementType: "adjustment",
        signedQty: diff,
        onHandAfter: targetProp.onHand,
        reservedAfter: targetProp.reserved,
        availableAfter: targetProp.available,
        referenceId: `ADJ-${Date.now().toString().slice(-4)}`,
        reason: reason || "Stock count reconciliation",
        actor: actor || "Admin",
        createdAt: new Date().toISOString(),
      };
      setStockMovements((prev) => [movement, ...prev]);

      addNotification({
        type: "inventory",
        title: "Stock Reconciled",
        message: `${targetProp.sku} reconciled by ${diff > 0 ? `+${diff}` : diff} units. Current on-hand: ${count}.`,
        link: `/admin/inventory?sku=${targetProp.sku}`,
      });

      return { success: true, diff, prop: targetProp };
    }
    return { success: !!targetProp, diff: 0, prop: targetProp };
  }, [addNotification]);

  // Damage / Quarantined Write-off: -On-hand, -Available
  const writeOffStock = useCallback((skuOrId, qty = 1, reason = "Damaged during shoot", actor = "Admin") => {
    const quantity = Math.max(1, Number(qty) || 1);
    let targetProp = null;

    setProps((prev) => {
      return prev.map((p) => {
        if (p.id === skuOrId || p.sku === skuOrId) {
          const newOnHand = Math.max(0, (p.onHand || 0) - quantity);
          const newReserved = p.reserved || 0;
          const newAvailable = Math.max(0, newOnHand - newReserved);
          targetProp = { ...p, onHand: newOnHand, reserved: newReserved, available: newAvailable };
          return targetProp;
        }
        return p;
      });
    });

    if (targetProp) {
      const movement = {
        id: `MOV-${Date.now().toString().slice(-4)}`,
        propId: targetProp.id,
        sku: targetProp.sku,
        propName: targetProp.name,
        movementType: "write_off",
        signedQty: -quantity,
        onHandAfter: targetProp.onHand,
        reservedAfter: targetProp.reserved,
        availableAfter: targetProp.available,
        referenceId: `DMG-${Date.now().toString().slice(-4)}`,
        reason: reason || "Damaged prop write-off",
        actor: actor || "Admin",
        createdAt: new Date().toISOString(),
      };
      setStockMovements((prev) => [movement, ...prev]);

      addNotification({
        type: "inventory",
        title: "Prop Written Off",
        message: `-${quantity} unit of ${targetProp.sku} written off (${reason}).`,
        link: `/admin/inventory?sku=${targetProp.sku}`,
      });

      return { success: true, prop: targetProp };
    }
    return { success: false, error: "Prop not found" };
  }, [addNotification]);

  // --------------------------------------------------------------------------
  // ENQUIRY CART SUBMISSION & STATUS MANAGEMENT (per PDF Section 4 & 5)
  // --------------------------------------------------------------------------
  const addEnquiry = useCallback((enquiryData) => {
    const refNum = Math.floor(1000 + Math.random() * 9000);
    const reference = `ENQ-2026-${refNum}`;
    const id = `ENQ-${refNum}`;

    const newEnquiry = {
      id,
      reference,
      source: enquiryData.source || "website",
      customer: enquiryData.name || enquiryData.customer || "Anonymous Client",
      company: enquiryData.company || "",
      email: enquiryData.email || "",
      phone: enquiryData.phone || "",
      normalizedPhone: normalizePhone(enquiryData.phone),
      shootType: enquiryData.shootType || "Product Photography",
      delivery: enquiryData.delivery || "Studio delivery",
      location: enquiryData.location || "Studio floor",
      notes: enquiryData.notes || "",
      consentGiven: !!enquiryData.consentGiven,
      status: "new",
      unread: true,
      items: enquiryData.items || [],
      startDate: enquiryData.startDate || new Date().toISOString().slice(0, 10),
      endDate: enquiryData.endDate || new Date().toISOString().slice(0, 10),
      days: enquiryData.days || 1,
      subtotal: enquiryData.subtotal || 0,
      createdAt: new Date().toISOString(),
      history: [
        {
          status: "new",
          actor: "Customer",
          timestamp: new Date().toISOString(),
          notes: `Enquiry submitted with ${(enquiryData.items || []).length} items`,
        },
      ],
    };

    setEnquiries((prev) => [newEnquiry, ...prev]);

    // Add alert notification
    addNotification({
      type: "enquiry",
      title: "New Website Enquiry",
      message: `${newEnquiry.customer} submitted enquiry ${reference} (₹${newEnquiry.subtotal.toLocaleString("en-IN")})`,
      link: `/admin/enquiries?tab=website&id=${id}`,
    });

    return newEnquiry;
  }, [addNotification]);

  const updateEnquiryStatus = useCallback((enquiryId, status, notes = "", actor = "Admin") => {
    setEnquiries((prev) =>
      prev.map((e) =>
        e.id === enquiryId || e.reference === enquiryId
          ? {
            ...e,
            status,
            unread: false,
            history: [
              ...(e.history || []),
              {
                status,
                actor: actor || "Admin",
                timestamp: new Date().toISOString(),
                notes: notes || `Status updated to ${status}`,
              },
            ],
          }
          : e
      )
    );
  }, []);

  const deleteEnquiry = useCallback((enquiryId, actor = "Admin") => {
    const enq = enquiries.find((e) => e.id === enquiryId || e.reference === enquiryId);
    if (!enq) return { success: false, error: "Enquiry not found" };

    // If deleting an order that currently holds reservations, release reserved units
    if (enq.status === "won" || enq.status === "confirmed") {
      const newMovements = [];
      setProps((prev) => {
        return prev.map((p) => {
          const item = enq.items?.find((x) => x.propId === p.id || x.sku === p.sku);
          if (item) {
            const qty = item.quantity || 1;
            const newReserved = Math.max(0, (p.reserved || 0) - qty);
            const newAvailable = Math.max(0, (p.onHand || 0) - newReserved);

            newMovements.push({
              id: `MOV-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900)}`,
              propId: p.id,
              sku: p.sku,
              propName: p.name,
              movementType: "reserve",
              signedQty: -qty,
              onHandAfter: p.onHand,
              reservedAfter: newReserved,
              availableAfter: newAvailable,
              referenceId: `DEL-${enq.reference ? enq.reference.slice(-4) : enq.id}`,
              reason: `Reservation released upon enquiry deletion (${enq.customer})`,
              actor: actor || "Admin",
              createdAt: new Date().toISOString(),
            });

            return { ...p, reserved: newReserved, available: newAvailable };
          }
          return p;
        });
      });

      if (newMovements.length) {
        setStockMovements((prev) => [...newMovements, ...prev]);
      }
    }

    setEnquiries((prev) => prev.filter((e) => e.id !== enq.id && e.reference !== enq.id));

    // Decouple any WhatsApp conversation linking to this enquiry
    setWaConversations((prev) =>
      prev.map((c) =>
        c.linkedEnquiryRef === enq.reference || c.linkedEnquiryRef === enq.id
          ? { ...c, linkedEnquiryRef: null }
          : c
      )
    );

    addNotification({
      type: "enquiry",
      title: "Enquiry Deleted",
      message: `Enquiry ${enq.reference || enq.id} (${enq.customer}) was permanently removed.`,
      link: `/admin/enquiries`,
    });

    return { success: true };
  }, [enquiries, addNotification]);

  // --------------------------------------------------------------------------
  // WHATSAPP TWO-WAY INBOX (per PDF Section 5 & 6)
  // --------------------------------------------------------------------------
  const sendWhatsAppMessage = useCallback((conversationId, text, actor = "Admin") => {
    if (!text || !text.trim()) return;
    const msgId = `wam-${Date.now().toString().slice(-4)}`;
    const newMsg = {
      id: msgId,
      direction: "outbound",
      text: text.trim(),
      timestamp: new Date().toISOString(),
      deliveryState: "delivered",
    };

    setWaConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            status: conv.status === "unread" ? "open" : conv.status,
            unreadCount: 0,
            lastActivity: new Date().toISOString(),
            messages: [...(conv.messages || []), newMsg],
          };
        }
        return conv;
      })
    );

    return newMsg;
  }, []);

  // Simulator for inbound Meta webhook messages
  const simulateInboundWhatsApp = useCallback((phone, text, customerName = "") => {
    if (!text || !text.trim()) return;
    const normPhone = normalizePhone(phone);
    const msgId = `wam-in-${Date.now().toString().slice(-4)}`;
    const newMsg = {
      id: msgId,
      metaId: `wamid.HBgM${normPhone}FQIAERgS${Math.random().toString(36).substring(2, 9).toUpperCase()}...`,
      direction: "inbound",
      text: text.trim(),
      timestamp: new Date().toISOString(),
      deliveryState: "delivered",
    };

    setWaConversations((prev) => {
      const existing = prev.find((c) => c.normalizedPhone === normPhone || c.phone === phone);
      if (existing) {
        return prev.map((c) =>
          c.id === existing.id
            ? {
              ...c,
              status: "unread",
              unreadCount: (c.unreadCount || 0) + 1,
              lastActivity: new Date().toISOString(),
              messages: [...(c.messages || []), newMsg],
            }
            : c
        );
      } else {
        // Create new conversation
        const newConv = {
          id: `WA-CONV-${Date.now().toString().slice(-4)}`,
          customerName: customerName || `Client (${phone})`,
          company: "",
          phone,
          normalizedPhone: normPhone,
          status: "unread",
          unreadCount: 1,
          lastActivity: new Date().toISOString(),
          linkedEnquiryRef: null,
          messages: [newMsg],
        };
        return [newConv, ...prev];
      }
    });

    addNotification({
      type: "whatsapp",
      title: "New WhatsApp Message",
      message: `${customerName || phone}: "${text.slice(0, 50)}${text.length > 50 ? "…" : ""}"`,
      link: `/admin/enquiries?tab=whatsapp`,
    });

    return newMsg;
  }, [addNotification]);

  const updateWhatsAppStatus = useCallback((conversationId, status) => {
    setWaConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, status, unreadCount: status === "closed" ? 0 : c.unreadCount } : c))
    );
  }, []);

  const deleteWhatsAppConversation = useCallback((conversationId) => {
    const conv = waConversations.find((c) => c.id === conversationId);
    if (!conv) return { success: false, error: "Conversation not found" };

    setWaConversations((prev) => prev.filter((c) => c.id !== conversationId));

    addNotification({
      type: "whatsapp",
      title: "Conversation Deleted",
      message: `Chat thread with ${conv.customerName} (${conv.phone}) was deleted.`,
      link: `/admin/enquiries?tab=whatsapp`,
    });

    return { success: true };
  }, [waConversations, addNotification]);

  // --------------------------------------------------------------------------
  // PROP CRUD (with SKU and Physical Inventory)
  // --------------------------------------------------------------------------
  const addProp = useCallback((data) => {
    setProps((prev) => {
      const id = `fr-${String(prev.length + 1).padStart(3, "0")}-${Date.now().toString().slice(-4)}`;
      const onHand = Number(data.onHand ?? data.quantity ?? 1);
      const reserved = 0;
      const available = onHand;
      const cat = data.category || "decorative-objects";
      const sku = data.sku || getPropSKU({ id, category: cat }, prev.length);

      const prop = {
        id,
        sku,
        slug: (data.name || "new-prop").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: data.name || "Untitled Prop",
        category: cat,
        description: data.description || "",
        pricePerDay: Number(data.pricePerDay) || 500,
        images: data.images && data.images.length ? data.images : [seedProps[0].images[0]],
        color: data.color || "Neutral",
        material: data.material || "\u2014",
        dimensions: data.dimensions || "\u2014",
        condition: data.condition || "Excellent",
        style: data.style || "Contemporary",
        shootTypes: data.shootTypes && data.shootTypes.length ? data.shootTypes : ["Product Photography"],
        availability: available > 0 ? "available" : "reserved",
        rentalCount: 0,
        featured: false,
        tags: [],
        onHand,
        reserved,
        available,
        reorderLevel: Number(data.reorderLevel) || 2,
        location: data.location || "Warehouse 1 \u00B7 Bay A-1",
        supplier: data.supplier || "Studio Frangipani Atelier",
        costPrice: Number(data.costPrice) || Math.round((Number(data.pricePerDay) || 500) * 3),
        unitOfMeasure: "Unit",
        quantity: onHand,
      };

      // Record initial receipt movement
      setStockMovements((m) => [
        {
          id: `MOV-${Date.now().toString().slice(-4)}`,
          propId: id,
          sku,
          propName: prop.name,
          movementType: "receipt",
          signedQty: onHand,
          onHandAfter: onHand,
          reservedAfter: 0,
          availableAfter: onHand,
          referenceId: `INIT-${id}`,
          reason: "New prop added to catalogue",
          actor: "Admin",
          createdAt: new Date().toISOString(),
        },
        ...m,
      ]);

      return [prop, ...prev];
    });
  }, []);

  const updateProp = useCallback((id, patch) => {
    setProps((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const onHand = patch.onHand != null ? Number(patch.onHand) : p.onHand;
          const reserved = patch.reserved != null ? Number(patch.reserved) : p.reserved;
          const available = Math.max(0, onHand - reserved);
          return {
            ...p,
            ...patch,
            pricePerDay: patch.pricePerDay != null ? Number(patch.pricePerDay) : p.pricePerDay,
            onHand,
            reserved,
            available,
            quantity: onHand,
          };
        }
        return p;
      })
    );
  }, []);

  const deleteProp = useCallback((id) => {
    setProps((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // --------------------------------------------------------------------------
  // CATEGORIES CRUD
  // --------------------------------------------------------------------------
  const addCategory = useCallback((data) => {
    setCategories((prev) => {
      const slug = (data.name || "new-category").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return [
        {
          slug: `${slug}-${Date.now().toString().slice(-4)}`,
          name: data.name || "Untitled Category",
          description: data.description || "",
          image: data.image || seedCategories[0].image,
          count: 0,
        },
        ...prev,
      ];
    });
  }, []);

  const updateCategory = useCallback((slug, patch) => {
    setCategories((prev) => prev.map((c) => (c.slug === slug ? { ...c, ...patch } : c)));
  }, []);

  const deleteCategory = useCallback((slug) => {
    setCategories((prev) => prev.filter((c) => c.slug !== slug));
  }, []);

  // --------------------------------------------------------------------------
  // BACKWARDS COMPATIBILITY (requests alias for enquiries)
  // --------------------------------------------------------------------------
  const requests = useMemo(() => {
    return enquiries.map((e) => ({
      id: e.id,
      customer: e.customer,
      company: e.company,
      email: e.email,
      phone: e.phone,
      items: (e.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0),
      propNames: (e.items || []).map((x) => x.name || x.propName || x.sku),
      startDate: e.startDate,
      endDate: e.endDate,
      total: e.subtotal,
      status: e.status === "won" ? "confirmed" : (e.status === "lost" ? "cancelled" : (e.status === "new" ? "pending" : e.status)),
      shootType: e.shootType,
      delivery: e.delivery,
      location: e.location,
      notes: e.notes,
      createdAt: e.createdAt,
    }));
  }, [enquiries]);

  const updateRequestStatus = useCallback((id, status) => {
    const mapped = status === "confirmed" ? "won" : (status === "cancelled" ? "lost" : (status === "pending" ? "new" : status));
    updateEnquiryStatus(id, mapped);
  }, [updateEnquiryStatus]);

  // Total unread alerts count
  const unreadAlertsCount = useMemo(() => {
    const unreadEnquiries = enquiries.filter((e) => e.unread || e.status === "new").length;
    const unreadWA = waConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    const unreadNotifs = notifications.filter((n) => !n.read).length;
    return unreadEnquiries + unreadWA + unreadNotifs;
  }, [enquiries, waConversations, notifications]);

  // Low stock props count
  const lowStockCount = useMemo(() => {
    return props.filter((p) => (p.available ?? 0) <= (p.reorderLevel ?? 2)).length;
  }, [props]);

  const value = useMemo(
    () => ({
      // Data
      props,
      stockMovements,
      enquiries,
      waConversations,
      notifications,
      customers,
      categories,
      requests,
      unreadAlertsCount,
      lowStockCount,

      // Inventory operations
      receiveStock,
      confirmEnquiry,
      dispatchOrder,
      returnOrder,
      cancelEnquiry,
      reconcileStock,
      writeOffStock,

      // Enquiry operations
      addEnquiry,
      updateEnquiryStatus,
      deleteEnquiry,

      // WhatsApp operations
      sendWhatsAppMessage,
      simulateInboundWhatsApp,
      updateWhatsAppStatus,
      deleteWhatsAppConversation,

      // Notification operations
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,

      // Prop CRUD
      addProp,
      updateProp,
      deleteProp,

      // Category CRUD
      addCategory,
      updateCategory,
      deleteCategory,

      // Legacy support
      updateRequestStatus,
    }),
    [
      props,
      stockMovements,
      enquiries,
      waConversations,
      notifications,
      customers,
      categories,
      requests,
      unreadAlertsCount,
      lowStockCount,
      receiveStock,
      confirmEnquiry,
      dispatchOrder,
      returnOrder,
      cancelEnquiry,
      reconcileStock,
      writeOffStock,
      addEnquiry,
      updateEnquiryStatus,
      deleteEnquiry,
      sendWhatsAppMessage,
      simulateInboundWhatsApp,
      updateWhatsAppStatus,
      deleteWhatsAppConversation,
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      addProp,
      updateProp,
      deleteProp,
      addCategory,
      updateCategory,
      deleteCategory,
      updateRequestStatus,
    ]
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
};

export const useAdminData = () => {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error("useAdminData must be used within AdminDataProvider");
  return ctx;
};

