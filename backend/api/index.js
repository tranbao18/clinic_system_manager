import dotenv from "dotenv";
dotenv.config();

import connectDB from '../src/config/db.js';
import app from '../server.js';

// Đảm bảo DB được kết nối xong TRƯỚC KHI Vercel nhận bất kỳ request nào
await connectDB();

export default app;
