// Side-effect import chạy đúng thứ tự: nạp .env rồi đặt múi giờ TRƯỚC khi các module khác được nạp
// (dotenv.config() trong thân file chỉ chạy SAU khi mọi import đã được đánh giá)
import 'dotenv/config';
import './src/config/timezone.js';

import connectDB from './src/config/db.js';
import app from './server.js';

async function main() {
  const port = process.env.PORT || 5050; // Default 5050 vì Mac thường conflict port 5000

  try {
    await connectDB();

    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port}`)
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    throw err;
  }
}

main();