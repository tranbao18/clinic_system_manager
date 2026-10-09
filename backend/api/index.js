// Side-effect import chạy đúng thứ tự: nạp .env rồi đặt múi giờ TRƯỚC khi các module khác được nạp
import 'dotenv/config';
import '../src/config/timezone.js';

import connectDB from '../src/config/db.js';
import app from '../server.js';

// Đảm bảo DB được kết nối xong TRƯỚC KHI Vercel nhận bất kỳ request nào
await connectDB();

export default app;
