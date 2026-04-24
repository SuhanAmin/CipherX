const mongoose = require('mongoose');
let MongoMemoryServer;

let isConnected = false;

async function connectToDatabase() {
	if (isConnected) return mongoose.connection;
	const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cipherX';
	mongoose.set('strictQuery', true);
	try {
		await mongoose.connect(uri, {
			serverSelectionTimeoutMS: 5000,
		});
	} catch (err) {
		// Fallback to in-memory server if not in production
		if (process.env.NODE_ENV !== 'production') {
			try {
				MongoMemoryServer = MongoMemoryServer || (await import('mongodb-memory-server')).MongoMemoryServer;
				const mem = await MongoMemoryServer.create();
				const memUri = mem.getUri();
				await mongoose.connect(memUri);
				console.log('Connected to in-memory MongoDB');
			} catch (e) {
				console.error('Failed to start in-memory MongoDB', e);
				throw err;
			}
		} else {
			throw err;
		}
	}
	isConnected = true;
	return mongoose.connection;
}

module.exports = { connectToDatabase };