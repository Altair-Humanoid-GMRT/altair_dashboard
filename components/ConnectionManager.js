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
    <div>
      <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              className="block text-gray-700 text-sm font-semibold mb-3"
              htmlFor="connectionUri"
            >
              WebSocket URI
            </label>
            <input
              id="connectionUri"
              type="text"
              value={connectionUri}
              onChange={(e) => setConnectionUri(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              placeholder="ws://localhost:9090"
              required
            />
            <p className="text-xs text-gray-600 mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
              💡 Example: ws://localhost:9090
            </p>
          </div>

          <div className="mb-8">
            <label
              className="block text-gray-700 text-sm font-semibold mb-3"
              htmlFor="robotNamespace"
            >
              Robot Namespace
            </label>
            <input
              id="robotNamespace"
              type="text"
              value={robotNamespace}
              onChange={(e) => setRobotNamespace(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              placeholder="altair01"
              required
            />
            <p className="text-xs text-gray-600 mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
              💡 Example: altair01
            </p>
          </div>

          <div className="flex justify-between mb-6">
            <button
              type="button"
              onClick={saveConnection}
              className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-medium text-white transition-all duration-300 border border-green-300"
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
                className="bg-gray-500 hover:bg-gray-600 px-6 py-3 rounded-lg font-medium text-white transition-all duration-300 border border-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium text-white transition-all duration-300 border border-blue-300"
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
            <h3 className="text-xl font-semibold mb-4 text-gray-900">
              Saved Connections
            </h3>
            <div className="bg-white border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {savedConnections.map((connection, index) => (
                <div
                  key={connection.id}
                  className={`flex justify-between items-center p-4 transition-all duration-200 hover:bg-gray-50 ${
                    index !== savedConnections.length - 1
                      ? "border-b border-gray-200"
                      : ""
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-700 mb-1">
                      {connection.name}
                    </div>
                    <div className="text-xs text-blue-700 font-mono bg-blue-50 px-2 py-1 rounded border border-blue-200 mb-1">
                      {connection.uri}
                    </div>
                    <div className="text-xs text-purple-700 font-mono bg-purple-50 px-2 py-1 rounded border border-purple-200">
                      {connection.namespace}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => loadConnection(connection)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-blue-300"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteConnection(connection.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {savedConnections.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🔗</div>
                <div>No saved connections yet</div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
