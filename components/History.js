import React, { useState, useEffect } from "react";
import ROSLIB from "roslib";

export default function History({
  isConnected,
  getRos,
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
    } else if (isConnected) {
      fetchHistoryFiles();
    }
  }, [isConnected, mockMode]);

  const fetchHistoryFiles = () => {
    if (!isConnected || !getRos()) {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);

    setTimeout(() => {
      const historyService = new ROSLIB.Service({
        ros: getRos(),
        name: "/param_manager/get_history_files",
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
            } catch (error) {
              console.error("Error parsing history files:", error);
              setError("Error parsing history files");
            }
          } else {
            setError(response.message || "Failed to fetch history files");
          }
        },
        (error) => {
          setLoading(false);
          setError(`Service call failed: ${error}`);
        }
      );
    }, 300);
  };

  const previewFile = (file) => {
    if (mockMode) {
      mockPreviewFile(file);
      return;
    }

    if (!isConnected || !getRos()) {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedFile(file);

    // First publish the file path
    const fileTopic = new ROSLIB.Topic({
      ros: getRos(),
      name: "/param_manager/file_path_preview",
      messageType: "std_msgs/msg/String",
    });

    fileTopic.publish(new ROSLIB.Message({ data: file.path }));

    setTimeout(() => {
      const previewService = new ROSLIB.Service({
        ros: getRos(),
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
            } catch (error) {
              console.error("Error parsing parameters:", error);
              setError("Error parsing parameters");
            }
          } else {
            setError(response.message || "Failed to preview file");
          }
        },
        (error) => {
          setLoading(false);
          setError(`Service call failed: ${error}`);
        }
      );
    }, 500);
  };

  const loadParameterFile = (filePath) => {
    if (mockMode) {
      mockLoadParameterFile(filePath);
      return;
    }

    if (!isConnected || !getRos()) {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);

    setTimeout(() => {
      const fileTopic = new ROSLIB.Topic({
        ros: getRos(),
        name: "/param_manager/file_path",
        messageType: "std_msgs/msg/String",
      });

      fileTopic.publish(new ROSLIB.Message({ data: filePath }));

      const loadService = new ROSLIB.Service({
        ros: getRos(),
        name: "/param_manager/load_file_parameters",
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
            setError(response.message || "Failed to load parameters");
          }
        },
        (error) => {
          setLoading(false);
          setError(`Service call failed: ${error}`);
        }
      );
    }, 300);
  };

  const deleteFile = (file) => {
    if (mockMode) {
      mockDeleteFile(file);
      return;
    }

    if (!isConnected || !getRos()) {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);

    setTimeout(() => {
      const fileTopic = new ROSLIB.Topic({
        ros: getRos(),
        name: "/param_manager/file_path",
        messageType: "std_msgs/msg/String",
      });

      fileTopic.publish(new ROSLIB.Message({ data: file.path }));

      const deleteService = new ROSLIB.Service({
        ros: getRos(),
        name: "/param_manager/delete_file",
        serviceType: "std_srvs/srv/Trigger",
      });

      const request = new ROSLIB.ServiceRequest({});

      deleteService.callService(
        request,
        (response) => {
          setLoading(false);
          if (response.success) {
            // Remove from local state
            setHistoryFiles((prev) => prev.filter((f) => f.path !== file.path));
            if (selectedFile?.path === file.path) {
              setSelectedFile(null);
              setPreviewParams(null);
            }
            if (compareFile?.path === file.path) {
              setCompareFile(null);
              setCompareParams(null);
            }
          } else {
            setError(response.message || "Failed to delete file");
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

    if (!isConnected || !getRos()) {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);
    setCompareFile(file);

    // First publish the file path
    const fileTopic = new ROSLIB.Topic({
      ros: getRos(),
      name: "/param_manager/file_path_preview",
      messageType: "std_msgs/msg/String",
    });

    fileTopic.publish(new ROSLIB.Message({ data: file.path }));

    // Then call the service
    setTimeout(() => {
      const compareService = new ROSLIB.Service({
        ros: getRos(),
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
            } catch (error) {
              console.error("Error parsing parameters:", error);
              setError("Error parsing comparison parameters");
            }
          } else {
            setError(response.message || "Failed to load comparison file");
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
    const result = [];

    // Get all keys from both objects
    const allKeys = new Set([
      ...Object.keys(params1 || {}),
      ...Object.keys(params2 || {}),
    ]);

    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const val1 = params1?.[key];
      const val2 = params2?.[key];

      if (
        typeof val1 === "object" &&
        val1 !== null &&
        !Array.isArray(val1) &&
        typeof val2 === "object" &&
        val2 !== null &&
        !Array.isArray(val2)
      ) {
        result.push(...compareNestedParams(val1, val2, fullKey));
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
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Filename
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Modified
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {historyFiles.map((file, index) => (
              <tr
                key={index}
                className={`hover:bg-gray-50 ${
                  selectedFile?.path === file.path
                    ? "bg-blue-50 border-l-4 border-blue-500"
                    : ""
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {file.filename}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {file.modified}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => previewFile(file)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
                  >
                    Preview
                  </button>
                  {compareMode &&
                    selectedFile &&
                    selectedFile.path !== file.path && (
                      <button
                        onClick={() => selectForComparison(file)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
                      >
                        Compare
                      </button>
                    )}
                  <button
                    onClick={() => loadParameterFile(file.path)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFileToDelete(file);
                      setDeleteModal(true);
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
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
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-900">
          Parameter Comparison
        </h3>

        <div className="grid grid-cols-3 gap-4 mb-4 font-semibold bg-gray-100 p-4 rounded-lg">
          <div className="text-gray-700">Parameter</div>
          <div className="text-blue-700">
            {selectedFile?.filename} (Selected)
          </div>
          <div className="text-purple-700">
            {compareFile?.filename} (Compare)
          </div>
        </div>

        <div className="overflow-auto max-h-[400px]">
          {Object.entries(groupedResults).map(([topLevel, params]) => (
            <div key={topLevel} className="mb-4">
              <h4 className="font-bold text-gray-700 mb-2 bg-gray-100 p-3 rounded-lg">
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
                        ? "bg-yellow-50 border border-yellow-300"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="font-mono text-sm break-all text-gray-700">
                      {displayKey}
                    </div>
                    <div
                      className={`break-all ${
                        isDifferent ? "text-blue-700" : "text-gray-600"
                      }`}
                    >
                      {param.value1 === undefined ? (
                        <span className="text-gray-400">undefined</span>
                      ) : typeof param.value1 === "object" ? (
                        <pre className="text-xs whitespace-pre-wrap bg-gray-100 p-3 rounded border border-gray-200">
                          {JSON.stringify(param.value1, null, 2)}
                        </pre>
                      ) : (
                        <span className="font-mono text-sm bg-gray-200 px-3 py-1 rounded border border-gray-300">
                          {String(param.value1)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`break-all ${
                        isDifferent ? "text-purple-700" : "text-gray-600"
                      }`}
                    >
                      {param.value2 === undefined ? (
                        <span className="text-gray-400">undefined</span>
                      ) : typeof param.value2 === "object" ? (
                        <pre className="text-xs whitespace-pre-wrap bg-gray-100 p-3 rounded border border-gray-200">
                          {JSON.stringify(param.value2, null, 2)}
                        </pre>
                      ) : (
                        <span className="font-mono text-sm bg-gray-200 px-3 py-1 rounded border border-gray-300">
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
      return <span className="text-gray-400">null</span>;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      return (
        <div className="pl-4 border-l border-gray-200">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="py-1">
              <span className="font-medium text-gray-700">{k}: </span>
              {renderParameterValue(v, level + 1)}
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div className="font-mono text-sm bg-gray-100 p-3 rounded border border-gray-200 text-gray-700">
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
      <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded border border-gray-200 text-gray-700">
        {value.toString()}
      </span>
    );
  };

  const renderParameterPreview = () => {
    if (!previewParams) return null;

    return (
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-900">
          Parameter Preview
        </h3>
        <div className="overflow-auto max-h-[400px]">
          {Object.entries(previewParams).map(([key, value]) => (
            <div
              key={key}
              className="py-3 border-b border-gray-200 last:border-b-0"
            >
              <div className="font-medium text-gray-700 mb-2">{key}</div>
              <div className="ml-4">{renderParameterValue(value)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-8 bg-white border border-gray-200 shadow-sm rounded-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">
          Parameter History
        </h2>
        <div className="flex space-x-3">
          <button
            onClick={toggleCompareMode}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
              compareMode
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
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
            className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-medium text-white transition-all duration-300"
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-6">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 text-red-500"
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
            <div className="w-16 h-16 border-4 border-gray-300 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
        </div>
      ) : historyFiles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-6xl mb-4">📂</div>
          <div className="text-xl mb-2 text-gray-700">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-red-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 border border-red-200">
                    ⚠️
                  </div>
                  Confirm Delete
                </div>
              </h3>
              <button
                onClick={() => setDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
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
              <p className="text-gray-700 leading-relaxed">
                Are you sure you want to delete &quot;
                <span className="font-semibold text-gray-900">
                  {selectedFileToDelete.filename}
                </span>
                &quot;? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-6 py-3 rounded-lg text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 border border-gray-300"
                onClick={() => setDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-3 rounded-lg text-white font-medium bg-red-600 hover:bg-red-700"
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
