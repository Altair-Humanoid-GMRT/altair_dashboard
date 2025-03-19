import React, { useState, useMemo } from "react";

const HierarchicalParameters = ({
  parameters,
  editingParam,
  newValue,
  setNewValue,
  handleEdit,
  handleSave,
  connectionStatus,
}) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  // Group parameters by their hierarchy
  const groupedParameters = useMemo(() => {
    const groups = {};

    Object.entries(parameters).forEach(([paramName, paramData]) => {
      const parts = paramName.split(".");
      let currentLevel = groups;

      // Build the nested structure
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!currentLevel[part]) {
          currentLevel[part] = { _children: {} };
        }
        currentLevel = currentLevel[part]._children;
      }

      // Add the actual parameter
      const lastPart = parts[parts.length - 1];
      currentLevel[lastPart] = { data: paramData, fullName: paramName };
    });

    return groups;
  }, [parameters]);

  // Toggle section expansion
  const toggleSection = (path) => {
    setExpandedSections((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // Render a parameter group
  const renderGroup = (group, path = "", depth = 0) => {
    const entries = Object.entries(group);
    if (entries.length === 0) return null;

    return (
      <div
        className="pl-4"
        style={{ borderLeft: depth > 0 ? "1px solid #e5e7eb" : "none" }}
      >
        {entries.map(([key, value]) => {
          if (key === "_children") return null;

          const newPath = path ? `${path}.${key}` : key;
          const hasChildren =
            value._children && Object.keys(value._children).length > 0;
          const isExpanded = expandedSections[newPath];

          if (hasChildren) {
            return (
              <div key={newPath} className="mb-2">
                <div
                  className="flex items-center py-2 cursor-pointer group hover:bg-gray-50 rounded"
                  onClick={() => toggleSection(newPath)}
                >
                  <div className="w-5 h-5 mr-2 flex items-center justify-center text-gray-500">
                    {isExpanded ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-gray-700">{key}</span>
                  <span className="ml-2 text-xs text-gray-500 opacity-0 group-hover:opacity-100">
                    {Object.keys(value._children).length} parameter
                    {Object.keys(value._children).length !== 1 ? "s" : ""}
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-1">
                    {renderGroup(value._children, newPath, depth + 1)}
                  </div>
                )}
              </div>
            );
          } else if (value.data) {
            // Render actual parameter
            return (
              <div
                key={newPath}
                className="mb-3 pl-7 pr-3 py-2 hover:bg-blue-50 rounded"
              >
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700">{key}</span>
                      <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        {value.data.type === 1
                          ? "bool"
                          : value.data.type === 2
                          ? "int"
                          : value.data.type === 3
                          ? "double"
                          : value.data.type === 4
                          ? "string"
                          : value.data.type === 9
                          ? "string[]"
                          : "unknown"}
                      </span>
                    </div>
                    <div>
                      {editingParam === value.fullName ? (
                        <button
                          onClick={() => handleSave()}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                          disabled={connectionStatus !== "connected"}
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleEdit(value.fullName, value.data.value)
                          }
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                          disabled={connectionStatus !== "connected"}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2">
                    {editingParam === value.fullName ? (
                      <input
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="font-mono bg-gray-50 p-2 rounded border border-gray-200 text-gray-700">
                        {value.data.value?.toString() || "undefined"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="mb-8 bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-700">Parameters</h2>
        <div className="flex space-x-2">
          <button
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center"
            onClick={() => setExpandedSections({})}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
            Collapse All
          </button>
          <button
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center"
            onClick={() => {
              const allPaths = {};
              const collectPaths = (obj, path = "") => {
                Object.entries(obj).forEach(([key, value]) => {
                  if (key === "_children") return;
                  const newPath = path ? `${path}.${key}` : key;
                  if (
                    value._children &&
                    Object.keys(value._children).length > 0
                  ) {
                    allPaths[newPath] = true;
                    collectPaths(value._children, newPath);
                  }
                });
              };
              collectPaths(groupedParameters);
              setExpandedSections(allPaths);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            Expand All
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-4"></div>
      {/* Search input */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search parameters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 pl-8 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute left-2 top-2 text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {searchTerm ? (
          <div>
            {Object.entries(parameters)
              .filter(([paramName]) =>
                paramName.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map(([paramName, paramData]) => (
                <div
                  key={paramName}
                  className="mb-3 pl-7 pr-3 py-2 hover:bg-blue-50 rounded"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-700">
                          {paramName}
                        </span>
                        <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                          {paramData.type === 1
                            ? "bool"
                            : paramData.type === 2
                            ? "int"
                            : paramData.type === 3
                            ? "double"
                            : paramData.type === 4
                            ? "string"
                            : paramData.type === 9
                            ? "string[]"
                            : "unknown"}
                        </span>
                      </div>
                      <div>
                        {editingParam === paramName ? (
                          <button
                            onClick={() => handleSave()}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                            disabled={connectionStatus !== "connected"}
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleEdit(paramName, paramData.value)
                            }
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                            disabled={connectionStatus !== "connected"}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2">
                      {editingParam === paramName ? (
                        <input
                          type="text"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="font-mono bg-gray-50 p-2 rounded border border-gray-200 text-gray-700">
                          {paramData.value?.toString() || "undefined"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          renderGroup(groupedParameters)
        )}
      </div>
      <div className="overflow-x-auto">{renderGroup(groupedParameters)}</div>
    </div>
  );
};

export default HierarchicalParameters;
