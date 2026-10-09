import dao from '../dao/notification.dao.js';
import pickFields from '../utils/pick-fields.js';

import errorStatus from '../utils/error-status.js';
const CREATE_FIELDS = ['recipient_id', 'recipient_role', 'type', 'title', 'message', 'related_id', 'related_type'];

class NotificationController {
  async create(req, res) {
    try {
      const result = await dao.create(pickFields(req.body, CREATE_FIELDS));
      res.status(201).json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  }

  async findAll(req, res) {
    try {
      const userId = req.user.sub || req.user.userId || req.user._id;
      const userRole = req.user.role;

      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      const filter = {};
      if (req.query.read !== undefined) {
        filter.read = req.query.read === 'true';
      }
      // Optional: allow client to request only a specific type via ?type=...
      if (req.query.type) {
        filter.type = String(req.query.type);
      }

      const result = await dao.findByRecipient(userId, filter);
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  }

  // Kế thừa
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.sub || req.user.userId || req.user._id;
      const userRole = req.user.role;

      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      // Filter thông báo theo query params only. Do not hardcode type by role.
      const filter = { disabled: false, read: false };
      if (req.query.type) {
        filter.type = String(req.query.type);
      }

      const count = await dao.getUnreadCount(userId, filter);
      res.json({ count });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  }
  //

  async markAsRead(req, res) {
    try {
      const userId = req.user.sub || req.user.userId || req.user._id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      const result = await dao.markAsRead(req.params.id, userId);
      if (!result) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  }

  async markAllAsRead(req, res) {
    try {
      const userId = req.user.sub || req.user.userId || req.user._id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      await dao.markAllAsRead(userId);
      res.json({ message: 'All notifications marked as read' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  }

  async findById(req, res) {
    try {
      const userId = req.user.sub || req.user.userId || req.user._id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      const result = await dao.findById(req.params.id);
      if (!result) {
        return res.status(404).json({ message: 'Not found' });
      }
      // Kiểm tra xem user có quyền xem thông báo này không
      if (result.recipient_id.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  }

  async remove(req, res) {
    try {
      // Chỉ người nhận (hoặc Admin) được xóa thông báo
      const notification = await dao.findById(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: 'Not found' });
      }
      const userId = req.user.sub || req.user.userId || req.user._id;
      if (req.user.role !== 'Admin' && String(notification.recipient_id) !== String(userId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      await dao.delete(req.params.id);
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  }

  async restore(req, res) {
    try {
      await dao.restore(req.params.id);
      res.json({ message: 'Restored' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

}

export default new NotificationController();