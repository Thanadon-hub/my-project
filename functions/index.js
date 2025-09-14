// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.mirrorLatestToSensor = functions.firestore
  .document('sensors/{mac}/history/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    const { mac } = context.params;

    // ดึงฟิลด์ที่ต้องการ “โชว์บนการ์ดของ guest”
    const payload = {
      temperature: data.temperature ?? null,
      humidity: data.humidity ?? null,
      dust: data.dust ?? null,
      // เผื่อมีมาใน history ด้วย
      battery: data.battery ?? admin.firestore.FieldValue.delete(),
      latitude: typeof data.latitude === 'number' ? data.latitude : admin.firestore.FieldValue.delete(),
      longitude: typeof data.longitude === 'number' ? data.longitude : admin.firestore.FieldValue.delete(),
      location: typeof data.location === 'string' ? data.location : admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin.firestore().doc(`sensors/${mac}`).set(payload, { merge: true });
  });
