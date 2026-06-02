const db = require('../config/db');

exports.getAllExpenses = async (req, res) => {
    try {
        const { from, to } = req.query;
        let query = 'SELECT * FROM expenses';
        let params = [];

        if (from && to) {
            query += ' WHERE DATE(created_at) BETWEEN ? AND ?';
            params = [from, to];
        }

        query += ' ORDER BY created_at DESC';
        const [rows] = await db.execute(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error get expenses:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createExpense = async (req, res) => {
    try {
        const { description, amount, category } = req.body;
        if (!description || !amount || !category) {
            return res.status(400).json({ success: false, message: 'Deskripsi, jumlah, dan kategori wajib diisi!' });
        }

        const [result] = await db.execute(
            'INSERT INTO expenses (description, amount, category) VALUES (?, ?, ?)',
            [description, amount, category]
        );
        res.status(201).json({
            success: true,
            message: 'Pengeluaran berhasil dicatat',
            data: { id: result.insertId, description, amount, category }
        });
    } catch (error) {
        console.error("Error create expense:", error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan pengeluaran' });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, amount, category } = req.body;
        if (!description || !amount || !category) {
            return res.status(400).json({ success: false, message: 'Deskripsi, jumlah, dan kategori wajib diisi!' });
        }

        await db.execute(
            'UPDATE expenses SET description = ?, amount = ?, category = ? WHERE id = ?',
            [description, amount, category, id]
        );
        res.json({ success: true, message: 'Pengeluaran berhasil diperbarui' });
    } catch (error) {
        console.error("Error update expense:", error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui pengeluaran' });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM expenses WHERE id = ?', [id]);
        res.json({ success: true, message: 'Pengeluaran berhasil dihapus' });
    } catch (error) {
        console.error("Error delete expense:", error);
        res.status(500).json({ success: false, message: 'Gagal menghapus pengeluaran' });
    }
};
