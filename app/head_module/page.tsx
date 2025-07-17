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

export default function HeadModule() {
  const { isConnected, getRos, robotNamespace, ensureConnection } = useRos();
  const [roll, setRoll] = useState(0); // -80 to 80
  const [pitch, setPitch] = useState(0); // 0 to 90
  const [override, setOverride] = useState(false);

  // Ensure connection is maintained when component mounts
  useEffect(() => {
    if (ensureConnection) {
      ensureConnection();
    }
  }, [ensureConnection]);

  const sendOverrideParam = (value: boolean) => {
    if (!isConnected) return;
    try {
      const ros = getRos();
      const paramClient = new ROSLIB.Service({
        ros: ros,
        name: "/head_controller/set_parameters",
        serviceType: "rcl_interfaces/srv/SetParameters",
      });
      const parameter = new ROSLIB.Message({
        name: "manual_control",
        value: { type: 1, bool_value: value },
      });
      const request = new ROSLIB.ServiceRequest({
        parameters: [parameter],
      });
      paramClient.callService(request, () => {}, () => {});
    } catch (e) {
      // fallback: do nothing
    }
  };



  // Use refs for roll, pitch, and search mode topics, only create/advertise once, reuse for publishing
  const rollTopicRef = useRef<ROSLIB.Topic | null>(null);
  const pitchTopicRef = useRef<ROSLIB.Topic | null>(null);
  const searchModeTopicRef = useRef<ROSLIB.Topic | null>(null);

  // Initialize topics when connected
  useEffect(() => {
    if (!isConnected) {
      if (rollTopicRef.current) {
        rollTopicRef.current.unadvertise();
        rollTopicRef.current = null;
      }
      if (pitchTopicRef.current) {
        pitchTopicRef.current.unadvertise();
        pitchTopicRef.current = null;
      }
      if (searchModeTopicRef.current) {
        searchModeTopicRef.current.unadvertise();
        searchModeTopicRef.current = null;
      }
      return;
    }
    const ros = getRos();
    console.log('[HeadModule] Creating topics with robotNamespace:', robotNamespace);
    rollTopicRef.current = new ROSLIB.Topic({
      ros: ros,
      name: `/${robotNamespace || ""}/head_controller/roll`,
      messageType: "std_msgs/msg/Int8",
    });
    pitchTopicRef.current = new ROSLIB.Topic({
      ros: ros,
      name: `/${robotNamespace || ""}/head_controller/pitch`,
      messageType: "std_msgs/msg/Int8",
    });
    searchModeTopicRef.current = new ROSLIB.Topic({
      ros: ros,
      name: `/${robotNamespace || ""}/head_controller/search_mode`,
      messageType: "std_msgs/msg/String",
    });
    rollTopicRef.current.advertise();
    pitchTopicRef.current.advertise();
    searchModeTopicRef.current.advertise();
    return () => {
      if (rollTopicRef.current) {
        rollTopicRef.current.unadvertise();
        rollTopicRef.current = null;
      }
      if (pitchTopicRef.current) {
        pitchTopicRef.current.unadvertise();
        pitchTopicRef.current = null;
      }
      if (searchModeTopicRef.current) {
        searchModeTopicRef.current.unadvertise();
        searchModeTopicRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, robotNamespace, getRos]);
  // Handler to send search mode
  const handleSearchMode = (mode: string) => {
    if (!isConnected || !searchModeTopicRef.current) return;
    const msg = new ROSLIB.Message({ data: mode });
    searchModeTopicRef.current.publish(msg);
    console.log('[HeadModule] Sent search mode:', mode);
  };

  // Publish roll and pitch values every 1 second
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      if (!override) return;
      try {
        if (rollTopicRef.current) {
          const rollMsg = new ROSLIB.Message({ data: roll });
          console.log('[HeadModule] Publishing roll:', roll, 'to', rollTopicRef.current.name);
          rollTopicRef.current.publish(rollMsg);
        }
      } catch (e) {}
      try {
        if (pitchTopicRef.current) {
          const pitchMsg = new ROSLIB.Message({ data: pitch });
          console.log('[HeadModule] Publishing pitch:', pitch, 'to', pitchTopicRef.current.name);
          pitchTopicRef.current.publish(pitchMsg);
        }
      } catch (e) {}
    }, 1000);
    return () => clearInterval(interval);
  }, [roll, pitch, isConnected, override]);

  // Slider handlers
  const handleRollChange = (val: number) => {
    setRoll(val);
  };
  const handlePitchChange = (val: number) => {
    setPitch(val);
  };

  // Handle override toggle
  const handleOverride = () => {
    setOverride((prev) => {
      sendOverrideParam(!prev);
      return !prev;
    });
  };

  return (
    <div className="min-h-screen p-6 bg-white">
      <header className="mb-8">
        <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
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
                  Head Module
                </h1>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleOverride}
                className={`px-6 py-3 rounded-lg font-medium border transition-colors ${
                  override
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {override ? "Override Control ON" : "Override Control OFF"}
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>
      <ConnectionStatusBar showFullControls={false} />
      <div className="max-w-xl mx-auto mt-12 bg-white border border-gray-200 shadow-sm rounded-lg p-8">
        {/* Search Mode Buttons */}
        <div className="mb-10 flex flex-col items-center">
          <label className="block text-lg font-semibold text-gray-900 mb-4">Search Mode</label>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => handleSearchMode('swing')}
              className="px-5 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold border border-blue-300 shadow-sm transition-colors"
            >
              Swing
            </button>
            <button
              onClick={() => handleSearchMode('sweep')}
              className="px-5 py-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-800 font-semibold border border-green-300 shadow-sm transition-colors"
            >
              Sweep
            </button>
            <button
              onClick={() => handleSearchMode('square')}
              className="px-5 py-2 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-semibold border border-yellow-300 shadow-sm transition-colors"
            >
              Square
            </button>
            <button
              onClick={() => handleSearchMode('nod')}
              className="px-5 py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-semibold border border-purple-300 shadow-sm transition-colors"
            >
              Nod
            </button>
          </div>
        </div>
        <div className="mb-10">
          <label className="block text-lg font-semibold text-gray-900 mb-4">Roll / Pan</label>
          <input
            type="range"
            min={-80}
            max={80}
            value={roll}
            onChange={e => handleRollChange(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>-80°</span>
            <span>{roll}°</span>
            <span>80°</span>
          </div>
        </div>
        <div className="mb-10">
          <label className="block text-lg font-semibold text-gray-900 mb-4">Pitch / Tilt</label>
          <input
            type="range"
            min={-60}
            max={60}
            value={pitch}
            onChange={e => handlePitchChange(Number(e.target.value))}
            className="w-full accent-green-600"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>-60°</span>
            <span>{pitch}°</span>
            <span>60°</span>
          </div>
        </div>
        <div className="flex justify-center mt-8">
          <button
            onClick={() => { setRoll(0); setPitch(0); }}
            className="px-6 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold border border-gray-300 shadow-sm transition-colors"
          >
            Center (0, 0)
          </button>
        </div>
      </div>
    </div>
  );
}
