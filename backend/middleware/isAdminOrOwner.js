module.exports = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'owner')) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Akses ditolak: Hanya admin atau owner yang diperbolehkan melakukan tindakan ini!'
        });
    }
};
