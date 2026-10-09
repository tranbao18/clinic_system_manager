const clients = new Set();

export function addClient(res, user) {
    const client = { res, user };
    clients.add(client);
    res.on('close', () => {
        clients.delete(client);
    });
    return client;
}

// Mỗi document thông báo có người nhận cụ thể (createForRole tạo 1 bản cho từng user)
// -> chỉ gửi cho đúng recipient_id; chỉ phát theo role khi thông báo không có recipient_id.
export function broadcastNotification(notification) {
    if (!notification) return;
    const rawRecipient = notification.recipient_id?._id ?? notification.recipient_id;
    const recipientId = rawRecipient ? String(rawRecipient) : null;
    const role = notification.recipient_role;

    for (const client of clients) {
        try {
            const { res, user } = client;
            if (!user) continue;
            const isTarget = recipientId
                ? String(user.sub) === recipientId
                : Boolean(role) && user.role === role;
            if (isTarget) sendEvent(res, notification);
        } catch (e) {
            console.warn('SSE broadcast error:', e.message || e);
        }
    }
}

function sendEvent(res, data) {
    if (res.writableEnded || res.destroyed) return;
    try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
        // ignore
    }
}
