// Múi giờ của toàn bộ backend. Vercel không cho đặt biến TZ nên phải gán lúc chạy.
// Import file này (side-effect) ngay sau dotenv, TRƯỚC mọi module khác: new Date(y, m, d),
// setHours(...) và các mốc "đầu ngày" đều được tính theo giờ Việt Nam.
export const APP_TIMEZONE = process.env.APP_TZ || 'Asia/Ho_Chi_Minh';

process.env.TZ = APP_TIMEZONE;

export default APP_TIMEZONE;
