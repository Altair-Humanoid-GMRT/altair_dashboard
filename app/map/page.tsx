"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import ROSLIB from "roslib";
import ConnectionStatusBar from "@/components/ConnectionStatusBar";
import { useRos } from "@/contexts/RosContext";

interface RobotPosition {
  x: number;
  y: number;
  theta: number;
  heading: string;
  timestamp: string;
}

interface Marker {
  id: number;
  x: number;
  y: number;
  heading: string;
  timestamp: string;
  status: string;
}

export default function RobotMapWithHeading() {
  const mapRef = useRef(null);
  const [robotPos, setRobotPos] = useState<RobotPosition | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const { isConnected, getRos, robotNamespace, connectionStatus, ensureConnection } = useRos();

  // Ensure connection is maintained when component mounts
  useEffect(() => {
    if (ensureConnection) {
      ensureConnection();
    }
  }, [ensureConnection]);

  // Subscribe to odometry
  useEffect(() => {
    if (!isConnected) return;

    const ros = getRos();
    const odom = new ROSLIB.Topic({
      ros: ros,
      name: "/walk_engine_odometry",
      messageType: "nav_msgs/Odometry",
    });

    const callback = (msg: any) => {
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
  }, [isConnected, getRos]);

  // Convert radians to cardinal direction
  const getCardinalDirection = (theta: number) => {
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
  const removeMarker = (id: number) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="min-h-screen p-6 bg-white">
      {/* Removed animated background elements for white mode */}

      {/* Header */}
      <header className="mb-8">
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                {/* Back Button */}
                <button
                  onClick={() => (window.location.href = "/")}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm font-medium">Back to Dashboard</span>
                </button>
                <h1 className="text-4xl font-bold text-gray-900">
                  Robot Map & Navigation
                </h1>
              </div>
            </div>

            <div className="flex gap-3">
              {/* Additional controls can be added here if needed */}
            </div>
          </div>
        </div>
      </header>

      {/* Connection Status Bar */}
      <ConnectionStatusBar showFullControls={false} />

      {/* Main Content */}
      <div className="flex gap-8">
        {/* Map Display */}
        <div className="flex-1">
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">
              Live Robot Map
            </h2>

            <div
              ref={mapRef}
              className="relative w-full h-[600px] bg-gray-100 rounded-lg border border-gray-200 overflow-hidden"
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
                  <div className="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-lg relative">
                    {/* Heading arrow */}
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="w-0 h-0 border-l-2 border-r-2 border-b-4 border-l-transparent border-r-transparent border-b-red-500 shadow-sm"></div>
                    </div>
                    {/* Heading label */}
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 px-2 py-1 rounded text-xs font-bold text-gray-800 shadow-lg">
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
                  <div className="w-5 h-5 bg-green-600 rounded-full border-2 border-white shadow-lg relative">
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-green-600 px-1 py-0.5 rounded text-xs font-bold text-white shadow-sm">
                      {marker.heading}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Robot Status Info */}
            {robotPos && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-600 mb-1">Position</div>
                  <div className="text-xl font-bold text-gray-900">
                    ({robotPos.x.toFixed(2)}, {robotPos.y.toFixed(2)})
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-sm text-purple-600 mb-1">Heading</div>
                  <div className="text-xl font-bold text-gray-900">
                    {robotPos.heading} (
                    {((robotPos.theta * 180) / Math.PI).toFixed(1)}°)
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-600 mb-1">Last Update</div>
                  <div className="text-xl font-bold text-gray-900">
                    {robotPos.timestamp}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Control Panel */}
        <div className="w-80">
          <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6">
            <h3 className="text-xl font-bold mb-6 text-gray-900">
              Map Controls
            </h3>

            <div className="space-y-4">
              <button
                onClick={addMarker}
                className="w-full bg-green-600 hover:bg-green-700 px-6 py-4 rounded-lg font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 shadow-lg border border-green-500"
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
                className="w-full bg-red-600 hover:bg-red-700 px-6 py-4 rounded-lg font-medium text-white transition-all duration-300 hover:scale-105 shadow-lg border border-red-500"
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
            <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Statistics
              </h4>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {markers.length}
                  </div>
                  <div className="text-xs text-gray-600">Active Markers</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {isConnected ? "1" : "0"}
                  </div>
                  <div className="text-xs text-gray-600">Connected Robots</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Marker Monitoring Table */}
      <div className="mt-8">
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-8">
          <h3 className="text-2xl font-bold mb-6 text-gray-900">
            Marker Monitoring
          </h3>

          {markers.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-6xl mb-4">📍</div>
              <div className="text-xl mb-2">No markers placed yet</div>
              <div>Add markers to track robot positions on the map</div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      ID
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Position (X,Y)
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Heading
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Timestamp
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Status
                    </th>
                    <th className="text-left p-4 text-gray-700 font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {markers.map((marker, index) => (
                    <tr
                      key={marker.id}
                      className={`${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } hover:bg-gray-100 transition-all duration-200`}
                    >
                      <td className="p-4 text-gray-900 font-mono">
                        #{marker.id.toString().slice(-4)}
                      </td>
                      <td className="p-4 text-gray-900 font-mono">
                        ({marker.x.toFixed(2)}, {marker.y.toFixed(2)})
                      </td>
                      <td className="p-4 text-gray-900 font-semibold">
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm border border-purple-200">
                          {marker.heading}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 text-sm">
                        {marker.timestamp}
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium border border-green-200">
                          {marker.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => removeMarker(marker.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-red-200"
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
