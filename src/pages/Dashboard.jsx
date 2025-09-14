// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  collectionGroup,   // ใช้ดึง MAC จาก history (เฉพาะตอนล็อกอิน)
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import ReactSpeedometer from 'react-d3-speedometer';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import Navbar from '../components/Navbar';
import './Dashboard.css';

export default function Dashboard() {
  // ดึง loading, user, role มาจาก context (สำคัญ!)
  const { user, userRole, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  // meta sensors
  const [sensorsMeta, setSensorsMeta] = useState([]);
  // latest values from history (เฉพาะตอนล็อกอิน)
  const [latestByMac, setLatestByMac] = useState({});

  // ----- Bind modal state -----
  const [showBindModal, setShowBindModal] = useState(false);
  const [selectedMac, setSelectedMac] = useState('');
  const [aliasName, setAliasName] = useState('');
  const [macsFromHistory, setMacsFromHistory] = useState([]); // รายชื่อ MAC ใน history (เฉพาะล็อกอิน)

  const [manualMac, setManualMac] = useState('');
  const [manualAlias, setManualAlias] = useState('');
  const [loadingGPS, setLoadingGPS] = useState(false);

  const isLoggedIn = !!user;

  // ===== Subscribe sensors (guest/user/admin อ่านได้) =====
  useEffect(() => {
    const q = query(collection(db, 'sensors'));
    const unsub = onSnapshot(
      q,
      (snap) => setSensorsMeta(snap.docs.map((d) => ({ mac: d.id, ...d.data() }))),
      (err) => console.error('[sensors:onSnapshot] error:', err)
    );
    return () => unsub();
  }, []);

  // ===== ดึง MAC จาก history (เฉพาะตอนล็อกอิน + มีสิทธิ์ view_history) =====
  useEffect(() => {
  if (loading) return;
  if (!isLoggedIn || !hasPermission('view_history')) {
    // 🚫 อย่า subscribe ถ้าไม่มีสิทธิ์
    setMacsFromHistory([]);
    return;
  }

    const q = query(
      collectionGroup(db, 'history'),
      orderBy('updatedAt', 'desc'),
      limit(500)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const seen = new Set();
        snap.docs.forEach((ds) => {
          const mac = ds.ref.parent?.parent?.id; // sensors/{mac}/history/{docId}
          if (mac) seen.add(mac);
        });
        setMacsFromHistory(Array.from(seen));
      },
      (err) => {
        console.error('[history:list MAC] error (guarded):', err);
        setMacsFromHistory([]);
      }
    );

    return () => unsub();
  }, [loading, isLoggedIn, userRole]); // ไม่ใส่ hasPermission ใน deps

  // รายชื่อ MAC ที่จะโชว์เป็นการ์ด
  const macListForCards = useMemo(
    () => sensorsMeta.filter((m) => m.status !== 'archived').map((m) => m.mac),
    [sensorsMeta]
  );

  // Subscribe history ล่าสุดสำหรับแต่ละ MAC (เฉพาะตอนล็อกอิน + มีสิทธิ์)
  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {                // guest → ไม่ subscribe history
      setLatestByMac({});
      return;
    }
    if (!hasPermission('view_history')) {
      setLatestByMac({});
      return;
    }

    const unsubs = [];
    macListForCards.forEach((mac) => {
      const qLatest = query(
        collection(db, 'sensors', mac, 'history'),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );
      const unsub = onSnapshot(
        qLatest,
        (snap) => {
          const docLatest = snap.docs[0];
          if (!docLatest) return;
          const d = docLatest.data();
          setLatestByMac((prev) => ({
            ...prev,
            [mac]: {
              temperature: d.temperature,
              humidity: d.humidity,
              dust: d.dust,
              updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate() : new Date(),
            },
          }));
        },
        (err) => console.error(`[history:${mac}] error (guarded):`, err)
      );
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u && u());
  }, [loading, isLoggedIn, userRole, macListForCards]);

  // lookup meta โดย mac
  const metaByMac = useMemo(() => {
    const map = {};
    sensorsMeta.forEach((m) => (map[m.mac] = m));
    return map;
  }, [sensorsMeta]);

  // รวมรายชื่อ MAC สำหรับโมดอล (union: history ∪ sensors)
  const allMacChoices = useMemo(() => {
    const set = new Set();
    macsFromHistory.forEach((m) => set.add(m));
    sensorsMeta.forEach((m) => set.add(m.mac));
    return Array.from(set);
  }, [macsFromHistory, sensorsMeta]);

  // ===== Actions =====
  const goHistory = (mac) => {
    if (!hasPermission('view_history')) {
      alert('กรุณาเข้าสู่ระบบเพื่อดูประวัติข้อมูล');
      navigate('/login');
      return;
    }
    navigate(`/history/${encodeURIComponent(mac)}`);
  };

  const openBindModal = () => {
    if (!hasPermission('add_sensor')) return;
    setSelectedMac(allMacChoices[0] || '');
    setAliasName('');
    setShowBindModal(true);
  };

  const handleBindExistingMac = async () => {
    if (!hasPermission('add_sensor')) {
      alert('คุณไม่มีสิทธิ์ผูกเครื่อง');
      return;
    }
    if (!selectedMac) {
      alert('กรุณาเลือก MAC');
      return;
    }
    try {
      await setDoc(
        doc(db, 'sensors', selectedMac),
        {
          name: aliasName.trim() || selectedMac,
          updatedAt: serverTimestamp(),
          status: 'active',
        },
        { merge: true }
      );
      setShowBindModal(false);
      alert('✅ ผูกเครื่องเรียบร้อย');
    } catch (e) {
      alert('❌ ผูกเครื่องไม่สำเร็จ: ' + e.message);
    }
  };

  const updateLocationFromBrowser = async (mac) => {
    if (!hasPermission('update_location')) {
      alert('คุณไม่มีสิทธิ์อัปเดตตำแหน่ง');
      return;
    }
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ไม่รองรับ GPS');
      return;
    }
    setLoadingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          await updateDoc(doc(db, 'sensors', mac), {
            latitude: coords.lat,
            longitude: coords.lng,
            location: `Lat: ${coords.lat.toFixed(6)}, Lng: ${coords.lng.toFixed(6)}`,
            updatedAt: serverTimestamp(),
          });
          alert('📍 อัปเดตพิกัดเรียบร้อย');
        } catch (e) {
          alert('❌ อัปเดตพิกัดไม่สำเร็จ: ' + e.message);
        } finally {
          setLoadingGPS(false);
        }
      },
      (error) => {
        alert('❌ ขอพิกัดไม่สำเร็จ: ' + error.message);
        setLoadingGPS(false);
      }
    );
  };


  const handleArchiveSensor = async (mac) => {
    if (!hasPermission('delete_sensor')) {
      alert('คุณไม่มีสิทธิ์เปลี่ยนสถานะเครื่อง');
      return;
    }
    if (!window.confirm(`เก็บเข้าคลังเครื่อง ${mac} ?`)) return;
    try {
      await updateDoc(doc(db, 'sensors', mac), {
        status: 'archived',
        updatedAt: serverTimestamp(),
      });
      alert('✅ เก็บเข้าคลังเรียบร้อย');
    } catch (e) {
      alert('❌ เก็บเข้าคลังไม่สำเร็จ: ' + e.message);
    }
  };

  const handleRestoreSensor = async (mac) => {
    if (!hasPermission('delete_sensor')) {
      alert('คุณไม่มีสิทธิ์เปลี่ยนสถานะเครื่อง');
      return;
    }
    try {
      await updateDoc(doc(db, 'sensors', mac), {
        status: 'active',
        updatedAt: serverTimestamp(),
      });
      alert('✅ กู้คืนเครื่องเรียบร้อย');
    } catch (e) {
      alert('❌ กู้คืนไม่สำเร็จ: ' + e.message);
    }
  };

  const handleAddByManualMac = async () => {
    if (!hasPermission('add_sensor')) {
      alert('คุณไม่มีสิทธิ์เพิ่มเครื่อง');
      return;
    }
    const mac = manualMac.trim();
    if (!mac) {
      alert('กรุณากรอก MAC');
      return;
    }
    try {
      await setDoc(
        doc(db, 'sensors', mac),
        {
          name: (manualAlias || mac).trim(),
          createdBy: user?.uid || null,
          createdAt: serverTimestamp(),
          status: 'active',
        },
        { merge: true }
      );
      setManualMac('');
      setManualAlias('');
      alert('✅ เพิ่ม/ผูกเครื่องเรียบร้อย');
    } catch (e) {
      alert('❌ เพิ่มเครื่องไม่สำเร็จ: ' + e.message);
    }
  };

  // ===== Render =====
  return (
    <div className="dashboard">
      <Navbar user={user} userRole={userRole} onLogout={async () => {
        try { await signOut(auth); navigate('/'); } catch { alert('ออกจากระบบไม่สำเร็จ'); }
      }} />

      <div className="moduleBox">
        <span className="moduleText">Module Dashboard</span>
      </div>

      <div className="mainContentBox">
        {/* กล่องเพิ่ม/ผูกเครื่อง — เฉพาะ admin */}
        {hasPermission('add_sensor') && (
          <div className="addSensorBox">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>เพิ่ม/ผูกเครื่อง</div>

            {/* ปุ่มผูกจาก MAC ที่มีอยู่ */}
            <button onClick={openBindModal} className="btn btn--primary" style={{ marginBottom: 8 }}>
              🔗 ผูกเครื่องจาก MAC ที่มีอยู่
            </button>

            {/* เพิ่มด้วยการพิมพ์ MAC เอง */}
            <input
              value={manualMac}
              onChange={(e) => setManualMac(e.target.value)}
              placeholder="กรอก MAC (เช่น E4:65:...)"
              className="input"
            />
            <input
              value={manualAlias}
              onChange={(e) => setManualAlias(e.target.value)}
              placeholder="ตั้งชื่อเล่น (ไม่บังคับ)"
              className="input"
            />
            <button onClick={handleAddByManualMac} className="btn">
              ➕ เพิ่ม/ผูกด้วย MAC ที่พิมพ์
            </button>
          </div>
        )}

        {/* การ์ดอุปกรณ์ */}
        <div className="cardContainer">
          {macListForCards.length === 0 ? (
            <div className="noDataMessage">📭 ยังไม่พบอุปกรณ์</div>
          ) : (
            macListForCards.map((mac) => {
              const meta = metaByMac[mac] || {};
              const latest = latestByMac[mac];
              const displayName = meta.name || mac;
              const lat = fmtCoord(meta.latitude);
              const lng = fmtCoord(meta.longitude);

              // guest → ใช้ meta; logged-in → ใช้ history ล่าสุด
              const showTemp = isLoggedIn ? latest?.temperature : meta.temperature;
              const showDust = isLoggedIn ? latest?.dust : meta.dust;
              const showHum = isLoggedIn ? latest?.humidity : meta.humidity;

              return (
                <div key={mac} className="card">
                  <h3 className="cardTitle">{displayName}</h3>

                  <div className="dataBox">
                    <div className="smallBoxLeft">
                      <ReactSpeedometer
                        value={toNum(showTemp)}
                        maxValue={50}
                        segments={5}
                        needleColor="black"
                        startColor="green"
                        endColor="red"
                        height={120}
                        width={160}
                        ringWidth={20}
                        currentValueText={`อุณหภูมิ: ${fmt(showTemp)}°C`}
                      />
                    </div>

                    <div className="bigBox">
                      <ReactSpeedometer
                        value={toNum(showDust)}
                        maxValue={250}
                        segments={5}
                        needleColor="gray"
                        startColor="#B0E57C"
                        endColor="#8B0000"
                        height={160}
                        width={200}
                        ringWidth={20}
                        currentValueText={`ฝุ่น: ${fmt(showDust)} µg/m³`}
                      />
                    </div>

                    <div className="smallBoxRight">
                      <ReactSpeedometer
                        value={toNum(showHum)}
                        maxValue={100}
                        segments={5}
                        needleColor="orange"
                        startColor="lightblue"
                        endColor="darkblue"
                        height={120}
                        width={160}
                        ringWidth={20}
                        currentValueText={`ความชื้น: ${fmt(showHum)}%`}
                      />
                    </div>
                  </div>

                  {/* Battery & Location */}
                  <div className="batteryBox">
                    🔋 Battery: <b>{typeof meta.battery === 'number' ? `${meta.battery}%` : '—'}</b>
                  </div>

                  <div className="coordBox">
                    <div>
                      <div>📍 ตำแหน่ง: {meta.location || 'ไม่ระบุ'}</div>
                      {lat && lng && (
                        <div style={{ marginTop: 4, color: '#374151' }}>
                          Lat: <b>{lat}</b>, Lng: <b>{lng}</b>
                        </div>
                      )}
                    </div>
                    {lat && lng && (
                      <a
                        href={mapUrl(meta.latitude, meta.longitude)}
                        target="_blank"
                        rel="noreferrer"
                        className="mapButton"
                        title="เปิดใน Google Maps"
                      >
                        🗺️ เปิดแผนที่
                      </a>
                    )}
                  </div>

                  {/* ปุ่มตามสิทธิ์ */}
                  <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 10, flexWrap: 'wrap' }}>
                    {hasPermission('view_history') && (
                      <button onClick={() => goHistory(mac)} className="historyButton">
                        📊 ดูกราฟย้อนหลัง
                      </button>
                    )}
                    {hasPermission('update_location') && (
                      <button
                        onClick={() => updateLocationFromBrowser(mac)}
                        className="btn"
                        disabled={loadingGPS}
                        title="อัปเดตพิกัดจากเบราว์เซอร์ของคุณ"
                      >
                        {loadingGPS ? '📍 กำลังดึงพิกัด...' : '📍 อัปเดตพิกัด'}
                      </button>
                    )}
                    {hasPermission('delete_sensor') && (
                      <button className="deleteButton" onClick={() => handleArchiveSensor(mac)}>
                        📦 เก็บเข้าคลัง
                      </button>
                    )}

                  </div>

                  <div className="locationBox">
                    ⏱ อัปเดตล่าสุด:{' '}
                    {isLoggedIn
                      ? latest?.updatedAt?.toLocaleString() || '—'
                      : meta.updatedAt?.toDate?.().toLocaleString() || '—'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ===== โมดอลผูก MAC ที่มีอยู่ (เฉพาะ admin) ===== */}
      {showBindModal && hasPermission('add_sensor') && (
        <div className="modalBackdrop">
          <div className="modalCard">
            <h3 style={{ marginTop: 0 }}>ผูกเครื่องจาก MAC ที่มีอยู่</h3>

            {allMacChoices.length === 0 ? (
              <div style={{ marginBottom: 12 }}>ยังไม่พบ MAC ใด ๆ ในระบบ</div>
            ) : (
              <>
                <label className="modalLabel">เลือก MAC</label>
                <select
                  value={selectedMac}
                  onChange={(e) => setSelectedMac(e.target.value)}
                  className="select"
                >
                  {allMacChoices.map((mac) => (
                    <option key={mac} value={mac}>{mac}</option>
                  ))}
                </select>

                <label className="modalLabel">ตั้งชื่อ (ไม่บังคับ)</label>
                <input
                  value={aliasName}
                  onChange={(e) => setAliasName(e.target.value)}
                  placeholder="เช่น ห้อง Lab ชั้น 2"
                  className="input"
                />

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={handleBindExistingMac} className="btn btn--primary">
                    ✅ ผูกเครื่อง
                  </button>
                  <button onClick={() => setShowBindModal(false)} className="btn" style={{ background: '#e5e7eb', border: 'none' }}>
                    ยกเลิก
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== utils ===== */
function toNum(n) {
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
}
function fmt(n) {
  return typeof n === 'number' && !Number.isNaN(n) ? n.toFixed(1) : '—';
}
function fmtCoord(n) {
  return typeof n === 'number' && !Number.isNaN(n) ? n.toFixed(6) : null;
}
function mapUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
