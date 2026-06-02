const db = require('../config/db');

exports.getReminders = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT r.*, c.name as customer_name, c.phone, c.license_plate, 
                   t.invoice_number, DATE(COALESCE(t.created_at, r.created_at)) as last_change_date,
                   DATEDIFF(r.scheduled_date, CURRENT_DATE) as days_left
            FROM oil_reminders r
            JOIN customers c ON r.customer_id = c.id
            LEFT JOIN transactions t ON r.transaction_id = t.id
            ORDER BY r.status ASC, r.scheduled_date ASC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error getReminders:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db.execute('UPDATE oil_reminders SET status = ? WHERE id = ?', [status || 'sent', id]);
        res.json({ success: true, message: 'Status pengingat berhasil diperbarui' });
    } catch (error) {
        console.error("Error updateStatus:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createReminder = async (req, res) => {
    try {
        const { customer_id, sparepart_name, scheduled_date } = req.body;
        if (!customer_id || !sparepart_name || !scheduled_date) {
            return res.status(400).json({ success: false, message: 'Mohon lengkapi semua field wajib' });
        }
        await db.execute(
            'INSERT INTO oil_reminders (transaction_id, customer_id, sparepart_name, scheduled_date) VALUES (NULL, ?, ?, ?)',
            [customer_id, sparepart_name, scheduled_date]
        );
        res.status(201).json({ success: true, message: 'Pengingat kustom berhasil dijadwalkan' });
    } catch (error) {
        console.error("Error createReminder:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.deleteReminder = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM oil_reminders WHERE id = ?', [id]);
        res.json({ success: true, message: 'Pengingat berhasil dihapus' });
    } catch (error) {
        console.error("Error deleteReminder:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getTemplates = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM reminder_templates ORDER BY id ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error getTemplates:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const { service_keyword, name, interval_days, wa_template } = req.body;
        if (!service_keyword || !name || !interval_days || !wa_template) {
            return res.status(400).json({ success: false, message: 'Mohon lengkapi semua field wajib' });
        }
        await db.execute(
            'INSERT INTO reminder_templates (service_keyword, name, interval_days, wa_template) VALUES (?, ?, ?, ?)',
            [service_keyword.toLowerCase().trim(), name, interval_days, wa_template]
        );
        res.status(201).json({ success: true, message: 'Template pengingat berhasil ditambahkan' });
    } catch (error) {
        console.error("Error createTemplate:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Kata Kunci sudah digunakan oleh templat lain!' });
        }
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { service_keyword, name, interval_days, wa_template } = req.body;
        if (!service_keyword || !name || !interval_days || !wa_template) {
            return res.status(400).json({ success: false, message: 'Mohon lengkapi semua field wajib' });
        }
        await db.execute(
            'UPDATE reminder_templates SET service_keyword = ?, name = ?, interval_days = ?, wa_template = ? WHERE id = ?',
            [service_keyword.toLowerCase().trim(), name, interval_days, wa_template, id]
        );
        res.json({ success: true, message: 'Template pengingat berhasil diperbarui' });
    } catch (error) {
        console.error("Error updateTemplate:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Kata Kunci sudah digunakan oleh templat lain!' });
        }
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM reminder_templates WHERE id = ?', [id]);
        res.json({ success: true, message: 'Template pengingat berhasil dihapus' });
    } catch (error) {
        console.error("Error deleteTemplate:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


