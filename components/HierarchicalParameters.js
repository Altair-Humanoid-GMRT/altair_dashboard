import React, { useState, useMemo, useRef, useEffect } from "react";

const HierarchicalParameters = ({
  parameters,
  descriptions,
  editingParam,
  newValue,
  setNewValue,
  handleEdit,
  handleSave,
  connectionStatus,
  selectedParams,
  onSelectionChange,
  onSelectAll,
}) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [localEditingParam, setLocalEditingParam] = useState(null);
  const [localNewValue, setLocalNewValue] = useState("");
  const inputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (localEditingParam && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [localEditingParam]);

  // Handle single-click to edit
  const handleSingleClick = (paramName, currentValue) => {
    if (connectionStatus !== "connected") return;
    setLocalEditingParam(paramName);
    setLocalNewValue(currentValue?.toString() || "");
  };

  // Handle key press in input
  const handleKeyPress = (e, paramName) => {
    if (e.key === "Enter") {
      handleSaveLocal(paramName);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Handle save
  const handleSaveLocal = (paramName) => {
    if (localNewValue !== "") {
      // Use the parent's update function
      handleEdit(paramName, parameters[paramName]?.value);
      setNewValue(localNewValue);
      setTimeout(() => {
        handleSave();
      }, 0);
    }
    setLocalEditingParam(null);
    setLocalNewValue("");
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setLocalEditingParam(null);
    setLocalNewValue("");
  };

  // Handle input blur (save on focus loss)
  const handleBlur = (paramName) => {
    handleSaveLocal(paramName);
  };

  // Calculate selection stats
  const selectionStats = useMemo(() => {
    const totalParams = Object.keys(parameters).length;
    const selectedCount = Object.values(selectedParams).filter(Boolean).length;
    return {
      total: totalParams,
      selected: selectedCount,
      allSelected: totalParams > 0 && selectedCount === totalParams,
      someSelected: selectedCount > 0 && selectedCount < totalParams,
      noneSelected: selectedCount === 0,
    };
  }, [parameters, selectedParams]);

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
        style={{
          borderLeft: depth > 0 ? "1px solid rgba(255, 255, 255, 0.2)" : "none",
        }}
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
                  className="flex items-center py-2 cursor-pointer group hover:bg-white/10 rounded-lg transition-all duration-200 backdrop-blur-sm px-3"
                  onClick={() => toggleSection(newPath)}
                >
                  <div className="w-5 h-5 mr-2 flex items-center justify-center text-white/60">
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
                  <span
                    className="font-medium text-white/90"
                    data-tooltip-id="param-tooltip"
                    data-tooltip-content={
                      descriptions[newPath]?.description ||
                      "No description available"
                    }
                  >
                    {key}
                  </span>
                  <span className="ml-2 text-xs text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">
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
            // Render actual parameter with single-click editing
            const isEditing = localEditingParam === value.fullName;
            return (
              <div
                key={newPath}
                className="mb-3 pl-7 pr-3 py-2 hover:bg-white/10 rounded-lg group transition-all duration-200"
              >
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedParams[value.fullName] || false}
                        onChange={(e) =>
                          onSelectionChange(value.fullName, e.target.checked)
                        }
                        className="mr-2 h-4 w-4 text-blue-400 focus:ring-blue-400 border-white/30 rounded bg-white/10 backdrop-blur-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span
                        className="font-medium text-white/90"
                        data-tooltip-id="param-tooltip"
                        data-tooltip-content={
                          descriptions[value.fullName]?.description ||
                          "No description available"
                        }
                      >
                        {key}
                      </span>
                      <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-200 rounded-full text-xs border border-purple-400/30">
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
                    {connectionStatus === "connected" && (
                      <div className="text-xs text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to edit
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={localNewValue}
                        onChange={(e) => setLocalNewValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, value.fullName)}
                        onBlur={() => handleBlur(value.fullName)}
                        className="w-full p-3 bg-white/20 backdrop-blur-sm border border-blue-400/50 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400"
                        placeholder="Press Enter to save, Escape to cancel"
                      />
                    ) : (
                      <div
                        className="font-mono bg-white/10 backdrop-blur-sm p-3 rounded-lg border border-white/20 text-white/80 cursor-pointer hover:bg-white/20 transition-all duration-200 group"
                        onClick={() =>
                          handleSingleClick(value.fullName, value.data.value)
                        }
                        title={
                          connectionStatus === "connected"
                            ? "Click to edit"
                            : "Connect to ROS to edit"
                        }
                      >
                        <div className="flex items-center justify-between">
                          <span>
                            {value.data.value?.toString() || "undefined"}
                          </span>
                          {connectionStatus === "connected" && (
                            <span className="text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity">
                              ✏️
                            </span>
                          )}
                        </div>
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

  const renderSearchResults = () => {
    return (
      <div>
        {Object.entries(parameters)
          .filter(([paramName]) =>
            paramName.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map(([paramName, paramData]) => {
            const isEditing = localEditingParam === paramName;
            return (
              <div
                key={paramName}
                className="mb-3 pl-7 pr-3 py-2 hover:bg-white/10 rounded-lg group transition-all duration-200"
              >
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedParams[paramName] || false}
                        onChange={(e) =>
                          onSelectionChange(paramName, e.target.checked)
                        }
                        className="mr-2 h-4 w-4 text-blue-400 focus:ring-blue-400 border-white/30 rounded bg-white/10 backdrop-blur-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span
                        className="font-medium text-white/90"
                        data-tooltip-id="param-tooltip"
                        data-tooltip-content={
                          descriptions[paramName]?.description ||
                          "No description available"
                        }
                      >
                        {paramName}
                      </span>
                      <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-200 rounded-full text-xs border border-purple-400/30">
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
                    {connectionStatus === "connected" && (
                      <div className="text-xs text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to edit
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={localNewValue}
                        onChange={(e) => setLocalNewValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, paramName)}
                        onBlur={() => handleBlur(paramName)}
                        className="w-full p-3 bg-white/20 backdrop-blur-sm border border-blue-400/50 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400"
                        placeholder="Press Enter to save, Escape to cancel"
                      />
                    ) : (
                      <div
                        className="font-mono bg-white/10 backdrop-blur-sm p-3 rounded-lg border border-white/20 text-white/80 cursor-pointer hover:bg-white/20 transition-all duration-200 group"
                        onClick={() =>
                          handleSingleClick(paramName, paramData.value)
                        }
                        title={
                          connectionStatus === "connected"
                            ? "Click to edit"
                            : "Connect to ROS to edit"
                        }
                      >
                        <div className="flex items-center justify-between">
                          <span>
                            {paramData.value?.toString() || "undefined"}
                          </span>
                          {connectionStatus === "connected" && (
                            <span className="text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity">
                              ✏️
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  return (
    <div className="mb-8 glass-card rounded-2xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-contrast-high">Parameters</h2>
        <div className="flex space-x-3">
          <div className="text-sm text-contrast-medium glass-card px-3 py-2 rounded-lg">
            {selectionStats.selected} of {selectionStats.total} parameters
            selected
          </div>
          <button
            className="glass-button bg-slate-700/60 border-slate-500/50 text-slate-100 px-4 py-2 rounded-lg text-sm flex items-center transition-all duration-200 hover:bg-slate-600/70"
            onClick={() => setExpandedSections({})}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
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
            className="glass-button bg-blue-900/60 border-blue-400/50 text-blue-100 px-4 py-2 rounded-lg text-sm flex items-center transition-all duration-200 hover:bg-blue-800/70"
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
              className="h-4 w-4 mr-2"
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

      <div className="border-b border-contrast-divider mb-6"></div>

      {/* Parameter selection controls */}
      <div className="mb-6 flex items-center space-x-4">
        <label className="flex items-center glass-card rounded-lg p-3 hover:bg-slate-800/40 transition-all duration-200 cursor-pointer">
          <input
            type="checkbox"
            className="h-5 w-5 text-blue-400 focus:ring-blue-400/50 border-slate-600 rounded bg-slate-700/50"
            checked={selectionStats.allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
          />
          <span className="ml-3 text-sm font-medium text-contrast-medium">
            {selectionStats.allSelected
              ? "Deselect All"
              : selectionStats.someSelected
              ? "Select All"
              : "Select All"}
          </span>
        </label>
      </div>

      {/* Search input */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search parameters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="glass-input w-full p-4 pl-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          />
          <div className="absolute left-4 top-4 text-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
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
        {searchTerm ? renderSearchResults() : renderGroup(groupedParameters)}
      </div>
    </div>
  );
};

export default HierarchicalParameters;
