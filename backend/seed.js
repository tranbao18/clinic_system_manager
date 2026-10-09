import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './src/models/user.model.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is not defined in .env');
      process.exit(1);
    }

    // Không hardcode mật khẩu: truyền qua tham số hoặc biến môi trường
    // Cách dùng: node seed.js <mật_khẩu>   hoặc   SEED_ADMIN_PASSWORD=... node seed.js
    const adminPassword = process.argv[2] || process.env.SEED_ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length < 8) {
      console.error('Cần truyền mật khẩu admin (>= 8 ký tự): node seed.js <mật_khẩu>');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGO_DB_NAME
    });
    console.log(`Connected to MongoDB (Database: ${process.env.MONGO_DB_NAME}).`);

    const adminUsername = 'admin';

    let adminUser = await User.findOne({ username: adminUsername });
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(adminPassword, salt);

    if (adminUser) {
      console.log('Admin user already exists. Updating password...');
      adminUser.password_hash = password_hash;
      await adminUser.save();
    } else {
      console.log('Creating new admin user...');
      adminUser = new User({
        username: adminUsername,
        password_hash: password_hash,
        role: 'Admin',
      });
      await adminUser.save();
    }

    console.log(`==========================================`);
    console.log(`Admin user ready!`);
    console.log(`Username: ${adminUsername}`);
    console.log(`Saved to Database: ${adminUser.db.name}, Collection: ${adminUser.collection.name}`);
    console.log(`==========================================`);
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
};

seedAdmin();
