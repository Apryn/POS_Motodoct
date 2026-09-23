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
        const { name, price, commission_type, commission_value } = req.body;
        const cType = ['percentage', 'nominal', 'default'].includes(commission_type) ? commission_type : 'default';
        const cVal = (cType === 'default' || commission_value === null || commission_value === '' || commission_value === undefined) ? null : parseFloat(commission_value);
        const [result] = await db.execute(
            'INSERT INTO services (name, price, commission_type, commission_value) VALUES (?, ?, ?, ?)',
            [name, price, cType, cVal]
        );
        res.status(201).json({ success: true, message: 'Servis berhasil ditambahkan', data: { id: result.insertId, name, price, commission_type: cType, commission_value: cVal } });
    } catch (error) {
        console.error('Error createService:', error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan servis' });
    }
};

exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, commission_type, commission_value } = req.body;
        const cType = ['percentage', 'nominal', 'default'].includes(commission_type) ? commission_type : 'default';
        const cVal = (cType === 'default' || commission_value === null || commission_value === '' || commission_value === undefined) ? null : parseFloat(commission_value);
        await db.execute(
            'UPDATE services SET name=?, price=?, commission_type=?, commission_value=? WHERE id=?',
            [name, price, cType, cVal, id]
        );
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
