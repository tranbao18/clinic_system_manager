import dotenv from "dotenv";
dotenv.config();

import connectDB from '../src/config/db.js';
import app from '../server.js';

// Vercel Serverless Function cần kết nối database khi instance được khởi tạo
connectDB().catch((err) => {
  console.error("Vercel Serverless DB Connection Error:", err);
});

export default app;
