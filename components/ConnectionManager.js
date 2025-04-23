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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
        <h2 className="text-xl font-semibold mb-4">Connection Settings</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="connectionUri"
            >
              WebSocket URI
            </label>
            <input
              id="connectionUri"
              type="text"
              value={connectionUri}
              onChange={(e) => setConnectionUri(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="ws://localhost:9090"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: ws://localhost:9090
            </p>
          </div>

          <div className="mb-6">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="robotNamespace"
            >
              Robot Namespace
            </label>
            <input
              id="robotNamespace"
              type="text"
              value={robotNamespace}
              onChange={(e) => setRobotNamespace(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="/quintic_walk"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Example: /quintic_walk</p>
          </div>

          <div className="flex justify-between mb-4">
            <button
              type="button"
              onClick={saveConnection}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Save Connection
            </button>

            <div>
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition-colors mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </form>

        {savedConnections.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Saved Connections</h3>
            <div className="bg-gray-50 max-h-48 overflow-y-auto rounded border border-gray-200">
              {savedConnections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex justify-between items-center p-2 hover:bg-gray-100 border-b border-gray-200"
                >
                  <div>
                    <div className="font-medium">{connection.name}</div>
                    <div className="text-xs text-gray-500">
                      {connection.uri}
                    </div>
                    <div className="text-xs text-gray-500">
                      {connection.namespace}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => loadConnection(connection)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteConnection(connection.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
