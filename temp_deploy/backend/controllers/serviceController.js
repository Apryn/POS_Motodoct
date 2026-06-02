const db = require('../config/db');

exports.getAllServices = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM services ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createService = async (req, res) => {
    try {
        const { name, price } = req.body;
        const [result] = await db.execute('INSERT INTO services (name, price) VALUES (?, ?)', [name, price]);
        res.status(201).json({ success: true, message: 'Servis berhasil ditambahkan', data: { id: result.insertId, name, price } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menambahkan servis' });
    }
};

exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price } = req.body;
        await db.execute('UPDATE services SET name=?, price=? WHERE id=?', [name, price, id]);
        res.json({ success: true, message: 'Servis berhasil diupdate' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengupdate servis' });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM services WHERE id=?', [id]);
        res.json({ success: true, message: 'Servis berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus servis' });
    }
};
