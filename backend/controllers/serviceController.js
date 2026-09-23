const db = require('../config/db');

exports.getAllServices = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM services WHERE (is_deleted = 0 OR is_deleted IS NULL) ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error getAllServices:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createService = async (req, res) => {
    try {
        const { name, price } = req.body;
        const [result] = await db.execute('INSERT INTO services (name, price) VALUES (?, ?)', [name, price]);
        res.status(201).json({ success: true, message: 'Servis berhasil ditambahkan', data: { id: result.insertId, name, price } });
    } catch (error) {
        console.error('Error createService:', error);
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
        console.error('Error updateService:', error);
        res.status(500).json({ success: false, message: 'Gagal mengupdate servis' });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE services SET is_deleted = 1 WHERE id=?', [id]);
        res.json({ success: true, message: 'Servis berhasil dihapus' });
    } catch (error) {
        console.error('Error deleteService:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus servis' });
    }
};
