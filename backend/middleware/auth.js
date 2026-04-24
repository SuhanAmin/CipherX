const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function authenticate(req, res, next) {
	try {
		const token = req.cookies.token || (req.headers.authorization || '').replace('Bearer ', '');
		if (!token) return res.status(401).json({ error: 'Unauthorized' });
		const payload = jwt.verify(token, JWT_SECRET);
		req.user = { id: payload.id, name: payload.name };
		return next();
	} catch (err) {
		return res.status(401).json({ error: 'Unauthorized' });
	}
}

module.exports = { authenticate };

