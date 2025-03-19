import React, { useState, useEffect } from "react";
import ROSLIB from "roslib";

export default function History({
  rosRef,
  connectionStatus,
  onRestore,
  onRefresh,
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

  // Fetch history files on component mount and when connection status changes
  useEffect(() => {
    if (connectionStatus === "connected") {
      fetchHistoryFiles();
    }
  }, [connectionStatus]);

  const fetchHistoryFiles = async () => {
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
      messageType: "std_msgs/String",
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
      messageType: "std_msgs/String",
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
    if (!rosRef.current || connectionStatus !== "connected") {
      setError("ROS connection not established");
      return;
    }

    setLoading(true);
    setError(null);

    const deleteTopic = new ROSLIB.Topic({
      ros: rosRef.current,
      name: "/param_manager/file_path_delete",
      messageType: "std_msgs/String",
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
          } else {
            setError(`Failed to delete file: ${response.message}`);
          }
        },
        (error) => {
          setLoading(false);
          setError(`Service call failed: ${error}`);
        }
      );

      fetchHistoryFiles();
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
      messageType: "std_msgs/String",
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
      <div className="overflow-auto max-h-[400px] bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Filename
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Modified
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {historyFiles.map((file, index) => (
              <tr
                key={index}
                className={`${
                  selectedFile?.path === file.path ? "bg-blue-50" : ""
                } hover:bg-gray-50`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {file.filename}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {file.modified}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => previewFile(file)}
                    className="text-blue-600 hover:text-blue-900 mr-2"
                  >
                    Preview
                  </button>
                  {compareMode &&
                    selectedFile &&
                    selectedFile.path !== file.path && (
                      <button
                        onClick={() => selectForComparison(file)}
                        className="text-purple-600 hover:text-purple-900 mr-2"
                      >
                        Compare
                      </button>
                    )}
                  <button
                    onClick={() => loadParameterFile(file.path)}
                    className="text-green-600 hover:text-green-900"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFileToDelete(file);
                      setDeleteModal(true);
                    }}
                    className="text-red-600 hover:text-red-900"
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
      <div className="mt-4 bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-4">Parameter Comparison</h3>

        <div className="grid grid-cols-3 gap-4 mb-2 font-semibold bg-gray-100 p-2">
          <div>Parameter</div>
          <div className="text-blue-600">
            {selectedFile?.filename} (Selected)
          </div>
          <div className="text-purple-600">
            {compareFile?.filename} (Compare)
          </div>
        </div>

        <div className="overflow-auto max-h-[400px]">
          {Object.entries(groupedResults).map(([topLevel, params]) => (
            <div key={topLevel} className="mb-4">
              <h4 className="font-bold text-gray-700 mb-2 bg-gray-50 p-2">
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
                    className={`grid grid-cols-3 gap-4 py-2 ${
                      isDifferent ? "bg-yellow-50" : ""
                    } border-b border-gray-200`}
                  >
                    <div className="font-mono text-sm break-all">
                      {displayKey}
                    </div>
                    <div
                      className={`${
                        isDifferent ? "text-blue-600" : ""
                      } break-all`}
                    >
                      {param.value1 === undefined ? (
                        <span className="text-gray-400">undefined</span>
                      ) : typeof param.value1 === "object" ? (
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(param.value1, null, 2)}
                        </pre>
                      ) : (
                        <span className="font-mono text-sm">
                          {String(param.value1)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`${
                        isDifferent ? "text-purple-600" : ""
                      } break-all`}
                    >
                      {param.value2 === undefined ? (
                        <span className="text-gray-400">undefined</span>
                      ) : typeof param.value2 === "object" ? (
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(param.value2, null, 2)}
                        </pre>
                      ) : (
                        <span className="font-mono text-sm">
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
        <div className="pl-4">
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
        <div className="font-mono text-sm">
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

    // For primitive values
    return <span className="font-mono text-sm">{value.toString()}</span>;
  };

  // Flatten nested parameter structure for easier rendering
  const flattenParams = (params, prefix = "") => {
    let result = [];

    for (const [key, value] of Object.entries(params)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Recursive call for nested objects
        result.push({
          key: fullKey,
          value: value,
          isNested: true,
        });

        // Add the nested parameters as well
        result = [...result, ...flattenParams(value, fullKey)];
      } else {
        result.push({
          key: fullKey,
          value: value,
          isNested: false,
        });
      }
    }

    return result;
  };

  const renderParameterPreview = () => {
    if (!previewParams) return null;

    // Option 1: Display with hierarchy preserved
    return (
      <div className="mt-4 bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-4">Parameter Preview</h3>
        <div className="overflow-auto max-h-[400px]">
          {Object.entries(previewParams).map(([key, value]) => (
            <div key={key} className="py-2 border-b border-gray-200">
              <div className="font-medium">{key}</div>
              {renderParameterValue(value)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-8 bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-700">
          Parameter History
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={toggleCompareMode}
            className={`px-3 py-1 ${
              compareMode ? "bg-purple-600" : "bg-blue-600"
            } text-white rounded hover:opacity-90 transition-colors`}
          >
            {compareMode ? "Exit Compare Mode" : "Compare Mode"}
          </button>
          <button
            onClick={fetchHistoryFiles}
            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : historyFiles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No history files found
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
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50"
          onClick={() => setDeleteModal(false)}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-6">
              Are you sure you want to delete "{selectedFileToDelete.filename}"? This
              action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                onClick={() => setDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={() => {
                  confirmDelete(selectedFileToDelete);
                  setDeleteModal(false);
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
