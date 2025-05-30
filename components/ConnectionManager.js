import React, { useState, useEffect } from "react";

export default function ConnectionManager({
  currentUri,
  currentNamespace,
  onApply,
  onCancel,
}) {
  const [connectionUri, setConnectionUri] = useState(currentUri);
  const [robotNamespace, setRobotNamespace] = useState(currentNamespace);
  const [savedConnections, setSavedConnections] = useState([]);

  // Load saved connections from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("saved_connections");
      if (saved) {
        setSavedConnections(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading saved connections:", error);
    }
  }, []);

  const saveConnection = () => {
    // Check if this connection already exists
    const existingIndex = savedConnections.findIndex(
      (conn) => conn.uri === connectionUri && conn.namespace === robotNamespace
    );

    if (existingIndex >= 0) {
      return; // Already saved this connection
    }

    const newConnection = {
      id: Date.now(),
      uri: connectionUri,
      namespace: robotNamespace,
      name: `Connection ${savedConnections.length + 1}`,
    };

    const updated = [...savedConnections, newConnection];
    setSavedConnections(updated);
    localStorage.setItem("saved_connections", JSON.stringify(updated));
  };

  const deleteConnection = (id) => {
    const updated = savedConnections.filter((conn) => conn.id !== id);
    setSavedConnections(updated);
    localStorage.setItem("saved_connections", JSON.stringify(updated));
  };

  const loadConnection = (connection) => {
    setConnectionUri(connection.uri);
    setRobotNamespace(connection.namespace);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply(connectionUri, robotNamespace);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-card rounded-2xl p-8 max-w-lg w-full mx-4 border border-white/20">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
          Connection Settings
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              className="block text-white/80 text-sm font-semibold mb-3"
              htmlFor="connectionUri"
            >
              WebSocket URI
            </label>
            <input
              id="connectionUri"
              type="text"
              value={connectionUri}
              onChange={(e) => setConnectionUri(e.target.value)}
              className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
              placeholder="ws://localhost:9090"
              required
            />
            <p className="text-xs text-white/60 mt-2 bg-white/5 rounded-lg p-2 border border-white/10">
              💡 Example: ws://localhost:9090
            </p>
          </div>

          <div className="mb-8">
            <label
              className="block text-white/80 text-sm font-semibold mb-3"
              htmlFor="robotNamespace"
            >
              Robot Namespace
            </label>
            <input
              id="robotNamespace"
              type="text"
              value={robotNamespace}
              onChange={(e) => setRobotNamespace(e.target.value)}
              className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-200"
              placeholder="/quintic_walk"
              required
            />
            <p className="text-xs text-white/60 mt-2 bg-white/5 rounded-lg p-2 border border-white/10">
              💡 Example: /quintic_walk
            </p>
          </div>

          <div className="flex justify-between mb-6">
            <button
              type="button"
              onClick={saveConnection}
              className="glass-button bg-gradient-to-r from-emerald-500/30 to-green-600/30 border-emerald-400/40 px-6 py-3 rounded-xl font-medium text-white transition-all duration-300 hover:from-emerald-400/40 hover:to-green-500/40 transform hover:scale-105"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293z" />
                </svg>
                Save Connection
              </div>
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="glass-button bg-gradient-to-r from-gray-500/30 to-gray-600/30 border-gray-400/40 px-6 py-3 rounded-xl font-medium text-white transition-all duration-300 hover:from-gray-400/40 hover:to-gray-500/40 transform hover:scale-105"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="glass-button bg-gradient-to-r from-blue-500/30 to-blue-600/30 border-blue-400/40 px-6 py-3 rounded-xl font-medium text-white transition-all duration-300 hover:from-blue-400/40 hover:to-blue-500/40 transform hover:scale-105"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Apply
                </div>
              </button>
            </div>
          </div>
        </form>

        {savedConnections.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
              Saved Connections
            </h3>
            <div className="glass-card rounded-xl max-h-48 overflow-y-auto border border-white/20 custom-scrollbar">
              {savedConnections.map((connection, index) => (
                <div
                  key={connection.id}
                  className={`flex justify-between items-center p-4 hover:bg-white/10 transition-all duration-200 ${
                    index !== savedConnections.length - 1
                      ? "border-b border-white/10"
                      : ""
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-white/90 mb-1">
                      {connection.name}
                    </div>
                    <div className="text-xs text-blue-300 font-mono bg-blue-500/10 px-2 py-1 rounded border border-blue-400/30 mb-1">
                      {connection.uri}
                    </div>
                    <div className="text-xs text-purple-300 font-mono bg-purple-500/10 px-2 py-1 rounded border border-purple-400/30">
                      {connection.namespace}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => loadConnection(connection)}
                      className="glass-button bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-blue-400/30"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteConnection(connection.id)}
                      className="glass-button bg-red-500/20 hover:bg-red-500/30 text-red-200 px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-red-400/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {savedConnections.length === 0 && (
              <div className="text-center py-8 text-white/60">
                <div className="text-4xl mb-2">🔗</div>
                <div>No saved connections yet</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
