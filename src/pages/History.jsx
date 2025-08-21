import React from "react";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import "./History.css"; // Assuming you have a CSS file for styling
import { useNavigate, useParams } from "react-router-dom";
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement, PointElement, CategoryScale, LinearScale, Title, Tooltip, Legend, Filler,
} from "chart.js";
ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Title, Tooltip, Legend, Filler);

export default function History() {
  const [data, setData] = useState([]);
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ✅ รองรับทั้ง /history/:macAddr หรือ /history/:mac
  const params = useParams();
  const macRaw = params.macAddr ?? params.mac ?? "";      // << ดึงให้ครอบคลุม
  const mac = macRaw ? decodeURIComponent(macRaw) : "";   // << decode ให้เรียบร้อย

  useEffect(() => {
    // ถ้าไม่มี mac อย่าเพิ่งยิง Firestore
    if (!mac) return;

    let unsubHistory;

    (async () => {
      try {
        setLoading(true);

        // ชื่อเครื่อง
        const metaRef = doc(db, "sensors", mac);
        const metaSnap = await getDoc(metaRef);
        setDeviceName(metaSnap.exists() ? (metaSnap.data().name || mac) : mac);

        // ประวัติ
        const logsRef = collection(db, "sensors", mac, "history");
        const q = query(logsRef, orderBy("updatedAt", "asc"), limit(200));
        unsubHistory = onSnapshot(q, (snap) => {
          const rows = snap.docs.map(d => {
            const x = d.data();
            return {
              id: d.id,
              temperature: x.temperature,
              humidity: x.humidity,
              dust: x.dust,
              updatedAt: x.updatedAt?.toDate ? x.updatedAt.toDate() : new Date(),
            };
          });
          setData(rows);
          setLoading(false);
        }, () => setLoading(false));
      } catch {
        setLoading(false);
      }
    })();

    return () => { if (unsubHistory) unsubHistory(); };
  }, [mac]);
  // ค่าเฉลี่ยและค่าใหม่ล่าสุด
  const latestTemp = data.length ? data[data.length - 1].temperature.toFixed(1) : "-";
  const avgTemp = data.length ? (data.reduce((acc, cur) => acc + cur.temperature, 0) / data.length).toFixed(1) : "-";

  const chartData = {
    labels: data.map(d => d.updatedAt.toLocaleTimeString()),
    datasets: [
      {
        label: "Temperature (°C)",
        data: data.map(d => d.temperature),
        fill: true,
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        borderColor: "#3b82f6",
        pointBackgroundColor: "#1e40af",
        pointBorderColor: "#1e40af",
        pointRadius: 5,
        pointHoverRadius: 8,
        tension: 0.3,
        borderWidth: 3,
      },
      {
        label: "Humidity (%)",
        data: data.map(d => d.humidity),
        fill: false,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.2)",
        pointBackgroundColor: "#047857",
        pointBorderColor: "#047857",
        pointRadius: 5,
        pointHoverRadius: 8,
        tension: 0.3,
        borderWidth: 3,
      },
      {
        label: "Dust (µg/m³)",
        data: data.map(d => d.dust),
        fill: false,
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.2)",
        pointBackgroundColor: "#b45309",
        pointBorderColor: "#b45309",
        pointRadius: 5,
        pointHoverRadius: 8,
        tension: 0.3,
        borderWidth: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: { size: 16, weight: "600" },
          color: "#374151",
        },
      },
      title: {
        display: true,
        text: `Sensor Data History - ${deviceName} `,
        font: { size: 20, weight: "bold" },
        color: "#111827",
        padding: { top: 10, bottom: 20 },
      },
    },
  };

  return (
    <div className="history-container">
      <h2 className="history-title">
        📊 ข้อมูลย้อนหลัง: {deviceName}
      </h2>
      <div className="chart-card">
        <Line data={chartData} options={options} />
      </div>
      <div className="summary-cards">
        <p>Latest Temperature: <strong>{latestTemp} °C</strong></p>
        <p>Latest Humidity: <strong>{data.length ? data[data.length - 1].humidity.toFixed(1) : "-"} %</strong></p>
        <p>Latest Dust: <strong>{data.length ? data[data.length - 1].dust.toFixed(1) : "-"} µg/m³</strong></p>
        <p>Average Temperature: <strong>{avgTemp} °C</strong></p>
        <br />

      </div>
      <div className="flex justify-center mt-6">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-red font-semibold rounded-lg shadow-md transition duration-200 ease-in-out"
        >
          ⬅️ ย้อนกลับ
        </button>
      </div>
      {loading && <p className="loading-text">กำลังโหลดข้อมูล...</p>}
    </div>
  );
}
