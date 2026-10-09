import dao from '../dao/purchase-transaction.dao.js';
import pickFields from '../utils/pick-fields.js';

import errorStatus from '../utils/error-status.js';
const CREATE_FIELDS = ['import_id', 'payment_method', 'amount', 'date', 'accountant_id'];
const UPDATE_FIELDS = ['payment_method', 'amount', 'date'];

class PurchaseTransactionController {
  async create(req, res) {
    try {
      const result = await dao.create(pickFields(req.body, CREATE_FIELDS));
      res.status(201).json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async findAll(req, res) {
    try {
      const result = await dao.findAll();
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async findById(req, res) {
    try {
      const result = await dao.findById(req.params.id);
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async update(req, res) {
    try {
      const result = await dao.update(req.params.id, pickFields(req.body, UPDATE_FIELDS));
      res.json(result);
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async remove(req, res) {
    try {
      await dao.delete(req.params.id);
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

  async restore(req, res) {
    try {
      await dao.restore(req.params.id);
      res.json({ message: 'Restored' });
    } catch (err) {
      res.status(errorStatus(err)).json({ error: err.message });
    }
  };

}

export default new PurchaseTransactionController();