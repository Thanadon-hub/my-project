// pages/DeviceControl.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";

export default function DeviceControl() {
  const [devices, setDevices] = useState([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "devices"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDevices(data);
    });
    return () => unsub();
  }, []);

  const addDevice = async () => {
    if (!name) return;
    await addDoc(collection(db, "devices"), { name, location });
    setName("");
    setLocation("");
  };

  const removeDevice = async (id) => {
    await deleteDoc(doc(db, "devices", id));
  };

  const updateLocation = async (id, newLoc) => {
    await updateDoc(doc(db, "devices", id), { location: newLoc });
  };

  return (
    <div>
      <h2>Device Control (Admin Only)</h2>
      <input
        type="text"
        placeholder="Device name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <button onClick={addDevice}>Add Device</button>
      <ul>
        {devices.map((dev) => (
          <li key={dev.id}>
            {dev.name} - {dev.location}
            <button onClick={() => removeDevice(dev.id)}>Delete</button>
            <button
              onClick={() => {
                const newLoc = prompt("Enter new location:", dev.location);
                if (newLoc) updateLocation(dev.id, newLoc);
              }}
            >
              Update Location
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
