"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import ROSLIB from "roslib";

export default function RobotMapWithHeading() {
  const mapRef = useRef(null);
  const [robotPos, setRobotPos] = useState(null);
  const [ros, setRos] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize ROS connection
  useEffect(() => {
    const ros = new ROSLIB.Ros({ url: "ws://localhost:9090" });

    ros.on("connection", () => {
      console.log("ROS Connected");
      setIsConnected(true);
    });

    ros.on("error", (err) => {
      console.error("ROS Error:", err);
      setIsConnected(false);
    });

    ros.on("close", () => {
      console.log("ROS Disconnected");
      setIsConnected(false);
    });

    setRos(ros);
    return () => ros.close();
  }, []);

  // Subscribe to odometry
  useEffect(() => {
    if (!ros || !isConnected) return;

    const odom = new ROSLIB.Topic({
      ros: ros,
      name: "/walk_engine_odometry",
      messageType: "nav_msgs/Odometry",
    });

    const callback = (msg) => {
      const { position, orientation } = msg.pose.pose;
      const theta = Math.atan2(
        2 * (orientation.w * orientation.z + orientation.x * orientation.y),
        1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z)
      );

      setRobotPos({
        x: position.x,
        y: position.y,
        theta,
        heading: getCardinalDirection(theta),
        timestamp: new Date().toLocaleTimeString(),
      });
    };

    odom.subscribe(callback);
    return () => odom.unsubscribe();
  }, [ros, isConnected]);

  // Convert radians to cardinal direction
  const getCardinalDirection = (theta) => {
    const degrees = theta * (180 / Math.PI);
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
    return directions[index];
  };

  // Add new marker
  const addMarker = () => {
    if (!robotPos) return;

    setMarkers((prev) => [
      ...prev,
      {
        id: Date.now(),
        x: robotPos.x,
        y: robotPos.y,
        heading: robotPos.heading,
        timestamp: robotPos.timestamp,
        status: "active",
      },
    ]);
  };

  // Remove marker
  const removeMarker = (id) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="min-h-screen p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl floating"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl floating"
          style={{ animationDelay: "3s" }}
        ></div>
        <div
          className="absolute top-3/4 left-3/4 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl floating"
          style={{ animationDelay: "1.5s" }}
        ></div>
      </div>

      {/* Header */}
      <header className="relative z-10 mb-8">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg
                    className="w-7 h-7 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                  Robot Map & Navigation
                </h1>
              </div>

              <div
                className={`px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm border transition-all duration-300 status-indicator ${
                  isConnected
                    ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/30 glow-green"
                    : "bg-red-500/20 text-red-100 border-red-400/30 glow-red"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  ></div>
                  {isConnected ? "ROS Connected" : "ROS Disconnected"}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => (window.location.href = "/")}
                className="glass-button px-6 py-3 rounded-xl font-medium text-white border-gray-400/30"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Back to Dashboard
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex gap-8">
        {/* Map Display */}
        <div className="flex-1">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
              Live Robot Map
            </h2>

            <div
              ref={mapRef}
              className="relative w-full h-[600px] bg-gray-900/50 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden"
            >
              <Image
                src="/map.png"
                alt="Map"
                fill
                className="object-contain pointer-events-none"
                priority
              />

              {/* Robot with Heading Direction */}
              {robotPos && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `
                    translate(
                      calc(-50% + ${robotPos.x * 100}px),
                      calc(-50% - ${robotPos.y * 100}px)
                    )
                    rotate(${robotPos.theta}rad)
                  `,
                    zIndex: 20,
                  }}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-white shadow-lg relative">
                    {/* Heading arrow */}
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="w-0 h-0 border-l-2 border-r-2 border-b-4 border-l-transparent border-r-transparent border-b-red-500 shadow-sm"></div>
                    </div>
                    {/* Heading label */}
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-800 shadow-lg border border-white/50">
                      {robotPos.heading}
                    </div>
                  </div>
                </div>
              )}

              {/* Static Markers */}
              {markers.map((marker) => (
                <div
                  key={marker.id}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `
                      translate(
                        calc(-50% + ${marker.x * 100}px),
                        calc(-50% - ${marker.y * 100}px)
                      )
                    `,
                    zIndex: 15,
                  }}
                >
                  <div className="w-5 h-5 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full border-2 border-white shadow-lg relative">
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-emerald-500/90 backdrop-blur-sm px-1 py-0.5 rounded text-xs font-bold text-white shadow-sm border border-emerald-400/50">
                      {marker.heading}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Robot Status Info */}
            {robotPos && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card rounded-xl p-4 border border-blue-400/30">
                  <div className="text-sm text-white/70 mb-1">Position</div>
                  <div className="text-xl font-bold text-white">
                    ({robotPos.x.toFixed(2)}, {robotPos.y.toFixed(2)})
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 border border-purple-400/30">
                  <div className="text-sm text-white/70 mb-1">Heading</div>
                  <div className="text-xl font-bold text-white">
                    {robotPos.heading} (
                    {((robotPos.theta * 180) / Math.PI).toFixed(1)}°)
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 border border-emerald-400/30">
                  <div className="text-sm text-white/70 mb-1">Last Update</div>
                  <div className="text-xl font-bold text-white">
                    {robotPos.timestamp}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Control Panel */}
        <div className="w-80">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
              Map Controls
            </h3>

            <div className="space-y-4">
              <button
                onClick={addMarker}
                className="w-full glass-button bg-gradient-to-r from-emerald-500/30 to-green-600/30 border-emerald-400/40 px-6 py-4 rounded-xl font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-400/40 hover:to-green-500/40 transform hover:scale-105"
                disabled={!robotPos}
              >
                <div className="flex items-center justify-center gap-3">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Add Marker at Current Position
                </div>
              </button>

              <button
                onClick={() => setMarkers([])}
                className="w-full glass-button bg-gradient-to-r from-red-500/30 to-red-600/30 border-red-400/40 px-6 py-4 rounded-xl font-medium text-white transition-all duration-300 hover:from-red-400/40 hover:to-red-500/40 transform hover:scale-105"
                disabled={markers.length === 0}
              >
                <div className="flex items-center justify-center gap-3">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"
                      clipRule="evenodd"
                    />
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zM12 7a1 1 0 112 0v4a1 1 0 11-2 0V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Clear All Markers
                </div>
              </button>
            </div>

            {/* Marker Statistics */}
            <div className="mt-8 glass-card rounded-xl p-4 border border-white/10">
              <h4 className="text-sm font-semibold text-white/80 mb-3">
                Statistics
              </h4>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {markers.length}
                  </div>
                  <div className="text-xs text-white/60">Active Markers</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    {isConnected ? "1" : "0"}
                  </div>
                  <div className="text-xs text-white/60">Connected Robots</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Marker Monitoring Table */}
      <div className="relative z-10 mt-8">
        <div className="glass-card rounded-2xl p-8">
          <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
            Marker Monitoring
          </h3>

          {markers.length === 0 ? (
            <div className="text-center py-16 text-white/60">
              <div className="text-6xl mb-4">📍</div>
              <div className="text-xl mb-2">No markers placed yet</div>
              <div>Add markers to track robot positions on the map</div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/20">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/10 backdrop-blur-sm">
                    <th className="text-left p-4 text-white/80 font-semibold">
                      ID
                    </th>
                    <th className="text-left p-4 text-white/80 font-semibold">
                      Position (X,Y)
                    </th>
                    <th className="text-left p-4 text-white/80 font-semibold">
                      Heading
                    </th>
                    <th className="text-left p-4 text-white/80 font-semibold">
                      Timestamp
                    </th>
                    <th className="text-left p-4 text-white/80 font-semibold">
                      Status
                    </th>
                    <th className="text-left p-4 text-white/80 font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {markers.map((marker, index) => (
                    <tr
                      key={marker.id}
                      className={`${
                        index % 2 === 0 ? "bg-white/5" : "bg-white/10"
                      } hover:bg-white/20 transition-all duration-200`}
                    >
                      <td className="p-4 text-white/90 font-mono">
                        #{marker.id.toString().slice(-4)}
                      </td>
                      <td className="p-4 text-white/90 font-mono">
                        ({marker.x.toFixed(2)}, {marker.y.toFixed(2)})
                      </td>
                      <td className="p-4 text-white/90 font-semibold">
                        <span className="px-3 py-1 bg-purple-500/20 text-purple-200 rounded-full text-sm border border-purple-400/30">
                          {marker.heading}
                        </span>
                      </td>
                      <td className="p-4 text-white/70 text-sm">
                        {marker.timestamp}
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-200 rounded-full text-sm font-medium border border-emerald-400/30">
                          {marker.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => removeMarker(marker.id)}
                          className="glass-button bg-red-500/20 hover:bg-red-500/30 text-red-200 px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-red-400/30"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced Styles
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },
  mapContainer: {
    position: "relative",
    width: "800px",
    height: "600px",
    border: "2px solid #333",
    marginBottom: "20px",
  },
  mapImage: {
    objectFit: "contain",
    pointerEvents: "none",
  },
  robotBase: {
    width: "24px",
    height: "24px",
    backgroundColor: "blue",
    borderRadius: "50%",
    border: "2px solid white",
    position: "relative",
  },
  robotHeading: {
    position: "absolute",
    top: "-15px",
    left: "50%",
    width: "0",
    height: "0",
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderBottom: "15px solid red",
    transform: "translateX(-50%)",
  },
  headingLabel: {
    position: "absolute",
    top: "-35px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(255,255,255,0.8)",
    padding: "2px 5px",
    borderRadius: "3px",
    fontSize: "12px",
    fontWeight: "bold",
  },
  staticMarker: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "16px",
    height: "16px",
    backgroundColor: "#4CAF50",
    borderRadius: "50%",
    border: "2px solid white",
    zIndex: 15,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  markerHeading: {
    position: "absolute",
    top: "-20px",
    fontSize: "10px",
    fontWeight: "bold",
    background: "rgba(255,255,255,0.8)",
    padding: "1px 3px",
    borderRadius: "2px",
  },
  controlPanel: {
    width: "800px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  button: {
    padding: "10px 15px",
    backgroundColor: "#2196F3",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    ":disabled": {
      backgroundColor: "#cccccc",
      cursor: "not-allowed",
    },
  },
  status: {
    fontSize: "14px",
    color: "#333",
  },
  monitoringPanel: {
    width: "800px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "20px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  panelTitle: {
    marginTop: "0",
    color: "#333",
    borderBottom: "1px solid #eee",
    paddingBottom: "10px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "10px",
    fontSize: "14px",
  },
  smallButton: {
    padding: "5px 10px",
    fontSize: "12px",
    backgroundColor: "#ffebee",
    border: "1px solid #ef9a9a",
    borderRadius: "3px",
    cursor: "pointer",
  },
};
