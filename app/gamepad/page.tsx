"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import ROSLIB from "roslib";

interface TouchPosition {
  x: number;
  y: number;
}

export default function VirtualGamepad() {
  const [rosConnected, setRosConnected] = useState(false);
  const [connectionUri, setConnectionUri] = useState("ws://localhost:9090");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Value caps with default maximum of 0.1
  const [valueCaps, setValueCaps] = useState({
    x: 0.1,
    y: 0.03,
    theta: 0.1
  });
  
  // Control values
  const [controlValues, setControlValues] = useState({
    x: 0,
    y: 0,
    theta: 0
  });

  // Virtual joystick states
  const [leftJoystick, setLeftJoystick] = useState<TouchPosition>({ x: 0, y: 0 });
  const [rightJoystick, setRightJoystick] = useState<TouchPosition>({ x: 0, y: 0 });
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rosRef = useRef<ROSLIB.Ros | null>(null);
  const cmdVelRef = useRef<ROSLIB.Topic | null>(null);
  const kickRef = useRef<ROSLIB.Topic | null>(null);
  const leftJoystickRef = useRef<HTMLDivElement>(null);
  const rightJoystickRef = useRef<HTMLDivElement>(null);

  // Initialize ROS connection
  useEffect(() => {
    const ros = new ROSLIB.Ros({ url: connectionUri });

    ros.on("connection", () => {
      console.log("ROS Connected");
      setRosConnected(true);
      
      // Initialize cmd_vel topic
      cmdVelRef.current = new ROSLIB.Topic({
        ros: ros,
        name: "/cmd_vel",
        messageType: "geometry_msgs/Twist",
      });

      // Initialize kick topic
      kickRef.current = new ROSLIB.Topic({
        ros: ros,
        name: "/kick",
        messageType: "std_msgs/Bool",
      });
    });

    ros.on("error", (err) => {
      console.error("ROS Error:", err);
      setRosConnected(false);
    });

    ros.on("close", () => {
      console.log("ROS Disconnected");
      setRosConnected(false);
    });

    rosRef.current = ros;
    
    return () => {
      ros.close();
    };
  }, [connectionUri]);

  // Send twist message
  const sendTwist = useCallback((x: number, y: number, theta: number) => {
    if (!rosConnected || !cmdVelRef.current) return;

    const twist = new ROSLIB.Message({
      linear: {
        x: x,
        y: y,
        z: 0.0,
      },
      angular: {
        x: 0.0,
        y: 0.0,
        z: theta,
      },
    });

    cmdVelRef.current.publish(twist);
  }, [rosConnected]);

  const stopHandler = useCallback(() => {
    if (!rosConnected || !cmdVelRef.current) return;
    const stopTwist = new ROSLIB.Message({
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: -1, y: 0, z: 0 },
    });
    cmdVelRef.current.publish(stopTwist);
  }, [rosConnected]);

  // Send kick command
  const sendKick = useCallback(() => {
    if (!rosConnected || !kickRef.current) return;

    const kickMsg = new ROSLIB.Message({
      data: true,
    });

    kickRef.current.publish(kickMsg);
    console.log("Kick command sent!");
  }, [rosConnected]);

  // Fullscreen functionality
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error("Error attempting to exit fullscreen:", err);
      });
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Update control values and send commands
  useEffect(() => {
    // Apply deadzone to reduce jittery small movements
    const deadzone = 0.1;
    const applyDeadzone = (value: number) => {
      return Math.abs(value) < deadzone ? 0 : value;
    };

    const processedLeftX = applyDeadzone(leftJoystick.x);
    const processedLeftY = applyDeadzone(leftJoystick.y);
    const processedRightX = applyDeadzone(rightJoystick.x);

    const newControlValues = {
      x: Math.max(-valueCaps.x, Math.min(valueCaps.x, -processedLeftY * valueCaps.x)),        // Forward/backward (forward is positive x) with cap
      y: Math.max(-valueCaps.y, Math.min(valueCaps.y, processedLeftX * -valueCaps.y)),       // Left/right strafe (right is negative y) with cap
      theta: Math.max(-valueCaps.theta, Math.min(valueCaps.theta, processedRightX * -valueCaps.theta))   // Rotation (clockwise is negative) with cap
    };

    setControlValues(newControlValues);
    sendTwist(newControlValues.x, newControlValues.y, newControlValues.theta);
  }, [leftJoystick, rightJoystick, sendTwist, valueCaps]);

  // Get relative position within joystick area
  const getRelativePosition = (element: HTMLElement, clientX: number, clientY: number): TouchPosition => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = Math.min(rect.width, rect.height) / 2 - 15; // Account for knob size and border

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Normalize to -1 to 1 range with smooth constraint
    if (distance === 0) {
      return { x: 0, y: 0 };
    }

    if (distance <= maxRadius) {
      return {
        x: Math.max(-1, Math.min(1, deltaX / maxRadius)),
        y: Math.max(-1, Math.min(1, deltaY / maxRadius))
      };
    } else {
      // Clamp to circle boundary
      const normalizedX = deltaX / distance;
      const normalizedY = deltaY / distance;
      return {
        x: normalizedX,
        y: normalizedY
      };
    }
  };

  // Left joystick handlers (Movement)
  const handleLeftJoystickStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // For touch events, only handle the first touch to prevent multiple touch conflicts
    if ('touches' in e && e.touches.length > 1) return;
    
    setIsDraggingLeft(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (leftJoystickRef.current) {
      const pos = getRelativePosition(leftJoystickRef.current, clientX, clientY);
      setLeftJoystick(pos);
    }
  };

  const handleLeftJoystickMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDraggingLeft || !leftJoystickRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // For touch events, only handle the first touch
    if ('touches' in e && e.touches.length > 1) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    
    const pos = getRelativePosition(leftJoystickRef.current, clientX, clientY);
    setLeftJoystick(pos);
  }, [isDraggingLeft]);

  const handleLeftJoystickEnd = useCallback(() => {
    setIsDraggingLeft(false);
    setLeftJoystick({ x: 0, y: 0 });
  }, []);

  // Right joystick handlers (Rotation)
  const handleRightJoystickStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // For touch events, only handle the first touch to prevent multiple touch conflicts
    if ('touches' in e && e.touches.length > 1) return;
    
    setIsDraggingRight(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (rightJoystickRef.current) {
      const pos = getRelativePosition(rightJoystickRef.current, clientX, clientY);
      setRightJoystick(pos);
    }
  };

  const handleRightJoystickMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDraggingRight || !rightJoystickRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // For touch events, only handle the first touch
    if ('touches' in e && e.touches.length > 1) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    
    const pos = getRelativePosition(rightJoystickRef.current, clientX, clientY);
    setRightJoystick(pos);
  }, [isDraggingRight]);

  const handleRightJoystickEnd = useCallback(() => {
    setIsDraggingRight(false);
    setRightJoystick({ x: 0, y: 0 });
  }, []);

  // Global event listeners for touch/mouse move and end
  useEffect(() => {
    if (isDraggingLeft) {
      document.addEventListener('touchmove', handleLeftJoystickMove, { passive: false });
      document.addEventListener('mousemove', handleLeftJoystickMove);
      document.addEventListener('touchend', handleLeftJoystickEnd);
      document.addEventListener('mouseup', handleLeftJoystickEnd);
    }

    return () => {
      document.removeEventListener('touchmove', handleLeftJoystickMove);
      document.removeEventListener('mousemove', handleLeftJoystickMove);
      document.removeEventListener('touchend', handleLeftJoystickEnd);
      document.removeEventListener('mouseup', handleLeftJoystickEnd);
    };
  }, [isDraggingLeft, handleLeftJoystickMove]);

  useEffect(() => {
    if (isDraggingRight) {
      document.addEventListener('touchmove', handleRightJoystickMove, { passive: false });
      document.addEventListener('mousemove', handleRightJoystickMove);
      document.addEventListener('touchend', handleRightJoystickEnd);
      document.addEventListener('mouseup', handleRightJoystickEnd);
    }

    return () => {
      document.removeEventListener('touchmove', handleRightJoystickMove);
      document.removeEventListener('mousemove', handleRightJoystickMove);
      document.removeEventListener('touchend', handleRightJoystickEnd);
      document.removeEventListener('mouseup', handleRightJoystickEnd);
    };
  }, [isDraggingRight, handleRightJoystickMove]);

  // Prevent body scrolling when gamepad is active
  useEffect(() => {
    document.body.classList.add('gamepad-active');
    return () => {
      document.body.classList.remove('gamepad-active');
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-900 overflow-hidden touch-none select-none">
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* ROS Connection */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-2">ROS Connection</h4>
              <input
                type="text"
                value={connectionUri}
                onChange={(e) => setConnectionUri(e.target.value)}
                className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ws://localhost:9090"
              />
            </div>

            {/* Value Caps */}
            <div className="mb-4">
              <h4 className="text-md font-medium text-gray-800 mb-3">Control Limits</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    X Max (Forward/Back): {valueCaps.x}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={valueCaps.x}
                    onChange={(e) => setValueCaps(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Y Max (Left/Right): {valueCaps.y}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={valueCaps.y}
                    onChange={(e) => setValueCaps(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Theta Max (Rotation): {valueCaps.theta}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={valueCaps.theta}
                    onChange={(e) => setValueCaps(prev => ({ ...prev, theta: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-40 p-4">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <button
            onClick={() => (window.location.href = "/")}
            className="bg-gray-800 bg-opacity-90 text-white p-3 rounded-full hover:bg-opacity-100 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Connection Status */}
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            rosConnected 
              ? "bg-green-600 text-white" 
              : "bg-red-600 text-white"
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                rosConnected ? "bg-green-300" : "bg-red-300"
              }`}></div>
              {rosConnected ? "Connected" : "Disconnected"}
            </div>
          </div>

          {/* Right Side Buttons */}
          <div className="flex items-center gap-2">
            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="bg-gray-800 bg-opacity-90 text-white p-3 rounded-full hover:bg-opacity-100 transition-all"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15v4.5M15 15h4.5M15 15l5.5 5.5" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="bg-gray-800 bg-opacity-90 text-white p-3 rounded-full hover:bg-opacity-100 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      
    {/* Control Values Display */}
    <div className="absolute top-4 right-32 z-40">
        <div className="bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg">
            <div className="flex gap-3 text-xs">
                <span>X: {controlValues.x.toFixed(2)}</span>
                <span>Y: {controlValues.y.toFixed(2)}</span>
                <span>θ: {controlValues.theta.toFixed(2)}</span>
            </div>
        </div>
    </div>

      {/* PlayStation-style Layout */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full max-w-5xl">
          
          {/* Left Joystick - Bigger size */}
          <div className="absolute bottom-16 sm:bottom-20 md:bottom-24 left-8 sm:left-12 md:left-24 landscape:bottom-12 landscape:left-8">
            <div className="flex flex-col items-center">
              <div
                ref={leftJoystickRef}
                className="joystick-area relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 landscape:w-32 landscape:h-32 bg-gray-800 bg-opacity-90 rounded-full border-4 border-gray-600 shadow-2xl"
                onTouchStart={handleLeftJoystickStart}
                onMouseDown={handleLeftJoystickStart}
                style={{ touchAction: 'none' }}
              >
                {/* Joystick Knob */}
                <div
                  className={`absolute w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 landscape:w-10 landscape:h-10 bg-blue-500 rounded-full border-2 border-white shadow-lg ${isDraggingLeft ? 'joystick-knob-active' : ''} transition-all duration-100 ease-out`}
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${leftJoystick.x * 55}px, ${leftJoystick.y * 55}px)`,
                  }}
                />
                
                {/* Center Dot */}
                <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-gray-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
              </div>
              <div className="mt-2 sm:mt-3 text-white text-sm text-center font-medium">
                MOVE
              </div>
            </div>
          </div>

          {/* Right Joystick - Bigger size */}
          <div className="absolute bottom-16 sm:bottom-20 md:bottom-24 right-8 sm:right-12 md:right-24 landscape:bottom-12 landscape:right-8">
            <div className="flex flex-col items-center">
              <div
                ref={rightJoystickRef}
                className="joystick-area relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 landscape:w-32 landscape:h-32 bg-gray-800 bg-opacity-90 rounded-full border-4 border-gray-600 shadow-2xl"
                onTouchStart={handleRightJoystickStart}
                onMouseDown={handleRightJoystickStart}
                style={{ touchAction: 'none' }}
              >
                {/* Joystick Knob */}
                <div
                  className={`absolute w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 landscape:w-10 landscape:h-10 bg-purple-500 rounded-full border-2 border-white shadow-lg ${isDraggingRight ? 'joystick-knob-active' : ''} transition-all duration-100 ease-out`}
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${rightJoystick.x * 55}px, ${rightJoystick.y * 55}px)`,
                  }}
                />
                
                {/* Center Dot */}
                <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-gray-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
              </div>
              <div className="mt-2 sm:mt-3 text-white text-sm text-center font-medium">
                ROTATE
              </div>
            </div>
          </div>

          {/* Action Buttons - Centered at Bottom */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 landscape:bottom-4">
            <div className="flex space-x-4">
              {/* KICK Button */}
              <button
                onClick={sendKick}
                disabled={!rosConnected}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full font-bold text-white shadow-lg border border-white transition-all duration-200 hover:scale-105"
              >
                <div className="flex flex-col items-center">
                  <div className="text-sm sm:text-base">⚽</div>
                  <div className="text-xxs">K</div>
                </div>
              </button>
              
              {/* STOP Button */}
              <button
                onClick={() => stopHandler()}
                disabled={!rosConnected}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full font-bold text-white shadow-lg border border-white transition-all duration-200 hover:scale-105"
              >
                <div className="flex flex-col items-center">
                  <div className="text-sm sm:text-base">⏹</div>
                  <div className="text-xxs">S</div>
                </div>
              </button>

              {/* WALK IN SPOT Button */}
              <button
                onClick={() => sendTwist(0, 0, 0)}
                disabled={!rosConnected}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full font-bold text-white shadow-lg border border-white transition-all duration-200 hover:scale-105"
              >
                <div className="flex flex-col items-center">
                  <div className="text-sm sm:text-base">🚶</div>
                  <div className="text-xxs">W</div>
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}