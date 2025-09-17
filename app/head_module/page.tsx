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
  const [roll, setRoll] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [override, setOverride] = useState(false);
  // Dynamic limits for roll and pitch
  const [rollMax, setRollMax] = useState<string>("80");
  const [rollMin, setRollMin] = useState<string>("-80");
  const [pitchMax, setPitchMax] = useState<string>("60");
  const [pitchMin, setPitchMin] = useState<string>("-60");

  // Read limits from ROS2 params on mount/connection
  useEffect(() => {
    if (!isConnected) return;
    try {
      const ros = getRos();
      const paramClient = new ROSLIB.Service({
        ros: ros,
        name: `/${robotNamespace}/head_controller/get_parameters`,
        serviceType: "rcl_interfaces/srv/GetParameters",
      });
      const request = new ROSLIB.ServiceRequest({
        names: [
          "limit.roll_max",
          "limit.roll_min",
          "limit.pitch_max",
          "limit.pitch_min",
        ],
      });
      paramClient.callService(request, (result) => {
        // result.values is an array of parameter values
        if (result && result.values && Array.isArray(result.values)) {
        result.values.forEach((param: any, idx: number) => {
          // param.double_value is the value
          if (typeof param.double_value === "number") {
            switch (idx) {
              case 0: setRollMax(String(param.double_value)); break;
              case 1: setRollMin(String(param.double_value)); break;
              case 2: setPitchMax(String(param.double_value)); break;
              case 3: setPitchMin(String(param.double_value)); break;
            }
          }
        });
        }
      }, () => {});
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Set parameter helper
  const setLimitParam = (paramName: string, value: number) => {
    if (!isConnected) return;
    try {
      const ros = getRos();
      const paramClient = new ROSLIB.Service({
        ros: ros,
        name: `/${robotNamespace}/head_controller/set_parameters`,
        serviceType: "rcl_interfaces/srv/SetParameters",
      });
      const parameter = new ROSLIB.Message({
        name: paramName,
        value: { type: 3, double_value: value },
      });
      const request = new ROSLIB.ServiceRequest({
        parameters: [parameter],
      });
      paramClient.callService(request, () => {}, () => {});
    } catch (e) {}
  };
  const [showSettings, setShowSettings] = useState(false);

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
        name: `/${robotNamespace}/head_controller/set_parameters`,
        serviceType: "rcl_interfaces/srv/SetParameters",
      });
      const parameter = new ROSLIB.Message({
        name: "override_control",
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
    
    // Helper function to format topic paths correctly
    const getTopicPath = (topic: string): string => {
      if (!robotNamespace || robotNamespace === '') {
        return `/${topic}`;
      }
      return `/${robotNamespace}/${topic}`;
    };
    
    const ros = getRos();
    console.log('[HeadModule] Creating topics with robotNamespace:', robotNamespace);
    rollTopicRef.current = new ROSLIB.Topic({
      ros: ros,
      name: getTopicPath('head_controller/roll'),
      messageType: "std_msgs/msg/Int8",
    });
    pitchTopicRef.current = new ROSLIB.Topic({
      ros: ros,
      name: getTopicPath('head_controller/pitch'),
      messageType: "std_msgs/msg/Int8",
    });
    searchModeTopicRef.current = new ROSLIB.Topic({
      ros: ros,
      name: getTopicPath('head_controller/search_mode'),
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
                  onClick={() => {
                    const basePath = window.location.hostname === "localhost" ? "/" : "/altair_dashboard";
                    window.location.href = basePath;
                  }}
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
        {/* Settings Section */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowSettings((prev) => !prev)}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold border border-gray-300 shadow-sm transition-colors"
          >
            {showSettings ? 'Close Settings' : 'Open Settings'}
          </button>
        </div>
        {showSettings && (
          <div className="mb-10 p-4 border border-gray-300 rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Head Limits Settings</h3>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Max (°)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="any"
                  value={rollMax}
                  onChange={e => {
                    const val = e.target.value;
                    setRollMax(val);
                    const v = Number(val);
                    if (!isNaN(v) && val !== "-") {
                      setLimitParam("limit.roll_max", v);
                    }
                  }}
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Min (°)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="any"
                  value={rollMin}
                  onChange={e => {
                    const val = e.target.value;
                    setRollMin(val);
                    const v = Number(val);
                    if (!isNaN(v) && val !== "-") {
                      setLimitParam("limit.roll_min", v);
                    }
                  }}
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pitch Max (°)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="any"
                  value={pitchMax}
                  onChange={e => {
                    const val = e.target.value;
                    setPitchMax(val);
                    const v = Number(val);
                    if (!isNaN(v) && val !== "-") {
                      setLimitParam("limit.pitch_max", v);
                    }
                  }}
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pitch Min (°)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="any"
                  value={pitchMin}
                  onChange={e => {
                    const val = e.target.value;
                    setPitchMin(val);
                    const v = Number(val);
                    if (!isNaN(v) && val !== "-") {
                      setLimitParam("limit.pitch_min", v);
                    }
                  }}
                  className="w-full border rounded px-2 py-1"
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">These limits affect the range of the sliders below.</div>
          </div>
        )}
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
            min={Number(rollMin)}
            max={Number(rollMax)}
            value={roll}
            onChange={e => handleRollChange(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>{rollMin}°</span>
            <span>{roll}°</span>
            <span>{rollMax}°</span>
          </div>
        </div>
        <div className="mb-10">
          <label className="block text-lg font-semibold text-gray-900 mb-4">Pitch / Tilt</label>
          <input
            type="range"
            min={Number(pitchMin)}
            max={Number(pitchMax)}
            value={pitch}
            onChange={e => handlePitchChange(Number(e.target.value))}
            className="w-full accent-green-600"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>{pitchMin}°</span>
            <span>{pitch}°</span>
            <span>{pitchMax}°</span>
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
