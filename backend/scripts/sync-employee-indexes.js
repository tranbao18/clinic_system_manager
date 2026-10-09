// Đồng bộ index của collection employees theo schema hiện tại (email: unique + sparse).
// Index email_1 cũ trên Atlas KHÔNG sparse -> chỉ 1 nhân viên được bỏ trống email (người thứ 2 bị E11000).
// Mongoose không tự sửa index đã tồn tại, nên chạy tay 1 lần (từ thư mục backend):
//   node scripts/sync-employee-indexes.js
// Lưu ý: syncIndexes() XÓA mọi index của employees không khai báo trong schema (in ra trước khi chạy).
import 'dotenv/config';
import '../src/config/timezone.js';
import mongoose from 'mongoose';
import Employee from '../src/models/employee.model.js';

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI chưa được cấu hình trong .env');
    process.exitCode = 1;
    return;
  }

  // autoIndex: false -> không để Mongoose tự tạo index khi kết nối (sẽ xung đột với email_1 cũ)
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME, autoIndex: false });
  try {
    console.log(`Đã kết nối DB: ${mongoose.connection.name}`);
    console.log('Index hiện tại của employees:', JSON.stringify(await Employee.listIndexes(), null, 2));

    // Email "", chỉ khoảng trắng hoặc null vẫn bị đánh index sparse -> bỏ field trước khi tạo lại index
    const blank = await Employee.collection.updateMany(
      { $or: [{ email: { $type: 'null' } }, { email: { $regex: /^\s*$/ } }] },
      { $unset: { email: '' } }
    );
    console.log(`Đã bỏ email rỗng ở ${blank.modifiedCount} nhân viên`);

    console.log('Thay đổi dự kiến:', JSON.stringify(await Employee.diffIndexes(), null, 2));
    const dropped = await Employee.syncIndexes();
    console.log('syncIndexes() xong. Index đã xóa:', dropped);
    console.log('Index sau khi đồng bộ:', JSON.stringify(await Employee.listIndexes(), null, 2));
  } finally {
    await mongoose.disconnect();
    console.log('Đã ngắt kết nối DB.');
  }
}

main().catch((err) => {
  console.error('Đồng bộ index thất bại:', err);
  process.exitCode = 1;
});
