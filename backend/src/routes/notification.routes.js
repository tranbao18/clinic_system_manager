import express from 'express';
import jwt from 'jsonwebtoken';
const router = express.Router();

import ctrl from '../controllers/notification.controller.js';
import auth from '../../middleware/auth.middleware.js';
import validate from '../utils/validate.js';
import validator from '../validators/notification.validator.js';
import TokenBlacklist from '../models/token-blacklist.model.js';
import User from '../models/user.model.js';
import { addClient } from '../utils/notification-broadcaster.js';

const SSE_KEEP_ALIVE_MS = 20000;

router.post('/', auth(["Admin"]), validator.createNotification(), validate, ctrl.create);

router.get('/unread-count', auth([]), ctrl.getUnreadCount);
router.get('/', auth([]), validator.getNotifications(), validate, ctrl.findAll);

router.put('/:id/read', auth([]), validator.markAsRead(), validate, ctrl.markAsRead);
router.put('/read-all', auth([]), ctrl.markAllAsRead);

router.delete('/:id', auth([]), ctrl.remove);
router.put('/:id/restore', auth("Admin"), ctrl.restore);

// Kế thừa
// SSE chỉ dùng được khi server chạy lâu dài (app.js); trên Vercel serverless frontend không dùng route này.
// EventSource không gửi được header nên token đi qua query string -> tuyệt đối không ghi log token.
router.get('/stream', async (req, res) => {
    try {
        const token = req.query.token;
        if (typeof token !== 'string' || !token) {
            return res.status(401).json({ message: 'No token' });
        }

        // Kiểm tra giống auth middleware: token bị thu hồi, chữ ký/thuật toán, tài khoản bị khóa/xóa
        const blacklisted = await TokenBlacklist.findOne({ token });
        if (blacklisted) return res.status(401).json({ message: 'Token đã bị thu hồi' });

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        } catch (e) {
            return res.status(401).json({ message: 'Token không hợp lệ' });
        }

        const user = payload.sub ? await User.findById(payload.sub).select('role disabled').lean() : null;
        if (!user || user.disabled) {
            return res.status(401).json({ message: 'Tài khoản không còn hiệu lực' });
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        res.write(':ok\n\n');

        addClient(res, { sub: String(payload.sub), role: user.role });

        const keepAlive = setInterval(() => {
            try {
                res.write(':\n\n');
            } catch (e) {
                clearInterval(keepAlive);
            }
        }, SSE_KEEP_ALIVE_MS);

        // Dùng 'close' của res (đóng kết nối/kết thúc response); 'close' của req có thể bắn sớm ở Node mới
        res.on('close', () => clearInterval(keepAlive));
    } catch (err) {
        console.error('SSE stream error:', err.message || err);
        if (!res.headersSent) res.status(500).end();
        else res.end();
    }
});
//
router.get('/:id', auth([]), ctrl.findById);

export default router;
