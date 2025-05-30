import React, { useState, useEffect } from "react";
import ROSLIB from "roslib";

export default function History({
  rosRef,
  connectionStatus,
  robotNamespace,
  onRestore,
  onRefresh,
  mockMode = false, // Add mockMode prop
}) {
  const [historyFiles, setHistoryFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewParams, setPreviewParams] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareFile, setCompareFile] = useState(null);
  const [compareParams, setCompareParams] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedFileToDelete, setSelectedFileToDelete] = useState(null);

  // Mock history files and data
  const mockHistoryFiles = [
    {
      filename: "config_2024_01_15_14_30.yaml",
      path: "/mock/history/config_2024_01_15_14_30.yaml",
      modified: "2024-01-15 14:30:25",
    },
    {
      filename: "config_2024_01_15_10_15.yaml",
      path: "/mock/history/config_2024_01_15_10_15.yaml",
      modified: "2024-01-15 10:15:12",
    },
    {
      filename: "config_2024_01_14_16_45.yaml",
      path: "/mock/history/config_2024_01_14_16_45.yaml",
      modified: "2024-01-14 16:45:08",
    },
  ];

  const mockParameterData = {
    "/mock/history/config_2024_01_15_14_30.yaml": {
      quintic_walk: {
        engine: {
          freq: 1.9,
          foot_distance: 0.19,
          trunk_height: 0.21,
        },
        node: {
          debug_active: false,
          engine_freq: 130.0,
        },
      },
    },
    "/mock/history/config_2024_01_15_10_15.yaml": {
      quintic_walk: {
        engine: {
          freq: 1.75,
          foot_distance: 0.17,
          trunk_height: 0.19,
        },
        node: {
          debug_active: true,
          engine_freq: 120.0,
        },
      },
    },
    "/mock/history/config_2024_01_14_16_45.yaml": {
      quintic_walk: {
        engine: {
          freq: 1.85,
          foot_distance: 0.18,
          trunk_height: 0.2,
        },
        node: {
          debug_active: true,
          engine_freq: 125.0,
        },
      },
    },
  };

  // Mock functions
  const mockFetchHistoryFiles = () => {
    setLoading(true);
    setTimeout(() => {
      setHistoryFiles(mockHistoryFiles);
      setLoading(false);
    }, 500);
  };

  const mockPreviewFile = (file) => {
    setLoading(true);
    setSelectedFile(file);
    setTimeout(() => {
      setPreviewParams(mockParameterData[file.path] || {});
      setLoading(false);
    }, 300);
  };

  const mockSelectForComparison = (file) => {
    setLoading(true);
    setCompareFile(file);
    setTimeout(() => {
      setCompareParams(mockParameterData[file.path] || {});
      setLoading(false);
    }, 300);
  };

  const mockLoadParameterFile = (filePath) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onRestore();
      onRefresh();
    }, 800);
  };

  const mockDeleteFile = (file) => {
    setLoading(true);
    setTimeout(() => {
      setHistoryFiles((prev) => prev.filter((f) => f.path !== file.path));
      if (selectedFile?.path === file.path) {
        setSelectedFile(null);
        setPreviewParams(null);
      }
      if (compareFile?.path === file.path) {
        setCompareFile(null);
        setCompareParams(null);
      }
      setLoading(false);
    }, 500);
  };

  // Fetch history files on component mount and when connection status changes
  useEffect(() => {
    if (mockMode) {
      mockFetchHistoryFiles();
    } else if (connectionStatus === "connected") {
      fetchHistoryFiles();
    }
  }, [connectionStatus, robotNamespace, mockMode]);

  const fetchHistoryFiles = async () => {
    if (mockMode) {
      mockFetchHistoryFiles();
      return;
    }

    if (!rosRef.current || connectionStatus !== "connected") {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);

    const historyService = new ROSLIB.Service({
      ros: rosRef.current,
      name: "/param_manager/get_all_history_file",
      serviceType: "std_srvs/srv/Trigger",
    });

    const request = new ROSLIB.ServiceRequest({});

    historyService.callService(
      request,
      (response) => {
        setLoading(false);

        if (response.success) {
          try {
            const files = JSON.parse(response.message);
            setHistoryFiles(files);
          } catch (e) {
            setError(`Error parsing history files: ${e.message}`);
          }
        } else {
          setError(`Failed to fetch history files: ${response.message}`);
        }
      },
      (error) => {
        setLoading(false);
        setError(`Service call failed: ${error}`);
      }
    );
  };

  const loadParameterFile = (filePath) => {
    if (mockMode) {
      mockLoadParameterFile(filePath);
      return;
    }

    if (!rosRef.current || connectionStatus !== "connected") {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);

    // First publish the file path
    const fileTopic = new ROSLIB.Topic({
      ros: rosRef.current,
      name: "/param_manager/file_path",
      messageType: "std_msgs/msg/String",
    });

    fileTopic.publish(new ROSLIB.Message({ data: filePath }));

    // Then call the service
    setTimeout(() => {
      const loadService = new ROSLIB.Service({
        ros: rosRef.current,
        name: "/param_manager/load_parameters_from_file",
        serviceType: "std_srvs/srv/Trigger",
      });

      const request = new ROSLIB.ServiceRequest({});

      loadService.callService(
        request,
        (response) => {
          setLoading(false);

          if (response.success) {
            onRestore();
            onRefresh();
          } else {
            setError(`Failed to load parameters: ${response.message}`);
          }
        },
        (error) => {
          setLoading(false);
          setError(`Service call failed: ${error}`);
        }
      );
    }, 500); // Give time for the topic to be received
  };

  const previewFile = (file) => {
    if (mockMode) {
      mockPreviewFile(file);
      return;
    }

    if (!rosRef.current || connectionStatus !== "connected") {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedFile(file);

    // First publish the file path
    const fileTopic = new ROSLIB.Topic({
      ros: rosRef.current,
      name: "/param_manager/file_path_preview",
      messageType: "std_msgs/msg/String",
    });

    fileTopic.publish(new ROSLIB.Message({ data: file.path }));

    // Then call the service
    setTimeout(() => {
      const previewService = new ROSLIB.Service({
        ros: rosRef.current,
        name: "/param_manager/get_parameters_from_file",
        serviceType: "std_srvs/srv/Trigger",
      });

      const request = new ROSLIB.ServiceRequest({});

      previewService.callService(
        request,
        (response) => {
          setLoading(false);

          if (response.success) {
            try {
              const params = JSON.parse(response.message);
              setPreviewParams(params);
            } catch (e) {
              setError(`Error parsing parameters: ${e.message}`);
            }
          } else {
            setError(`Failed to preview parameters: ${response.message}`);
          }
        },
        (error) => {
          setLoading(false);
          setError(`Service call failed: ${error}`);
        }
      );
    }, 500);
  };

  const deleteFile = (file) => {
    if (mockMode) {
      mockDeleteFile(file);
      return;
    }

    if (!rosRef.current || connectionStatus !== "connected") {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);

    const deleteTopic = new ROSLIB.Topic({
      ros: rosRef.current,
      name: "/param_manager/file_path_delete",
      messageType: "std_msgs/msg/String",
    });

    deleteTopic.publish(new ROSLIB.Message({ data: file.path }));

    // Refresh the file list
    setTimeout(() => {
      const deleteService = new ROSLIB.Service({
        ros: rosRef.current,
        name: "/param_manager/delete_parameter_file",
        serviceType: "std_srvs/srv/Trigger",
      });

      const request = new ROSLIB.ServiceRequest({});

      deleteService.callService(
        request,
        (response) => {
          setLoading(false);

          if (response.success) {
            fetchHistoryFiles();
            if (selectedFile?.path === file.path) {
              setSelectedFile(null);
              setPreviewParams(null);
            }
            if (compareFile?.path === file.path) {
              setCompareFile(null);
              setCompareParams(null);
            }
          } else {
            setError(`Failed to delete file: ${response.message}`);
          }
        },
        (error) => {
          setLoading(false);
          setError(`Service call failed: ${error}`);
        }
      );
    }, 500);
  };

  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    if (!compareMode) {
      setCompareFile(null);
      setCompareParams(null);
    }
  };

  const selectForComparison = (file) => {
    if (mockMode) {
      mockSelectForComparison(file);
      return;
    }

    if (!rosRef.current || connectionStatus !== "connected") {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);
    setCompareFile(file);

    // First publish the file path
    const fileTopic = new ROSLIB.Topic({
      ros: rosRef.current,
      name: "/param_manager/file_path_preview",
      messageType: "std_msgs/msg/String",
    });

    fileTopic.publish(new ROSLIB.Message({ data: file.path }));

    // Then call the service
    setTimeout(() => {
      const compareService = new ROSLIB.Service({
        ros: rosRef.current,
        name: "/param_manager/get_parameters_from_file",
        serviceType: "std_srvs/srv/Trigger",
      });

      const request = new ROSLIB.ServiceRequest({});

      compareService.callService(
        request,
        (response) => {
          setLoading(false);

          if (response.success) {
            try {
              const params = JSON.parse(response.message);
              setCompareParams(params);
            } catch (e) {
              setError(`Error parsing parameters: ${e.message}`);
            }
          } else {
            setError(
              `Failed to load comparison parameters: ${response.message}`
            );
          }
        },
        (error) => {
          setLoading(false);
          setError(`Service call failed: ${error}`);
        }
      );
    }, 500);
  };

  // Recursive function to compare nested parameters
  const compareNestedParams = (params1, params2, prefix = "") => {
    const allKeys = new Set([
      ...Object.keys(params1 || {}),
      ...Object.keys(params2 || {}),
    ]);

    let result = [];

    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const val1 = params1?.[key];
      const val2 = params2?.[key];

      // If both are objects, go deeper
      if (
        typeof val1 === "object" &&
        typeof val2 === "object" &&
        val1 !== null &&
        val2 !== null &&
        !Array.isArray(val1) &&
        !Array.isArray(val2)
      ) {
        result = [...result, ...compareNestedParams(val1, val2, fullKey)];
      } else {
        // Convert to string for comparison
        const strVal1 = JSON.stringify(val1);
        const strVal2 = JSON.stringify(val2);

        result.push({
          key: fullKey,
          value1: val1,
          value2: val2,
          isDifferent: strVal1 !== strVal2,
        });
      }
    }

    return result;
  };

  const confirmDelete = (file) => {
    deleteFile(file);
  };

  const renderFileList = () => {
    return (
      <div className="glass-table overflow-hidden rounded-xl">
        <table className="w-full">
          <thead>
            <tr className="glass-table-header">
              <th className="px-6 py-4 text-left text-xs font-semibold text-contrast-high uppercase tracking-wider">
                Filename
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-contrast-high uppercase tracking-wider">
                Modified
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-contrast-high uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {historyFiles.map((file, index) => (
              <tr
                key={index}
                className={`glass-table-row ${
                  selectedFile?.path === file.path
                    ? "!bg-blue-900/40 border-l-4 border-blue-400"
                    : ""
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-contrast-medium">
                  {file.filename}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-contrast-low">
                  {file.modified}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => previewFile(file)}
                    className="glass-button bg-blue-900/60 hover:bg-blue-800/70 text-blue-100 px-4 py-2 rounded-lg transition-all duration-200 border border-blue-500/50 hover:border-blue-400/70"
                  >
                    Preview
                  </button>
                  {compareMode &&
                    selectedFile &&
                    selectedFile.path !== file.path && (
                      <button
                        onClick={() => selectForComparison(file)}
                        className="glass-button bg-purple-900/60 hover:bg-purple-800/70 text-purple-100 px-4 py-2 rounded-lg transition-all duration-200 border border-purple-500/50 hover:border-purple-400/70"
                      >
                        Compare
                      </button>
                    )}
                  <button
                    onClick={() => loadParameterFile(file.path)}
                    className="glass-button bg-emerald-900/60 hover:bg-emerald-800/70 text-emerald-100 px-4 py-2 rounded-lg transition-all duration-200 border border-emerald-500/50 hover:border-emerald-400/70"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFileToDelete(file);
                      setDeleteModal(true);
                    }}
                    className="glass-button bg-red-900/60 hover:bg-red-800/70 text-red-100 px-4 py-2 rounded-lg transition-all duration-200 border border-red-500/50 hover:border-red-400/70"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderParameterComparison = () => {
    if (!previewParams || !compareParams) return null;

    // Recursively compare parameters
    const compareResults = compareNestedParams(previewParams, compareParams);

    // Group by top-level parameter
    const groupedResults = {};
    compareResults.forEach((result) => {
      const topLevel = result.key.split(".")[0];
      if (!groupedResults[topLevel]) {
        groupedResults[topLevel] = [];
      }
      groupedResults[topLevel].push(result);
    });

    return (
      <div className="mt-6 glass-card rounded-xl p-6">
        <h3 className="text-xl font-semibold mb-4 text-contrast-high">
          Parameter Comparison
        </h3>

        <div className="grid grid-cols-3 gap-4 mb-4 font-semibold glass-table-header p-4 rounded-lg">
          <div className="text-contrast-medium">Parameter</div>
          <div className="text-blue-300">
            {selectedFile?.filename} (Selected)
          </div>
          <div className="text-purple-300">
            {compareFile?.filename} (Compare)
          </div>
        </div>

        <div className="overflow-auto max-h-[400px] custom-scrollbar">
          {Object.entries(groupedResults).map(([topLevel, params]) => (
            <div key={topLevel} className="mb-4">
              <h4 className="font-bold text-contrast-medium mb-2 glass-table-header p-3 rounded-lg">
                {topLevel}
              </h4>

              {params.map((param, index) => {
                const isDifferent = param.isDifferent;
                const path = param.key.split(".");
                const displayKey =
                  path.length > 1 ? path.slice(1).join(".") : param.key;

                return (
                  <div
                    key={index}
                    className={`grid grid-cols-3 gap-4 py-3 px-3 rounded-lg mb-2 transition-all duration-200 ${
                      isDifferent
                        ? "bg-amber-900/30 border border-amber-500/40"
                        : "glass-table-row"
                    }`}
                  >
                    <div className="font-mono text-sm break-all text-contrast-medium">
                      {displayKey}
                    </div>
                    <div
                      className={`break-all ${
                        isDifferent ? "text-blue-200" : "text-contrast-low"
                      }`}
                    >
                      {param.value1 === undefined ? (
                        <span className="text-muted">undefined</span>
                      ) : typeof param.value1 === "object" ? (
                        <pre className="text-xs whitespace-pre-wrap bg-slate-900/40 p-3 rounded border border-slate-600/30">
                          {JSON.stringify(param.value1, null, 2)}
                        </pre>
                      ) : (
                        <span className="font-mono text-sm bg-slate-800/50 px-3 py-1 rounded border border-slate-600/40">
                          {String(param.value1)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`break-all ${
                        isDifferent ? "text-purple-200" : "text-contrast-low"
                      }`}
                    >
                      {param.value2 === undefined ? (
                        <span className="text-muted">undefined</span>
                      ) : typeof param.value2 === "object" ? (
                        <pre className="text-xs whitespace-pre-wrap bg-slate-900/40 p-3 rounded border border-slate-600/30">
                          {JSON.stringify(param.value2, null, 2)}
                        </pre>
                      ) : (
                        <span className="font-mono text-sm bg-slate-800/50 px-3 py-1 rounded border border-slate-600/40">
                          {String(param.value2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderParameterValue = (value, level = 0) => {
    if (value === null || value === undefined) {
      return <span className="text-muted">null</span>;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      return (
        <div className="pl-4 border-l border-slate-600/40">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="py-1">
              <span className="font-medium text-contrast-medium">{k}: </span>
              {renderParameterValue(v, level + 1)}
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div className="font-mono text-sm bg-slate-800/50 p-3 rounded border border-slate-600/40 text-contrast-medium">
          [
          {value.map((item, i) => (
            <span key={i} className="ml-2">
              {typeof item === "object"
                ? JSON.stringify(item)
                : item.toString()}
              {i < value.length - 1 ? ", " : ""}
            </span>
          ))}
          ]
        </div>
      );
    }

    return (
      <span className="font-mono text-sm bg-slate-800/50 px-3 py-1 rounded border border-slate-600/40 text-contrast-medium">
        {value.toString()}
      </span>
    );
  };

  const renderParameterPreview = () => {
    if (!previewParams) return null;

    return (
      <div className="mt-6 glass-card rounded-xl p-6">
        <h3 className="text-xl font-semibold mb-4 text-contrast-high">
          Parameter Preview
        </h3>
        <div className="overflow-auto max-h-[400px] custom-scrollbar">
          {Object.entries(previewParams).map(([key, value]) => (
            <div
              key={key}
              className="py-3 border-b border-slate-700/30 last:border-b-0"
            >
              <div className="font-medium text-contrast-medium mb-2">{key}</div>
              <div className="ml-4">{renderParameterValue(value)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-8 glass-card rounded-2xl p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-contrast-high">
          Parameter History
        </h2>
        <div className="flex space-x-3">
          <button
            onClick={toggleCompareMode}
            className={`glass-button px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
              compareMode
                ? "bg-purple-800/60 border-purple-400/60 text-purple-100 hover:bg-purple-700/70"
                : "bg-blue-800/60 border-blue-400/60 text-blue-100 hover:bg-blue-700/70"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {compareMode ? "Exit Compare Mode" : "Compare Mode"}
            </div>
          </button>
          <button
            onClick={fetchHistoryFiles}
            className="glass-button bg-slate-700/60 border-slate-500/60 px-6 py-3 rounded-xl font-medium text-slate-100 hover:bg-slate-600/70 transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              Refresh
            </div>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/60 border border-red-500/60 text-red-100 px-6 py-4 rounded-xl mb-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 text-red-300"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-600/30 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
        </div>
      ) : historyFiles.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <div className="text-6xl mb-4">📂</div>
          <div className="text-xl mb-2 text-contrast-medium">
            No history files found
          </div>
          <div>Parameter configurations will appear here when saved</div>
        </div>
      ) : (
        <div>
          {renderFileList()}

          {compareMode && compareFile && compareParams
            ? renderParameterComparison()
            : selectedFile && previewParams && renderParameterPreview()}
        </div>
      )}

      {deleteModal && selectedFileToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-red-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-900/40 border border-red-500/50">
                    ⚠️
                  </div>
                  Confirm Delete
                </div>
              </h3>
              <button
                onClick={() => setDeleteModal(false)}
                className="text-muted hover:text-contrast-medium transition-colors p-1"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="mb-8">
              <p className="text-contrast-medium leading-relaxed">
                Are you sure you want to delete &quot;
                <span className="font-semibold text-contrast-high">
                  {selectedFileToDelete.filename}
                </span>
                &quot;? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="glass-button px-6 py-3 rounded-xl text-slate-100 font-medium bg-slate-700/60 border-slate-500/60 hover:bg-slate-600/70"
                onClick={() => setDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="glass-button px-6 py-3 rounded-xl text-red-100 font-medium bg-red-900/60 border-red-500/60 hover:bg-red-800/70"
                onClick={() => {
                  confirmDelete(selectedFileToDelete);
                  setDeleteModal(false);
                  setSelectedFileToDelete(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
