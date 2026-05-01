const db = require('../config/db');

exports.getAllMechanics = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM mechanics ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createMechanic = async (req, res) => {
    try {
        const { name, phone } = req.body;
        const [result] = await db.execute('INSERT INTO mechanics (name, phone) VALUES (?, ?)', [name, phone || null]);
        res.status(201).json({ success: true, message: 'Mekanik berhasil ditambahkan', data: { id: result.insertId, name, phone } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menambahkan mekanik' });
    }
};

exports.updateMechanic = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone } = req.body;
        await db.execute('UPDATE mechanics SET name=?, phone=? WHERE id=?', [name, phone || null, id]);
        res.json({ success: true, message: 'Mekanik berhasil diupdate' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengupdate mekanik' });
    }
};

exports.deleteMechanic = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM mechanics WHERE id=?', [id]);
        res.json({ success: true, message: 'Mekanik berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus mekanik' });
    }
};
