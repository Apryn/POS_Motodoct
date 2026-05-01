const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token tidak ada' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia_kasir_bengkel_123');
        req.user = decoded;
        next();
    } catch {
        res.status(403).json({ success: false, message: 'Token tidak valid' });
    }
};
