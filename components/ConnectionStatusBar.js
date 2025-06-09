'use client';

import React, { useState } from 'react';
import { Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useRos } from '../contexts/RosContext';
import ConnectionManager from './ConnectionManager';

export default function ConnectionStatusBar({ showFullControls = false }) {
  const {
    isConnected,
    connectionUri,
    robotNamespace,
    connectionStatus,
    isConnecting,
    connect,
    disconnect,
    updateConnection,
    cancelConnection,
  } = useRos();

  const [showConnectionManager, setShowConnectionManager] = useState(false);

  const handleConnectionApply = (uri, namespace) => {
    updateConnection(uri, namespace);
    setShowConnectionManager(false);
  };

  if (showFullControls) {
    // Full connection control panel for dashboard
    return (
      <>
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <Settings className="w-6 h-6 mr-2" />
              ROS Bridge Connection
            </h2>
            <div className="flex items-center space-x-3">
              <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                isConnected 
                  ? 'bg-green-100 text-green-800' 
                  : isConnecting
                  ? 'bg-yellow-100 text-yellow-800'
                  : connectionStatus === 'Connection Error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {isConnected ? (
                  <Wifi className="w-4 h-4 mr-1" />
                ) : isConnecting ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <WifiOff className="w-4 h-4 mr-1" />
                )}
                {connectionStatus}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Connection URI
              </label>
              <div className="bg-gray-50 p-2 rounded border text-sm text-gray-800">
                {connectionUri}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Robot Namespace
              </label>
              <div className="bg-gray-50 p-2 rounded border text-sm text-gray-800">
                {robotNamespace || 'Not set'}
              </div>
            </div>
            <div className="flex items-end">
              <div className="flex space-x-2 w-full">
                <button
                  onClick={() => setShowConnectionManager(true)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition duration-200 flex items-center justify-center"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </button>
                {!isConnected && !isConnecting && (
                  <button
                    onClick={connect}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition duration-200 flex items-center justify-center"
                  >
                    <Wifi className="w-4 h-4 mr-2" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            {isConnected && (
              <button
                onClick={disconnect}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition duration-200 flex items-center"
              >
                <WifiOff className="w-4 h-4 mr-2" />
                Disconnect
              </button>
            )}
            
            {isConnecting && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-yellow-600">
                  Connecting to ROS bridge...
                </span>
                <button
                  onClick={cancelConnection}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition duration-200 flex items-center"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Connection Manager Modal */}
        {showConnectionManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  ROS Bridge Connection Settings
                </h2>
                <ConnectionManager
                  currentUri={connectionUri}
                  currentNamespace={robotNamespace}
                  onApply={handleConnectionApply}
                  onCancel={() => setShowConnectionManager(false)}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Compact connection status bar for other pages
  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              ROS Connection
            </h3>
            <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isConnected 
                ? 'bg-green-100 text-green-800' 
                : isConnecting
                ? 'bg-yellow-100 text-yellow-800'
                : connectionStatus === 'Connection Error'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {isConnected ? (
                <Wifi className="w-4 h-4 mr-1" />
              ) : isConnecting ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <WifiOff className="w-4 h-4 mr-1" />
              )}
              {connectionStatus}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowConnectionManager(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md transition duration-200 flex items-center text-sm"
            >
              <Settings className="w-4 h-4 mr-1" />
              Settings
            </button>
            
            {!isConnected && !isConnecting && (
              <button
                onClick={connect}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md transition duration-200 flex items-center text-sm"
              >
                <Wifi className="w-4 h-4 mr-1" />
                Connect
              </button>
            )}
            
            {isConnected && (
              <button
                onClick={disconnect}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md transition duration-200 flex items-center text-sm"
              >
                <WifiOff className="w-4 h-4 mr-1" />
                Disconnect
              </button>
            )}
            
            {isConnecting && (
              <button
                onClick={cancelConnection}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md transition duration-200 flex items-center text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Connection Manager Modal */}
      {showConnectionManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                ROS Bridge Connection Settings
              </h2>
              <ConnectionManager
                currentUri={connectionUri}
                currentNamespace={robotNamespace}
                onApply={handleConnectionApply}
                onCancel={() => setShowConnectionManager(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
