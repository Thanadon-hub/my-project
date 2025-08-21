// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collectionGroup, // ใช้ดึง MAC จาก history เฉพาะตอนเปิดโมดอล
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import ReactSpeedometer from 'react-d3-speedometer';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const { user, userRole, isAdmin, isLoggedIn, hasPermission } = useAuth();
  const navigate = useNavigate();

  // meta ของอุปกรณ์ (doc ใน sensors) เช่น name, location, latitude, longitude, status
  const [sensorsMeta, setSensorsMeta] = useState([]);
  // ค่าล่าสุดของแต่ละ MAC จาก history
  const [latestByMac, setLatestByMac] = useState({});
  const [showBindModal, setShowBindModal] = useState(false);
  const [selectedMac, setSelectedMac] = useState('');
  const [aliasName, setAliasName] = useState('');

  // เพิ่มด้วยการพิมพ์ MAC เอง
  const [manualMac, setManualMac] = useState('');
  const [manualAlias, setManualAlias] = useState('');

  const [loadingGPS, setLoadingGPS] = useState(false);

  // รายชื่อ MAC ที่เจอจาก history (ใช้สำหรับโมดอลเท่านั้น)
  const [macsFromHistory, setMacsFromHistory] = useState([]);

  // ดึงเอกสารใน sensors (อันที่ถูกผูกแล้วเท่านั้นที่จะไปแสดงการ์ด)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sensors'), (snap) => {
      const list = snap.docs.map((d) => ({ mac: d.id, ...d.data() }));
      setSensorsMeta(list);
    });
    return () => unsub();
  }, []);

  // ดึง MAC จาก collectionGroup('history') — ใช้เฉพาะเพื่อขึ้นตัวเลือกในโมดอล
  useEffect(() => {
    // ถ้าติด index ให้สร้าง index ตามลิงก์ error ได้ หรือจะเอา orderBy ออกก็ได้ชั่วคราว
    const q = query(
      collectionGroup(db, 'history'),
      orderBy('updatedAt', 'desc'),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
      const seen = new Set();
      snap.docs.forEach((ds) => {
        const mac = ds.ref.parent?.parent?.id; // path: sensors/{mac}/history/{docId}
        if (mac) seen.add(mac);
      });
      setMacsFromHistory(Array.from(seen));
    });
    return () => unsub();
  }, []);

  // รายชื่อ MAC สำหรับ "การ์ด" เท่านั้น = เฉพาะที่ผูกแล้ว และไม่ถูก archive
  const macListForCards = useMemo(() => {
    return sensorsMeta
      .filter((m) => m.status !== 'archived')
      .map((m) => m.mac);
  }, [sensorsMeta]);

  // subscribe เฉพาะค่าล่าสุดของ MAC ที่มีการ์ด
  useEffect(() => {
    const unsubs = [];
    macListForCards.forEach((mac) => {
      const qLatest = query(
        collection(db, 'sensors', mac, 'history'),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );
      const unsub = onSnapshot(qLatest, (snap) => {
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
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u && u());
  }, [macListForCards]);

  const metaByMac = useMemo(() => {
    const map = {};
    sensorsMeta.forEach((m) => (map[m.mac] = m));
    return map;
  }, [sensorsMeta]);

  // รายชื่อ MAC ให้เลือกในโมดอล = union(history ∪ sensors)
  const allMacChoices = useMemo(() => {
    const set = new Set();
    macsFromHistory.forEach((m) => set.add(m));
    sensorsMeta.forEach((m) => set.add(m.mac));
    return Array.from(set);
  }, [macsFromHistory, sensorsMeta]);

  const goHistory = (mac) => {
    if (!hasPermission('view_history')) {
      alert('กรุณาเข้าสู่ระบบเพื่อดูประวัติข้อมูล');
      navigate('/login');
      return;
    }
    navigate(`/history/${encodeURIComponent(mac)}`);
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

  const handleDeleteSensor = async (mac) => {
    if (!hasPermission('delete_sensor')) {
      alert('คุณไม่มีสิทธิ์ลบเครื่อง');
      return;
    }
    if (!window.confirm(`ลบเครื่อง ${mac} ?`)) return;
    try {
      await deleteDoc(doc(db, 'sensors', mac));
      alert('✅ ลบเครื่องเรียบร้อย');
    } catch (e) {
      alert('❌ เกิดข้อผิดพลาด: ' + e.message);
    }
  };

  // ผูกจาก MAC ที่มีอยู่
  const openBindModal = () => {
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

  // เพิ่มด้วยการพิมพ์ MAC เอง
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch {
      alert('ออกจากระบบไม่สำเร็จ');
    }
  };

  return (
    <div style={styles.background}>
      <Navbar user={user} userRole={userRole} onLogout={handleLogout} />

      <div style={styles.moduleBox}>
        <span style={styles.moduleText}>Module Dashboard</span>
      </div>

      <div style={styles.mainContentBox}>
        {/* กล่องเพิ่ม/ผูกเครื่อง */}
        {hasPermission('add_sensor') && (
          <div style={styles.addSensorBox}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>เพิ่ม/ผูกเครื่อง</div>

            {/* ปุ่มผูกจาก MAC ที่มีอยู่แล้ว */}
            <button onClick={openBindModal} style={{ ...styles.button, backgroundColor: '#4f9cf5', color: '#fff' }}>
              🔗 ผูกเครื่องจาก MAC ที่มีอยู่
            </button>

            {/* เพิ่มด้วยการพิมพ์ MAC เอง */}
            <div style={{ marginTop: 10, width: '100%', display: 'grid', gap: 8 }}>
              <input
                value={manualMac}
                onChange={(e) => setManualMac(e.target.value)}
                placeholder="กรอก MAC (เช่น E4:65:...)"
                style={styles.input}
              />
              <input
                value={manualAlias}
                onChange={(e) => setManualAlias(e.target.value)}
                placeholder="ตั้งชื่อเล่น (ไม่บังคับ)"
                style={styles.input}
              />
              <button onClick={handleAddByManualMac} style={styles.button}>➕ เพิ่ม/ผูกด้วย MAC ที่พิมพ์</button>
            </div>
          </div>
        )}

        {/* การ์ดอุปกรณ์: เฉพาะที่ผูกแล้ว */}
        <div style={styles.cardContainer}>
          {macListForCards.length === 0 ? (
            <div style={styles.noDataMessage}>📭 ยังไม่พบอุปกรณ์</div>
          ) : (
            macListForCards.map((mac) => {
              const meta = metaByMac[mac] || {};
              const latest = latestByMac[mac];
              const displayName = meta.name || mac;
              const lat = fmtCoord(meta.latitude);
              const lng = fmtCoord(meta.longitude);

              return (
                <div key={mac} style={styles.card}>
                  <h3 style={styles.cardTitle}>{displayName}</h3>

                  <div style={styles.dataBox}>
                    <div style={styles.smallBoxLeft}>
                      <ReactSpeedometer
                        value={toNum(latest?.temperature)}
                        maxValue={50}
                        segments={5}
                        needleColor="black"
                        startColor="green"
                        endColor="red"
                        height={120}
                        width={160}
                        ringWidth={20}
                        currentValueText={`อุณหภูมิ: ${fmt(latest?.temperature)}°C`}
                      />
                    </div>

                    <div style={styles.bigBox}>
                      <ReactSpeedometer
                        value={toNum(latest?.dust)}
                        maxValue={250}
                        segments={5}
                        needleColor="gray"
                        startColor="#B0E57C"
                        endColor="#8B0000"
                        height={160}
                        width={200}
                        ringWidth={20}
                        currentValueText={`ฝุ่น: ${fmt(latest?.dust)} µg/m³`}
                      />
                    </div>

                    <div style={styles.smallBoxRight}>
                      <ReactSpeedometer
                        value={toNum(latest?.humidity)}
                        maxValue={100}
                        segments={5}
                        needleColor="orange"
                        startColor="lightblue"
                        endColor="darkblue"
                        height={120}
                        width={160}
                        ringWidth={20}
                        currentValueText={`ความชื้น: ${fmt(latest?.humidity)}%`}
                      />
                    </div>
                  </div>

                  {/* Battery */}
                  <div style={styles.batteryBox}>
                    🔋 Battery: <b>{typeof meta.battery === 'number' ? `${meta.battery}%` : '—'}</b>
                    <div style={styles.batteryBarOuter}>
                      <div
                        style={{
                          ...styles.batteryBarInner,
                          width: `${typeof meta.battery === 'number' ? meta.battery : 0}%`,
                          backgroundColor:
                            meta.battery > 50 ? '#22c55e' : meta.battery > 20 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>

                  {/* พิกัด + ปุ่ม */}
                  <div style={styles.coordBox}>
                    <div>
                      <div>📍 ตำแหน่ง: {meta.location || 'ไม่ระบุ'}</div>
                      <div style={{ marginTop: 4, color: '#374151' }}>
                        {lat && lng ? (
                          <>Lat: <b>{lat}</b>, Lng: <b>{lng}</b></>
                        ) : (
                          <i>ยังไม่มีพิกัด</i>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {lat && lng && (
                        <a
                          href={mapUrl(meta.latitude, meta.longitude)}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.mapButton}
                          title="เปิดใน Google Maps"
                        >
                          🗺️ เปิดแผนที่
                        </a>
                      )}
                      {hasPermission('update_location') && (
                        <button
                          onClick={() => updateLocationFromBrowser(mac)}
                          style={styles.button}
                          disabled={loadingGPS}
                          title="อัปเดตพิกัดจากเบราว์เซอร์ของคุณ"
                        >
                          {loadingGPS ? '📍 กำลังดึงพิกัด...' : '📍 ดึงตำแหน่งจากเบราว์เซอร์'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => goHistory(mac)} style={styles.historyButton}>📊 ดูกราฟย้อนหลัง</button>
                    {hasPermission('delete_sensor') && (
                      <button style={styles.deleteButton} onClick={() => handleDeleteSensor(mac)}>
                        🗑️ ลบเครื่อง
                      </button>
                    )}
                  </div>

                  <div style={styles.locationBox}>
                    ⏱ อัปเดตล่าสุด: {latest?.updatedAt ? latest.updatedAt.toLocaleString() : '—'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* โมดอลผูกจาก MAC ที่มีอยู่ */}
      {showBindModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <h3 style={{ marginTop: 0 }}>ผูกเครื่องจาก MAC ที่มีอยู่</h3>
            {allMacChoices.length === 0 ? (
              <div style={{ marginBottom: 12 }}>ยังไม่พบ MAC ใดๆ ในระบบ</div>
            ) : (
              <>
                <label style={styles.modalLabel}>เลือก MAC</label>
                <select
                  value={selectedMac}
                  onChange={(e) => setSelectedMac(e.target.value)}
                  style={styles.select}
                >
                  {allMacChoices.map((mac) => (
                    <option key={mac} value={mac}>{mac}</option>
                  ))}
                </select>

                <label style={styles.modalLabel}>ตั้งชื่อ (ไม่บังคับ)</label>
                <input
                  value={aliasName}
                  onChange={(e) => setAliasName(e.target.value)}
                  placeholder="เช่น ห้อง Lab ชั้น 2"
                  style={styles.input}
                />

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={handleBindExistingMac} style={{ ...styles.button, backgroundColor: '#10b981', color: '#fff' }}>
                    ✅ ผูกเครื่อง
                  </button>
                  <button onClick={() => setShowBindModal(false)} style={{ ...styles.button, backgroundColor: '#e5e7eb' }}>
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

// ===== utils =====
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
const styles = {
  background: {
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    backgroundColor: '#2e3e50',
    color: '#111',
    minHeight: '100vh',
    width: '100vw',
    backgroundImage: "url('/ss.jpg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'scroll',
    overflowX: 'hidden',
    margin: 0,
    paddingTop: '80px', // เว้น navbar
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingBottom: '20px',
  },
  moduleBox: { textAlign: 'center', marginBottom: '12px' },
  moduleText: {
    backgroundColor: '#aeeeee',
    color: '#1a1a1a',
    padding: '8px 20px',
    borderRadius: '10px',
    fontWeight: 'bold',
    fontSize: '1.2rem',
    display: 'inline-block',
  },
  mainContentBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    width: '100%',
    maxWidth: 1400,
    margin: '0 auto',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'auto', // ให้เลื่อนลงได้
  },
  addSensorBox: {
    display: 'grid',
    gap: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: '16px',
    borderRadius: '14px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: 600,
  },
  input: {
    padding: '10px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    width: '100%',
    boxSizing: 'border-box',
  },
  button: {
    padding: '10px 16px',
    fontSize: '1rem',
    backgroundColor: '#a2e8f5',
    color: '#000',
    border: '2px solid #000',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  historyButton: {
    padding: '10px 16px',
    fontSize: '1rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 8px rgba(40, 167, 69, 0.25)',
  },
  cardContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '20px',
    width: '100%',
    padding: '10px',
    boxSizing: 'border-box',
  },
  noDataMessage: {
    textAlign: 'center',
    fontSize: '1.2rem',
    color: '#444',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: '30px',
    borderRadius: '12px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    width: '380px',
    maxWidth: '92vw',
    boxSizing: 'border-box',
  },
  cardTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#222',
    marginBottom: '6px',
    textAlign: 'center',
  },
  dataBox: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: 'auto auto',
    columnGap: '10px',
    rowGap: '4px',
    width: '100%',
    justifyItems: 'center',
    alignItems: 'center',
  },
  bigBox: {
    gridColumn: '1 / 4',
    gridRow: '1 / 2',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  smallBoxLeft: {
    gridColumn: '1 / 2',
    gridRow: '2 / 3',
    display: 'flex',
    justifyContent: 'center',
  },
  smallBoxRight: {
    gridColumn: '3 / 4',
    gridRow: '2 / 3',
    display: 'flex',
    justifyContent: 'center',
  },
  locationBox: {
    fontSize: '0.9rem',
    color: '#555',
    textAlign: 'center',
    marginTop: '6px',
  },
  coordBox: {
    marginTop: '8px',
    padding: '10px',
    width: '100%',
    borderRadius: 10,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  mapButton: {
    display: 'inline-block',
    padding: '10px 14px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 10,
    fontSize: '0.95rem',
    boxShadow: '0 3px 8px rgba(59,130,246,0.25)',
  },
  mapWrap: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    background: '#f3f4f6',
  },
  mapFrame: {
    width: '100%',
    height: '100%',
    border: 0,
  },
  mapPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'grid',
    placeItems: 'center',
    color: '#6b7280',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#ff4d4d',
    color: '#fff',
    border: 'none',
    padding: '10px 15px',
    fontSize: '1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  // Modal
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalCard: {
    width: 'min(92vw, 480px)',
    background: '#fff',
    color: '#111',
    borderRadius: 16,
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
    padding: 20,
  },
  modalLabel: {
    display: 'block',
    fontSize: 14,
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
  },
  select: {
    width: '100%',
    padding: '10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
  },
  batteryBox: {
    marginTop: 10,
    width: '100%',
    fontSize: '0.95rem',
    color: '#374151',
  },
  batteryBarOuter: {
    width: '100%',
    height: 14,
    background: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  batteryBarInner: {
    height: '100%',
    transition: 'width .3s ease',
    borderRadius: 999,
  },
};
